// 저장 형식. 원본 앱(Spiralday 1.1.0 계열)의 library.json · books/<id>.json 과 같은 모양으로 읽고 쓴다.
// 읽을 때는 없는 키를 기본값으로 채우고(원본 init(from:)), 쓸 때는 원본이 생략하는 키를 똑같이 생략한다.

import { UUID, URL_NAMESPACE, uuidV5 } from "./uuid";
import { fromISO, toISO } from "./dates";
import { decodeRule, encodeRule, RepeatRule } from "./repeat";

export enum Mark { none = 0, done = 1, partial = 2, missed = 3, moved = 4 }
export const nextMark = (m: Mark): Mark => ((m + 1) % 5) as Mark;
export const markLabel: Record<Mark, string> = {
  [Mark.none]: "표시 없음", [Mark.done]: "완료  ○", [Mark.partial]: "일부  △",
  [Mark.missed]: "못함  ×", [Mark.moved]: "미룸  →",
};

export interface PlanTask {
  id: UUID;
  text: string;
  mark: Mark;
  cat: number | null;
  /** → 로 전날에서 넘어온 할 일이면 전날 할 일의 id */
  carriedFrom: UUID | null;
  /** TASKS 의 몇째 줄 (0 부터). 예전 파일에는 없다. */
  row: number | null;
}

export interface TimeNote {
  id: UUID;
  kind: "text" | "meal";
  /** 시작 · 끝 칸 (0...143, 끝 칸 포함) */
  start: number;
  end: number;
  text: string;
}

export interface DDay {
  id: UUID;
  title: string;
  date: Date;
  /** 날에 붙인 복사본이면 복사해 온 저장한 D-day 의 id */
  source: UUID | null;
}

export interface DayRecord {
  tasks: PlanTask[];
  /** 06시부터 10분 칸 144개. 형광펜 id, 빈 칸은 -1 */
  slots: number[];
  comment: string;
  memoTags: string[];
  memos: string[];
  theme: number | null;
  notes: TimeNote[];
  ddays: DDay[];
  dayOff: boolean;
}

export interface WeekRecord { goal: string; review: string; stars: number; }

export interface Category { id: number; name: string; hex: string; counts: boolean; }

export type PageKind = "home" | "weekly" | "daily";

export interface Prefs {
  categories: Category[];
  lastKind: PageKind;
  ddays: DDay[];
  defaultTheme: number;
  ddaysPerDay: boolean;
  /** 첫 장에 적는 말 (비어 있으면 파일에 남기지 않는다) */
  motto: string;
  /** 반복 할 일 규칙 (이 플러그인에서 더한 키 "repeats" — 원본 앱이 다시 저장하면 빠질 수 있다) */
  repeats: RepeatRule[];
}

export interface PlannerData {
  days: Record<string, DayRecord>;
  weeks: Record<string, WeekRecord>;
  prefs: Prefs;
}

export interface BookInfo {
  id: UUID;
  name: string;
  start: Date;
  end: Date | null;
  cover: number;
  created: Date;
  isSample: boolean;
}

export interface Library { books: BookInfo[]; activeID: UUID | null; sampleSeeded: boolean; }

export const SLOT_COUNT = 144;
export const MEMO_COUNT = 3;
export const MAX_DDAYS = 2;
export const MAX_CATEGORIES = 12;

export const defaultCategories = (): Category[] => [
  { id: 0, name: "집중 업무", hex: "8EDCD2", counts: true },
  { id: 1, name: "미팅", hex: "F8B38A", counts: true },
  { id: 2, name: "소통·메일", hex: "A9CFF3", counts: true },
  { id: 3, name: "기획", hex: "F3DB78", counts: true },
  { id: 4, name: "학습", hex: "CDB6EF", counts: true },
  { id: 5, name: "개인", hex: "F6AEC5", counts: false },
  { id: 6, name: "휴식·이동", hex: "CFCFD4", counts: false },
];

export const emptyDay = (): DayRecord => ({
  tasks: [], slots: Array(SLOT_COUNT).fill(-1), comment: "",
  memoTags: Array(MEMO_COUNT).fill(""), memos: Array(MEMO_COUNT).fill(""),
  theme: null, notes: [], ddays: [], dayOff: false,
});

export const emptyWeek = (): WeekRecord => ({ goal: "", review: "", stars: 0 });

