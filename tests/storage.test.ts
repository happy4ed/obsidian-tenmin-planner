import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { promises as fsp } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { BookStore, FileAdapter } from "../src/storage/bookstore";
import { Planner } from "../src/model/planner";
import { approxWrap } from "../src/model/ruled";
import { Mark } from "../src/model/types";

const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

function nodeFS(root: string): FileAdapter {
  const p = (x: string) => join(root, x);
  return {
    exists: async (x) => existsSync(p(x)),
    read: (x) => fsp.readFile(p(x), "utf8"),
    write: (x, d) => fsp.writeFile(p(x), d, "utf8"),
    remove: (x) => fsp.rm(p(x)),
    rename: (a, b) => fsp.rename(p(a), p(b)),
    mkdir: (x) => fsp.mkdir(p(x), { recursive: true }).then(() => undefined),
  };
}

function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), "tenmin-"));
  dirs.push(d);
  return d;
}

describe("책장 저장", () => {
  it("만들고 저장하고 다시 읽는다 (library.json + books/<ID>.json)", async () => {
    const root = tmp();
    const s = new BookStore(nodeFS(root), "Planner");
    await s.loadLibrary();
    const book = await s.createBook("테스트 플래너", new Date(2026, 9, 1), null);
    const data = (await s.loadBook(book.id))!;
    const p = new Planner(data, book, approxWrap());
    const t = new Date(2026, 9, 14);
    const id = p.addTask(t, 2, 0);
    p.setTaskText(t, id, "위젯에서 보일 할 일");
    p.editDay(t, (r) => { for (let i = 0; i < 12; i++) r.slots[i] = 0; });
    await s.saveBook(book.id, p.data);
    await s.saveLibrary();

    const files = readdirSync(join(root, "Planner/books"));
    expect(files).toEqual([`${book.id}.json`]);
    expect(book.id).toBe(book.id.toUpperCase());

    const s2 = new BookStore(nodeFS(root), "Planner");
    const lib = await s2.loadLibrary();
    expect(lib.books[0].name).toBe("테스트 플래너");
    expect(lib.activeID).toBe(book.id);
    const p2 = new Planner((await s2.loadBook(book.id))!, lib.books[0], approxWrap());
    expect(p2.day(t).tasks[0]).toMatchObject({ text: "위젯에서 보일 할 일", row: 2, cat: 0, mark: Mark.none });
    expect(p2.minutes(t)).toBe(120);
    // 날짜는 초 단위 UTC
    const raw = JSON.parse(readFileSync(join(root, "Planner/library.json"), "utf8"));
    expect(raw.books[0].start).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  it("읽지 못한 책은 원본을 두고 사본을 남기며, 그 책에는 쓰지 않는다", async () => {
    const root = tmp();
    mkdirSync(join(root, "Planner/books"), { recursive: true });
    const id = "22222222-2222-4222-8222-222222222222";
    writeFileSync(join(root, `Planner/books/${id}.json`), "{ 깨진 파일");
    const s = new BookStore(nodeFS(root), "Planner");
    await s.loadLibrary();
    expect(await s.loadBook(id)).toBeNull();
    expect(await s.saveBook(id, { days: {}, weeks: {}, prefs: {} as never })).toBe(false);
    expect(readFileSync(join(root, `Planner/books/${id}.json`), "utf8")).toBe("{ 깨진 파일");
    expect(readdirSync(join(root, "Planner/books")).some((f) => f.includes(".unreadable-"))).toBe(true);
  });

  it("원본이 없고 임시 파일만 남았으면 임시 파일을 읽는다", async () => {
    const root = tmp();
    mkdirSync(join(root, "Planner/books"), { recursive: true });
    writeFileSync(join(root, "Planner/library.json.tmp"), JSON.stringify({ books: [], sampleSeeded: true }));
    const s = new BookStore(nodeFS(root), "Planner");
    expect((await s.loadLibrary()).sampleSeeded).toBe(true);
  });

  it("1.0.2 책은 원본을 백업하고 옮긴 뒤 저장한다", async () => {
    const root = tmp();
    mkdirSync(join(root, "Planner/books"), { recursive: true });
    const id = "33333333-3333-4333-8333-333333333333";
    const old = JSON.stringify({ days: {}, weeks: {}, prefs: { ddayTitle: "시험", ddayDate: "2026-11-01T15:00:00Z" } });
    writeFileSync(join(root, `Planner/books/${id}.json`), old);
    const s = new BookStore(nodeFS(root), "Planner");
    await s.loadLibrary();
    const d = (await s.loadBook(id, new Date(2026, 9, 14)))!;
    expect(d.prefs.ddaysPerDay).toBe(true);
    expect(d.prefs.ddays[0].id).toBe("116E4CC2-C837-5BC7-BDC4-D978F1815524");
    expect(d.days["2026-10-14"].ddays).toHaveLength(1);
    expect(readFileSync(join(root, `Planner/books/${id}.json.before-per-day-dday.json`), "utf8")).toBe(old);
  });
});
