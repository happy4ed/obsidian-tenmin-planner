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

  async ensureFolder(): Promise<void> {
    if (!(await this.fs.exists(this.folder))) await this.fs.mkdir(this.folder);
    if (!(await this.fs.exists(`${this.folder}/books`))) await this.fs.mkdir(`${this.folder}/books`);
  }

  /** 원본이 없고 임시 파일만 남았으면 임시 파일 내용 */
  private async readMaybe(path: string): Promise<string | null> {
    if (await this.fs.exists(path)) return this.fs.read(path);
    const tmp = `${path}.tmp`;
    if (await this.fs.exists(tmp)) return this.fs.read(tmp);
    return null;
  }

  private async writeAtomic(path: string, text: string): Promise<void> {
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
