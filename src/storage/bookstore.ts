// 책장(library.json)과 책 파일(books/<ID>.json) 읽고 쓰기 (원본 PlannerStore 의 저장 부분).
// - 쓰기: 임시 파일에 다 쓴 뒤 바꿔치기. 바꿔치기 중 꺼져서 원본이 없고 임시 파일만 있으면 임시 파일을 읽는다.
// - 읽지 못한 파일: 원본은 그대로 두고 옆에 "<파일>.unreadable-yyyyMMdd-HHmmss.json" 사본을 남기며, 이번 실행 동안 그 원본에 쓰지 않는다.
// - 1.0.2 까지의 책: 원본을 "<파일>.before-per-day-dday.json" 으로 남긴 뒤 D-day 를 날마다 붙이는 형식으로 옮긴다.

import * as Dates from "../model/dates";
import {
  BookInfo, decodeData, decodeLibrary, emptyData, encodeData, encodeLibrary, Library, PlannerData, stableStringify,
} from "../model/types";
import { migrateDDaysPerDay } from "../model/planner";
import { newUUID, sameUUID, UUID } from "../model/uuid";

/** Obsidian DataAdapter 중 쓰는 것만 */
export interface FileAdapter {
  exists(path: string): Promise<boolean>;
  read(path: string): Promise<string>;
  write(path: string, data: string): Promise<void>;
  remove(path: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  mkdir(path: string): Promise<void>;
}

export interface Unreadable { path: string; copy: string | null; reason: string; }

const stamp = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};

export class BookStore {
  library: Library = { books: [], activeID: null, sampleSeeded: false };
  libraryUnreadable: Unreadable | null = null;
  unreadableBooks = new Map<UUID, Unreadable>();
  /** 내가 마지막으로 쓴 내용 (밖에서 바뀐 것과 구별) */
  private lastWritten = new Map<string, string>();

  constructor(private fs: FileAdapter, readonly folder: string) {}

  get libraryPath(): string { return `${this.folder}/library.json`; }
  bookPath(id: UUID): string { return `${this.folder}/books/${id.toUpperCase()}.json`; }
  get activeBook(): BookInfo | null { return this.library.books.find((b) => sameUUID(b.id, this.library.activeID)) ?? null; }

  /** 폴더를 만든다. 이미 있으면 그대로 (폰에서 exists 가 폴더를 못 알아봐 mkdir 이 "이미 있음" 으로 실패해도 넘어간다) */
  async ensureFolder(): Promise<void> {
    for (const dir of [this.folder, `${this.folder}/books`]) {
      if (await this.fs.exists(dir)) continue;
      try { await this.fs.mkdir(dir); } catch (e) { if (!(await this.fs.exists(dir))) console.warn("10분 플래너: 폴더 만들기", dir, e); }
    }
  }

  /** 원본이 없고 임시 파일만 남았으면 임시 파일 내용 */
  private async readMaybe(path: string): Promise<string | null> {
    if (await this.fs.exists(path)) return this.fs.read(path);
    const tmp = `${path}.tmp`;
    if (await this.fs.exists(tmp)) return this.fs.read(tmp);
    return null;
  }

  /** 파일마다 쓰기를 줄 세운다 (저장 예약과 책 바꾸기 저장이 겹쳐도 임시 파일을 서로 밟지 않게) */
  private queue = new Map<string, Promise<void>>();

  private writeAtomic(path: string, text: string): Promise<void> {
    const prev = this.queue.get(path) ?? Promise.resolve();
    const next = prev.catch(() => {}).then(() => this.writeNow(path, text));
    this.queue.set(path, next);
    return next.finally(() => { if (this.queue.get(path) === next) this.queue.delete(path); });
  }

  private async writeNow(path: string, text: string): Promise<void> {
    const tmp = `${path}.tmp`;
    this.lastWritten.set(path, text);
    await this.fs.write(tmp, text);
    if (await this.fs.exists(path)) await this.fs.remove(path);
    await this.fs.rename(tmp, path);
  }

  private async preserve(path: string, raw: string, reason: string, now: Date): Promise<Unreadable> {
    const copy = `${path}.unreadable-${stamp(now)}.json`;
    try {
      if (!(await this.fs.exists(copy))) await this.fs.write(copy, raw);
      return { path, copy, reason };
    } catch {
      return { path, copy: null, reason };
    }
  }

  async loadLibrary(now = new Date()): Promise<Library> {
    await this.ensureFolder();
    const raw = await this.readMaybe(this.libraryPath);
    if (raw == null) return this.library;
    try {
      this.library = decodeLibrary(JSON.parse(raw));
      this.libraryUnreadable = null;
    } catch (e) {
      this.libraryUnreadable = await this.preserve(this.libraryPath, raw, String(e), now);
    }
    return this.library;
  }

  async saveLibrary(): Promise<boolean> {
    if (this.libraryUnreadable) return false;
    await this.writeAtomic(this.libraryPath, stableStringify(encodeLibrary(this.library)));
    return true;
  }

