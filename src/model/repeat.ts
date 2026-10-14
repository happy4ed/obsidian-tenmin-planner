// 반복 할 일 (이 플러그인에서 새로 만든 기능 — 원본 Spiralday 에는 없다).
// 규칙은 책의 prefs.repeats 에 두고, 날을 펼칠 때 그날에 해당하는 할 일을 한 번 만들어 넣는다 (그 뒤로는 보통 할 일과 같다).
// 만든 할 일의 id 는 UUIDv5(규칙 id, 날짜 키) 라서 두 번 만들지 않고, 지운 날은 exceptions 에 적어 다시 만들지 않는다.
//
//   매일      n 일마다
//   주마다    n 주마다, 시작일의 요일
//   요일마다  고른 요일마다 (n 주마다)
//   달마다    n 달마다: 그달 같은 날짜 (없으면 말일) · 몇째 무슨 요일 · 말일
//   연마다    n 해마다 시작일의 월 · 일 (2/29 는 평년에 2/28)
//   끝        계속 · 날짜까지 · n 번

import * as Dates from "./dates";
import { UUID, uuidV5 } from "./uuid";

export type RepeatFreq = "daily" | "weekly" | "weekdays" | "monthly" | "yearly";
export type MonthlyMode = "date" | "nth" | "last";
export type RepeatEnd = { type: "never" } | { type: "until"; until: Date } | { type: "count"; count: number };

export interface RepeatRule {
  id: UUID;
  text: string;
  cat: number | null;
  freq: RepeatFreq;
  /** n 일 · 주 · 달 · 해마다 (1 이상) */
  interval: number;
  /** 요일마다: 월 = 0 … 일 = 6 */
  weekdays: number[];
  monthly: MonthlyMode;
  start: Date;
  end: RepeatEnd;
  /** DAY OFF 인 날은 만들지 않는다 */
  skipDayOff: boolean;
  /** 잠깐 멈춤 */
  paused: boolean;
  /** 사용자가 지운 날 (yyyy-MM-dd) — 다시 만들지 않는다 */
  exceptions: string[];
  /** 타임테이블 칠하기: 칸 from ~ to (0 = 06:00, 끝 칸 포함) 을 cat 형광펜으로. null 이면 칠하지 않는다 */
  paint: { from: number; to: number } | null;
  /** 이미 칠한 날 (yyyy-MM-dd) — 지우개로 지워도 다시 칠하지 않게 */
  paintedDays: string[];
}

export const WEEKDAY_KO = ["월", "화", "수", "목", "금", "토", "일"];
const NTH_KO = ["첫째", "둘째", "셋째", "넷째", "다섯째"];

/** 월 = 0 … 일 = 6 */
export const weekdayIndex = (d: Date) => (d.getDay() + 6) % 7;

