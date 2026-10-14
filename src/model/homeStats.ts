// 홈(통계) 숫자. PlannerData 를 받아 계산만 하는 순수 함수 (원본 HomeStats.make).
// - "기록한 날" = 타임테이블에 (지금 있는) 형광펜을 한 칸이라도 칠한 날.
// - DAY OFF 는 기록한 날로 세지 않지만 연속 기록을 끊지도 않는다 (건너뛴다).
// - 시간 합계는 TOTAL TIME 과 같이 counts 인 형광펜만 더한다.
// 날짜 키 "yyyy-MM-dd" 는 정수 일련번호(1970-01-01 = 0)로 바꿔 정수로 비교한다.

import * as Dates from "./dates";
import { Mark, PlannerData, SLOT_COUNT } from "./types";

export const WEEK_COUNT = 12;
export const WEEKDAY_WEEKS = 8;
export const HEAT_DAYS = 28;
export const CALENDAR_WEEKS = 5;

export interface WeekStat { start: Date; offset: number; minutes: number; byCategory: number[]; }
export interface CategoryTotal { id: number; minutes: number; counts: boolean; }
export interface HeatCell { category: number | null; ratio: number; }
export interface DayCell { date: Date; minutes: number; recorded: boolean; theme: number | null; isToday: boolean; isFuture: boolean; dayOff: boolean; }

export interface HomeStats {
  weekMinutes: number;
  monthMinutes: number;
  monthDays: number;
  daysInMonth: number;
  month: number;
  streak: number;
  streakIncludesToday: boolean;
  todayOff: boolean;
  done: number; partial: number; missed: number; moved: number; unmarked: number;
  weeks: WeekStat[];
  categories: CategoryTotal[];
  weekdayAverage: number[];
  heat: HeatCell[];
  peakHour: number | null;
  calendar: DayCell[];
  hasTime: boolean;
}

export const marked = (s: HomeStats) => s.done + s.partial + s.missed + s.moved;
export const completion = (s: HomeStats): number | null => (marked(s) > 0 ? s.done / marked(s) : null);
export const dailyAverage = (s: HomeStats) => (s.monthDays > 0 ? Math.floor(s.monthMinutes / s.monthDays) : 0);