  /** 책 파일을 읽는다. 없으면 빈 책, 읽지 못하면 null */
  async loadBook(id: UUID, today = new Date()): Promise<PlannerData | null> {
    const path = this.bookPath(id);
    const raw = await this.readMaybe(path);
    if (raw == null) return emptyData();
    let data: PlannerData;
    try {
      data = decodeData(JSON.parse(raw));
    } catch (e) {
      this.unreadableBooks.set(id.toUpperCase(), await this.preserve(path, raw, String(e), today));
      return null;
    }
    this.unreadableBooks.delete(id.toUpperCase());
    if (!data.prefs.ddaysPerDay) {
      // 무엇이든 바꾸기 전에 원본을 남긴다. 남기지 못하면 이번에는 옮기지 않는다.
      const backup = `${path}.before-per-day-dday.json`;
      try {
        if (!(await this.fs.exists(backup))) await this.fs.write(backup, raw);
      } catch {
        return data;
      }
      const book = this.library.books.find((b) => sameUUID(b.id, id)) ?? null;
      migrateDDaysPerDay(data, today, book);
      await this.saveBook(id, data);
    }
    return data;
  }

  async saveBook(id: UUID, data: PlannerData): Promise<boolean> {
    if (this.unreadableBooks.has(id.toUpperCase())) return false;
    await this.writeAtomic(this.bookPath(id), stableStringify(encodeData(data)));
    return true;
  }

  /** 밖에서 바뀐 책 파일이면 읽은 내용, 내가 쓴 그대로이거나 읽지 못하면 null */
  async readChangedBook(id: UUID): Promise<PlannerData | null> {
    const path = this.bookPath(id);
    if (!(await this.fs.exists(path))) return null;
    const raw = await this.fs.read(path);
    if (raw === this.lastWritten.get(path)) return null;
    try {
      const d = decodeData(JSON.parse(raw));
      this.lastWritten.set(path, raw);
      return d;
    } catch {
      return null; // 쓰는 도중 읽었을 수 있다 — 다음 변경 때 다시
    }
  }

  /** 책 정보 고치기: 날짜는 날 단위로, 종료 < 시작이면 종료 = 시작 */
  async updateBook(id: UUID, patch: Partial<Pick<BookInfo, "name" | "start" | "end" | "cover">>): Promise<BookInfo | null> {
    const b = this.library.books.find((x) => sameUUID(x.id, id));
    if (!b) return null;
    if (patch.name != null) b.name = patch.name;
    if (patch.cover != null) b.cover = patch.cover;
    if (patch.start) b.start = Dates.day(patch.start);
    if (patch.end !== undefined) b.end = patch.end ? Dates.day(patch.end) : null;
    if (b.end && b.end < b.start) b.end = b.start;
    await this.saveLibrary();
    return b;
  }

  /** 책을 지운다: 책 파일과 D-day 옮기기 백업을 지우고 책장에서 뺀다 (읽지 못한 파일의 사본은 남긴다).
   * 펼친 책이었으면 다음 책 (내가 만든 책 먼저, 없으면 예시) 을 펼친 책으로 둔다. 남은 책이 없으면 지우지 않는다. */
  async deleteBook(id: UUID): Promise<BookInfo | null> {
    const i = this.library.books.findIndex((x) => sameUUID(x.id, id));
    if (i < 0 || this.library.books.length <= 1) return null;
    const path = this.bookPath(id);
    for (const f of [path, `${path}.tmp`, `${path}.before-per-day-dday.json`]) {
      if (await this.fs.exists(f)) await this.fs.remove(f);
    }
    this.library.books.splice(i, 1);
    this.unreadableBooks.delete(id.toUpperCase());
    if (sameUUID(this.library.activeID, id)) {
      const next = this.library.books.find((b) => !b.isSample) ?? this.library.books[0];
      this.library.activeID = next.id;
    }
    await this.saveLibrary();
    return this.activeBook;
  }

  /** 가져온 기록으로 새 책을 만든다 (기존 책은 그대로). 1.0.2 이전 백업이면 D-day 를 날마다 붙이는 형식으로 옮긴다 */
  async createBookFromData(name: string, start: Date, cover: number, data: PlannerData): Promise<BookInfo> {
    const book: BookInfo = { id: newUUID(), name, start: Dates.day(start), end: null, cover, created: new Date(), isSample: false };
    if (!data.prefs.ddaysPerDay) migrateDDaysPerDay(data, new Date(), book);
    const sample = this.library.books.findIndex((b) => b.isSample);
    if (sample >= 0) this.library.books.splice(sample, 0, book);
    else this.library.books.push(book);
    this.library.activeID = book.id;
    await this.saveBook(book.id, data);
    await this.saveLibrary();
    return book;
  }

  /** 새 책. 형광펜 · 기본 컬러는 inherit 에서 이어받는다 */
  async createBook(name: string, start: Date, end: Date | null, cover = 0, inherit?: PlannerData["prefs"]): Promise<BookInfo> {
    const s = Dates.day(start);
    let e = end ? Dates.day(end) : null;
    if (e && e < s) e = s;
    const book: BookInfo = { id: newUUID(), name, start: s, end: e, cover, created: new Date(), isSample: false };
    const fresh = emptyData();
    if (inherit) {
      fresh.prefs.categories = structuredClone(inherit.categories);
      fresh.prefs.defaultTheme = inherit.defaultTheme;
      fresh.prefs.lastKind = inherit.lastKind;
    }
    const sample = this.library.books.findIndex((b) => b.isSample);
    if (sample >= 0) this.library.books.splice(sample, 0, book);
    else this.library.books.push(book);
    this.library.activeID = book.id;
    await this.saveBook(book.id, fresh);
    await this.saveLibrary();
    return book;
  }
}