const monthsBetween = (a: Date, b: Date) => (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
const lastDay = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
/** 그달에서 몇째 요일인지 (1 부터) */
const nthOfMonth = (d: Date) => Math.floor((d.getDate() - 1) / 7) + 1;

export function newRule(id: UUID, start: Date, text = "", cat: number | null = null): RepeatRule {
  return { id, text, cat, freq: "daily", interval: 1, weekdays: [weekdayIndex(start)], monthly: "date",
    start: Dates.day(start), end: { type: "never" }, skipDayOff: false, paused: false, exceptions: [], paint: null, paintedDays: [] };
}

/** 칸 번호 → "09:30" (0 = 06:00, 10분 칸). end 면 칸이 끝나는 시각 */
export function slotTime(i: number, end = false): string {
  const m = (6 * 60 + (i + (end ? 1 : 0)) * 10) % (24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** 규칙 모양만 보고 그날이 반복하는 날인지 (끝 · 횟수 · 예외 · 멈춤은 보지 않는다) */
function matches(r: RepeatRule, d: Date): boolean {
  const s = Dates.day(r.start), x = Dates.day(d);
  if (x < s) return false;
  const n = Math.max(1, Math.floor(r.interval) || 1);
  switch (r.freq) {
    case "daily": return Dates.daysBetween(s, x) % n === 0;
    case "weekly": {
      const days = Dates.daysBetween(s, x);
      return days % 7 === 0 && (days / 7) % n === 0;
    }
    case "weekdays": {
      if (!r.weekdays.includes(weekdayIndex(x))) return false;
      const weeks = Math.floor(Dates.daysBetween(Dates.weekStart(s), Dates.weekStart(x)) / 7);
      return weeks % n === 0;
    }
    case "monthly": {
      const mm = monthsBetween(s, x);
      if (mm % n !== 0) return false;
      if (r.monthly === "last") return x.getDate() === lastDay(x.getFullYear(), x.getMonth());
      if (r.monthly === "nth") {
        const k = nthOfMonth(s);
        if (weekdayIndex(x) !== weekdayIndex(s)) return false;
        // 시작일이 다섯째 주면 "마지막 그 요일"
        if (k >= 5) return x.getDate() + 7 > lastDay(x.getFullYear(), x.getMonth());
        return nthOfMonth(x) === k;
      }
      const want = Math.min(s.getDate(), lastDay(x.getFullYear(), x.getMonth()));
      return x.getDate() === want;
    }
    case "yearly": {
      const yy = x.getFullYear() - s.getFullYear();
      if (yy % n !== 0 || x.getMonth() !== s.getMonth()) return false;
      return x.getDate() === Math.min(s.getDate(), lastDay(x.getFullYear(), x.getMonth()));
    }
  }
}

/** 그날 이 규칙으로 할 일이 생기는지 (끝 · 횟수 · 멈춤 · 예외 포함) */
export function occursOn(r: RepeatRule, d: Date): boolean {
  if (r.paused || !matches(r, d)) return false;
  if (r.exceptions.includes(Dates.key(d))) return false;
  if (r.end.type === "until" && Dates.day(d) > Dates.day(r.end.until)) return false;
  if (r.end.type === "count") {
    // 시작일부터 그날까지 몇 번째인지 센다 (지운 날도 한 번으로 친다)
    let n = 0;
    for (let x = Dates.day(r.start); x <= Dates.day(d); x = Dates.addDays(1, x)) {
      if (matches(r, x)) n++;
      if (n > r.end.count) return false;
    }
  }
  return true;
}

/** from 부터 다음 k 번 (미리보기) */
export function nextOccurrences(r: RepeatRule, from: Date, k = 5, horizonDays = 800): Date[] {
  const out: Date[] = [];
  const start = Dates.day(from) < Dates.day(r.start) ? Dates.day(r.start) : Dates.day(from);
  for (let i = 0, x = start; i < horizonDays && out.length < k; i++, x = Dates.addDays(1, x)) {
    if (occursOn(r, x)) out.push(x);
  }
  return out;
}

/** 그날 만든 할 일의 id (같은 규칙 · 같은 날이면 늘 같다) */
export const occurrenceId = (r: RepeatRule, d: Date) => uuidV5(r.id, `repeat|${Dates.key(d)}`);
/** 그날 만든 타임테이블 일정의 id */
export const repeatEventId = (r: RepeatRule, d: Date) => uuidV5(r.id, `paint|${Dates.key(d)}`);

/** "매주 화 · 목", "2주마다 월요일", "매월 둘째 화요일" … */
export function describeRule(r: RepeatRule): string {
  const n = Math.max(1, r.interval);
  const s = Dates.day(r.start);
  let base: string;
  switch (r.freq) {
    case "daily": base = n === 1 ? "매일" : `${n}일마다`; break;
    case "weekly": base = `${n === 1 ? "매주" : `${n}주마다`} ${WEEKDAY_KO[weekdayIndex(s)]}요일`; break;
    case "weekdays": {
      const ds = [...r.weekdays].sort().map((i) => WEEKDAY_KO[i]);
      const label = ds.join("") === "월화수목금" ? "평일" : ds.join("") === "토일" ? "주말" : ds.join(" · ");
      base = `${n === 1 ? "매주" : `${n}주마다`} ${label || "(요일 없음)"}`;
      break;
    }
    case "monthly": {
      const head = n === 1 ? "매월" : `${n}달마다`;
      if (r.monthly === "last") base = `${head} 말일`;
      else if (r.monthly === "nth") {
        const k = nthOfMonth(s);
        base = `${head} ${k >= 5 ? "마지막" : NTH_KO[k - 1]} ${WEEKDAY_KO[weekdayIndex(s)]}요일`;
      } else base = `${head} ${s.getDate()}일`;
      break;
    }
    case "yearly": base = `${n === 1 ? "매년" : `${n}년마다`} ${s.getMonth() + 1}월 ${s.getDate()}일`; break;
  }
  const end = r.end.type === "until" ? ` · ${Dates.key(r.end.until)} 까지` : r.end.type === "count" ? ` · ${r.end.count}번` : "";
  const paint = r.paint ? ` · ${slotTime(r.paint.from)}–${slotTime(r.paint.to, true)} 칠하기` : "";
  return `${base}${paint}${end}${r.skipDayOff ? " · DAY OFF 빼고" : ""}${r.paused ? " · 멈춤" : ""}`;
}

// ── 파일 ─────────────────────────────────────────────

type Raw = Record<string, unknown>;

export function decodeRule(v: unknown): RepeatRule | null {
  const o = (v && typeof v === "object" ? v : {}) as Raw;
  const id = typeof o.id === "string" ? o.id.toUpperCase() : "";
  const start = Dates.fromISO(o.start);
  if (!id || !start) return null;
  const freq = (["daily", "weekly", "weekdays", "monthly", "yearly"] as const).find((f) => f === o.freq) ?? "daily";
  const monthly = (["date", "nth", "last"] as const).find((m) => m === o.monthly) ?? "date";
  const e = (o.end && typeof o.end === "object" ? o.end : {}) as Raw;
  const until = Dates.fromISO(e.until);
  const end: RepeatEnd = e.type === "until" && until ? { type: "until", until }
    : e.type === "count" && typeof e.count === "number" && e.count > 0 ? { type: "count", count: Math.floor(e.count) } : { type: "never" };
  return {
    id, text: typeof o.text === "string" ? o.text : "", cat: typeof o.cat === "number" ? o.cat : null, freq,
    interval: typeof o.interval === "number" && o.interval >= 1 ? Math.floor(o.interval) : 1,
    weekdays: Array.isArray(o.weekdays) ? o.weekdays.filter((x): x is number => typeof x === "number" && x >= 0 && x <= 6) : [],
    monthly, start, end, skipDayOff: o.skipDayOff === true, paused: o.paused === true,
    exceptions: Array.isArray(o.exceptions) ? o.exceptions.filter((x): x is string => typeof x === "string") : [],
    paint: decodePaint(o.paint),
    paintedDays: Array.isArray(o.paintedDays) ? o.paintedDays.filter((x): x is string => typeof x === "string") : [],
  };
}

function decodePaint(v: unknown): RepeatRule["paint"] {
  const o = (v && typeof v === "object" ? v : null) as Raw | null;
  if (!o || typeof o.from !== "number" || typeof o.to !== "number") return null;
  const a = Math.max(0, Math.min(143, Math.floor(o.from))), b = Math.max(0, Math.min(143, Math.floor(o.to)));
  return { from: Math.min(a, b), to: Math.max(a, b) };
}

export function encodeRule(r: RepeatRule): Raw {
  const o: Raw = { id: r.id, text: r.text, freq: r.freq, interval: r.interval, start: Dates.toISO(r.start), monthly: r.monthly };
  if (r.cat != null) o.cat = r.cat;
  if (r.freq === "weekdays") o.weekdays = [...r.weekdays].sort();
  o.end = r.end.type === "until" ? { type: "until", until: Dates.toISO(r.end.until) } : r.end.type === "count" ? { type: "count", count: r.end.count } : { type: "never" };
  if (r.skipDayOff) o.skipDayOff = true;
  if (r.paused) o.paused = true;
  if (r.exceptions.length) o.exceptions = r.exceptions;
  if (r.paint) o.paint = { from: r.paint.from, to: r.paint.to };
  if (r.paintedDays.length) o.paintedDays = r.paintedDays;
  return o;
}
