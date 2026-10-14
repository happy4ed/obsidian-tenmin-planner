// 날짜 계산. 원본(Dates)처럼 로컬 시간대 기준, 주는 월요일에 시작한다.
// 파일의 날짜 키는 로컬 "yyyy-MM-dd", 날짜 값은 ISO-8601 초 단위 UTC ("2026-11-01T15:00:00Z").

export function day(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function key(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function parseKey(k: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function addDays(n: number, d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** a 에서 b 까지 며칠 (날짜만 본다, 서머타임에도 정수) */
export function daysBetween(a: Date, b: Date): number {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / 86_400_000);
}

/** 그 주의 월요일 */
export function weekStart(d: Date): Date {
  const x = day(d);
  const back = (x.getDay() + 6) % 7;
  return addDays(-back, x);
}

export function isToday(d: Date, now: Date = new Date()): boolean {
  return key(d) === key(now);
}

/** 파일에 쓰는 날짜 모양: 초까지, UTC "Z" (Swift JSONEncoder .iso8601 과 같다) */
export function toISO(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function fromISO(s: unknown): Date | null {
  if (typeof s !== "string") return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t);
}

export const weekdayEN = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
export const monthEN = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export function formatHM(minutes: number): [string, string] {
  return [String(Math.floor(minutes / 60)), String(minutes % 60).padStart(2, "0")];
}