/** 그레고리력 날짜 → 일련번호 (H. Hinnant, days_from_civil) */
export function civilOrdinal(year: number, m: number, d: number): number {
  const y = m <= 2 ? year - 1 : year;
  const era = Math.trunc((y >= 0 ? y : y - 399) / 400);
  const yoe = y - era * 400;
  const doy = Math.trunc((153 * ((m + 9) % 12) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.trunc(yoe / 4) - Math.trunc(yoe / 100) + doy;
  return era * 146_097 + doe - 719_468;
}

export function ordinal(key: string): number | null {
  const m = /^(\d+)-(\d+)-(\d+)$/.exec(key);
  if (!m) return null;
  const mo = Number(m[2]), d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return civilOrdinal(Number(m[1]), mo, d);
}

/** 월 = 0 … 일 = 6 (1970-01-01 은 목요일) */
export const weekdayOf = (o: number) => (((o + 3) % 7) + 7) % 7;

const idiv = (a: number, b: number) => Math.floor(a / b);

export function makeHomeStats(data: PlannerData, now: Date): HomeStats {
  const cats = data.prefs.categories;
  const nc = cats.length;
  const index = new Map<number, number>();
  cats.forEach((c, i) => { if (c.id >= 0) index.set(c.id, i); });
  const slot = (v: number) => (v >= 0 ? index.get(v) ?? -1 : -1);
  const counted = cats.map((c) => c.counts);

  const today = Dates.day(now);
  const t = civilOrdinal(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const weekStart = t - weekdayOf(t);
  const month = today.getMonth() + 1;
  const year = today.getFullYear();

  const weeksFrom = weekStart - 7 * (WEEK_COUNT - 1), weeksTo = weekStart + 6;
  const monthFrom = civilOrdinal(year, month, 1);
  const monthTo = (month === 12 ? civilOrdinal(year + 1, 1, 1) : civilOrdinal(year, month + 1, 1)) - 1;
  const weekdayFrom = t - 7 * WEEKDAY_WEEKS + 1;
  const heatFrom = t - HEAT_DAYS + 1;
  const calFrom = weekStart - 7 * (CALENDAR_WEEKS - 1);
  const calCount = 7 * CALENDAR_WEEKS;

  const s: HomeStats = {
    weekMinutes: 0, monthMinutes: 0, monthDays: 0, daysInMonth: monthTo - monthFrom + 1, month,
    streak: 0, streakIncludesToday: false, todayOff: false,
    done: 0, partial: 0, missed: 0, moved: 0, unmarked: 0,
    weeks: [], categories: [], weekdayAverage: Array(7).fill(0),
    heat: Array.from({ length: SLOT_COUNT }, () => ({ category: null, ratio: 0 })), peakHour: null, calendar: [], hasTime: false,
  };

  const weekMin = Array(WEEK_COUNT).fill(0);
  const weekCat = Array(WEEK_COUNT * nc).fill(0);
  const monthCat = Array(nc).fill(0);
  const weekdaySum = Array(7).fill(0);
  const heatCount = Array(SLOT_COUNT * Math.max(nc, 1)).fill(0);
  const calMin = Array(calCount).fill(0);
  const calRec = Array(calCount).fill(false);
  const calTheme: (number | null)[] = Array(calCount).fill(null);
  const calOff = Array(calCount).fill(false);
  const recordedPast = new Set<number>();
  const offPast = new Set<number>();
  let firstRecorded = Number.MAX_SAFE_INTEGER;
  const perCat = Array(nc).fill(0);

  for (const [key, day] of Object.entries(data.days)) {
    const o = ordinal(key);
    if (o == null) continue;
    perCat.fill(0);
    let painted = 0;
    for (const v of day.slots) { const i = slot(v); if (i >= 0) { perCat[i]++; painted++; } }
    let minutes = 0;
    for (let i = 0; i < nc; i++) if (counted[i]) minutes += perCat[i] * 10;
    const recorded = painted > 0;
    if (day.dayOff && o <= t) offPast.add(o);
    if (recorded) {
      s.hasTime = true;
      firstRecorded = Math.min(firstRecorded, o);
      if (o <= t) recordedPast.add(o);
    }
    if (o >= weeksFrom && o <= weeksTo) {
      const w = idiv(o - weeksFrom, 7);
      weekMin[w] += minutes;
      for (let i = 0; i < nc; i++) if (counted[i]) weekCat[w * nc + i] += perCat[i] * 10;
    }
    if (o >= monthFrom && o <= monthTo) {
      s.monthMinutes += minutes;
      if (recorded) s.monthDays++;
      for (let i = 0; i < nc; i++) monthCat[i] += perCat[i] * 10;
      for (const task of day.tasks) {
        if (task.mark === Mark.done) s.done++;
        else if (task.mark === Mark.partial) s.partial++;
        else if (task.mark === Mark.missed) s.missed++;
        else if (task.mark === Mark.moved) s.moved++;
        else s.unmarked++;
      }
    }
    if (o >= weekdayFrom && o <= t) weekdaySum[weekdayOf(o)] += minutes;
    if (recorded && nc > 0 && o >= heatFrom && o <= t) {
      day.slots.forEach((v, k) => { const i = slot(v); if (i >= 0) heatCount[k * nc + i]++; });
    }
    if (o >= calFrom && o < calFrom + calCount) {
      calMin[o - calFrom] = minutes;
      calRec[o - calFrom] = recorded;
      calTheme[o - calFrom] = day.theme;
      calOff[o - calFrom] = day.dayOff;
    }
  }

  s.weeks = Array.from({ length: WEEK_COUNT }, (_, w) => ({
    start: Dates.addDays(weeksFrom + 7 * w - t, today), offset: w - (WEEK_COUNT - 1),
    minutes: weekMin[w], byCategory: weekCat.slice(w * nc, w * nc + nc),
  }));
  s.weekMinutes = weekMin[WEEK_COUNT - 1];

  s.categories = cats.map((c, i) => ({ id: c.id, minutes: monthCat[i], counts: c.counts, i }))
    .sort((a, b) => (a.minutes !== b.minutes ? b.minutes - a.minutes : a.i - b.i))
    .map(({ id, minutes, counts }) => ({ id, minutes, counts }));

  s.streakIncludesToday = recordedPast.has(t);
  s.todayOff = offPast.has(t);
  let o = s.streakIncludesToday || s.todayOff ? t : t - 1;
  for (;;) {
    if (recordedPast.has(o)) s.streak++;
    else if (!offPast.has(o)) break;
    o--;
  }

  if (firstRecorded <= t) {
    const from = Math.max(weekdayFrom, firstRecorded);
    const n = Array(7).fill(0);
    for (let d = from; d <= t; d++) n[weekdayOf(d)]++;
    s.weekdayAverage = n.map((x, i) => (x > 0 ? idiv(weekdaySum[i], x) : 0));
  }

  if (firstRecorded <= t && nc > 0) {
    const seen = t - Math.max(heatFrom, firstRecorded) + 1;
    const hourFill = Array(24).fill(0);
    s.heat = Array.from({ length: SLOT_COUNT }, (_, k) => {
      let best = -1, bestN = 0, total = 0;
      for (let i = 0; i < nc; i++) {
        const c = heatCount[k * nc + i];
        total += c;
        if (c > bestN) { best = i; bestN = c; }
      }
      hourFill[idiv(k, 6)] += total;
      return { category: best >= 0 ? cats[best].id : null, ratio: Math.min(1, total / seen) };
    });
    const m = Math.max(...hourFill);
    if (m > 0) s.peakHour = hourFill.indexOf(m);
  }

  s.calendar = Array.from({ length: calCount }, (_, i) => {
    const od = calFrom + i;
    return {
      date: Dates.addDays(od - t, today), minutes: calMin[i], recorded: calRec[i], theme: calTheme[i],
      isToday: od === t, isFuture: od > t, dayOff: calOff[i],
    };
  });
  return s;
}