export const defaultPrefs = (): Prefs => ({
  categories: defaultCategories(), lastKind: "daily", ddays: [], defaultTheme: 0, ddaysPerDay: true, motto: "", repeats: [],
});

export const emptyData = (): PlannerData => ({ days: {}, weeks: {}, prefs: defaultPrefs() });

// ── 읽기 ────────────────────────────────────────────────────────────────

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const num = (v: unknown, d = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : d);
const optNum = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const optStr = (v: unknown): string | null => (typeof v === "string" ? v : null);
const pad = <T>(a: T[], n: number, fill: T): T[] => (a.length >= n ? a : a.concat(Array(n - a.length).fill(fill)));

function reqDate(v: unknown, what: string): Date {
  const d = fromISO(v);
  if (!d) throw new Error(`${what}: 날짜를 읽지 못함 (${String(v)})`);
  return d;
}

export function decodeTask(v: unknown): PlanTask {
  const r = obj(v);
  const m = num(r.mark, 0);
  return {
    id: str(r.id).toUpperCase(),
    text: str(r.text),
    mark: (m >= 0 && m <= 4 ? m : 0) as Mark,
    cat: optNum(r.cat),
    carriedFrom: optStr(r.carriedFrom)?.toUpperCase() ?? null,
    row: optNum(r.row),
  };
}

export function decodeNote(v: unknown): TimeNote {
  const r = obj(v);
  return {
    id: str(r.id).toUpperCase(),
    kind: r.kind === "meal" ? "meal" : "text",
    start: num(r.start), end: num(r.end), text: str(r.text),
  };
}

export function decodeDDay(v: unknown): DDay {
  const r = obj(v);
  return {
    id: str(r.id).toUpperCase(),
    title: str(r.title),
    date: reqDate(r.date, "D-day"),
    source: optStr(r.source)?.toUpperCase() ?? null,
  };
}

export function decodeDay(v: unknown): DayRecord {
  const r = obj(v);
  const slots = pad(arr(r.slots).map((x) => num(x, -1)), SLOT_COUNT, -1).slice(0, SLOT_COUNT);
  return {
    tasks: arr(r.tasks).map(decodeTask),
    slots,
    comment: str(r.comment),
    memoTags: pad(arr(r.memoTags).map((x) => str(x)), MEMO_COUNT, ""),
    memos: pad(arr(r.memos).map((x) => str(x)), MEMO_COUNT, ""),
    theme: optNum(r.theme),
    notes: arr(r.notes).map(decodeNote),
    ddays: arr(r.ddays).map(decodeDDay),
    dayOff: r.dayOff === true,
  };
}

export function decodeWeek(v: unknown): WeekRecord {
  const r = obj(v);
  return { goal: str(r.goal), review: str(r.review), stars: num(r.stars) };
}

/** 옛 D-day 하나짜리 파일(prefs.ddayTitle · prefs.ddayDate)에서 읽은 D-day 의 id */
export function legacyDDayId(title: string, date: Date): string {
  return uuidV5(URL_NAMESPACE, `https://spiralday.com/ns/legacy-dday/${toISO(date)}/${title}`);
}

export function decodePrefs(v: unknown): Prefs {
  const r = obj(v);
  const cats = arr(r.categories).map((c) => {
    const o = obj(c);
    return { id: num(o.id), name: str(o.name), hex: str(o.hex, "CFCFD4"), counts: o.counts !== false };
  });
  let ddays = arr(r.ddays).map(decodeDDay);
  if (ddays.length === 0) {
    const legacyDate = fromISO(r.ddayDate);
    if (legacyDate) {
      const title = str(r.ddayTitle);
      ddays = [{ id: legacyDDayId(title, legacyDate), title, date: legacyDate, source: null }];
    }
  }
  const lk = r.lastKind;
  return {
    categories: cats.length >= 1 && cats.length <= MAX_CATEGORIES ? cats : defaultCategories(),
    lastKind: lk === "home" || lk === "weekly" || lk === "daily" ? lk : "daily",
    ddays,
    defaultTheme: num(r.defaultTheme),
    // 키가 없으면 1.0.2 까지의 파일 — 읽은 뒤 migrateDDaysPerDay 로 한 번 옮긴다
    ddaysPerDay: r.ddaysPerDay === true,
    motto: str(r.mottoText),
    repeats: arr(r.repeats).map(decodeRule).filter((x): x is RepeatRule => x != null),
  };
}

export function decodeData(v: unknown): PlannerData {
  const r = obj(v);
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("책 파일이 객체가 아님");
  const days: Record<string, DayRecord> = {};
  for (const [k, d] of Object.entries(obj(r.days))) days[k] = decodeDay(d);
  const weeks: Record<string, WeekRecord> = {};
  for (const [k, w] of Object.entries(obj(r.weeks))) weeks[k] = decodeWeek(w);
  return { days, weeks, prefs: decodePrefs(r.prefs) };
}

export function decodeBook(v: unknown): BookInfo {
  const r = obj(v);
  const id = str(r.id);
  if (!id) throw new Error("책 id 없음");
  return {
    id: id.toUpperCase(),
    name: str(r.name),
    start: reqDate(r.start, "책 시작일"),
    end: fromISO(r.end),
    cover: num(r.cover),
    created: fromISO(r.created) ?? new Date(),
    isSample: r.isSample === true,
  };
}

export function decodeLibrary(v: unknown): Library {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("library.json 이 객체가 아님");
  const r = obj(v);
  return {
    books: arr(r.books).map(decodeBook),
    activeID: optStr(r.activeID)?.toUpperCase() ?? null,
    sampleSeeded: r.sampleSeeded === true,
  };
}

// ── 쓰기 ────────────────────────────────────────────────────────────────

const encTask = (t: PlanTask): Raw => {
  const o: Raw = { id: t.id, text: t.text, mark: t.mark };
  if (t.cat != null) o.cat = t.cat;
  if (t.carriedFrom != null) o.carriedFrom = t.carriedFrom;
  if (t.row != null) o.row = t.row;
  return o;
};

const encDDay = (d: DDay): Raw => {
  const o: Raw = { id: d.id, title: d.title, date: toISO(d.date) };
  if (d.source != null) o.source = d.source;
  return o;
};

export function encodeDay(d: DayRecord): Raw {
  const o: Raw = {
    tasks: d.tasks.map(encTask), slots: d.slots, comment: d.comment,
    memoTags: d.memoTags, memos: d.memos,
    notes: d.notes.map((n) => ({ id: n.id, kind: n.kind, start: n.start, end: n.end, text: n.text })),
  };
  if (d.theme != null) o.theme = d.theme;
  // D-day 를 붙인 날, 쉬는 날만 적는다 (원본과 같은 모양)
  if (d.ddays.length) o.ddays = d.ddays.map(encDDay);
  if (d.dayOff) o.dayOff = true;
  return o;
}

export function encodePrefs(p: Prefs): Raw {
  const o: Raw = {
    categories: p.categories.map((c) => ({ id: c.id, name: c.name, hex: c.hex, counts: c.counts })),
    lastKind: p.lastKind, ddays: p.ddays.map(encDDay), defaultTheme: p.defaultTheme, ddaysPerDay: p.ddaysPerDay,
  };
  if (p.motto) o.mottoText = p.motto;
  if (p.repeats.length) o.repeats = p.repeats.map(encodeRule);
  return o;
}

export function encodeData(d: PlannerData): Raw {
  const days: Raw = {};
  for (const [k, r] of Object.entries(d.days)) days[k] = encodeDay(r);
  const weeks: Raw = {};
  for (const [k, w] of Object.entries(d.weeks)) weeks[k] = { goal: w.goal, review: w.review, stars: w.stars };
  return { days, weeks, prefs: encodePrefs(d.prefs) };
}

export function encodeBook(b: BookInfo): Raw {
  const o: Raw = { id: b.id, name: b.name, start: toISO(b.start), cover: b.cover, created: toISO(b.created) };
  if (b.end) o.end = toISO(b.end);
  if (b.isSample) o.isSample = true;
  return o;
}

export function encodeLibrary(l: Library): Raw {
  const o: Raw = { books: l.books.map(encodeBook), sampleSeeded: l.sampleSeeded };
  if (l.activeID) o.activeID = l.activeID;
  return o;
}

/** 키를 정렬해 한 줄로 (원본 JSONEncoder .sortedKeys 와 같은 순서) */
export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Raw;
    return `{${Object.keys(o).sort().filter((k) => o[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}
