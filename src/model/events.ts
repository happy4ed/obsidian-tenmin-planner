// 타임테이블 일정 (이 플러그인에서 원본과 갈라선 부분).
// 원본은 10분 칸마다 색 하나만 기억해서, 연달아 있는 두 일정이나 겹치는 일정을 구분할 수 없었다.
// 여기서는 일정 하나하나를 저장한다: 시작 · 끝 칸 (0 = 06:00, 끝 칸 포함, 10분 단위), 형광펜, 제목 · 내용 · 장소.
// 칸 색(slots)은 일정에서 계산해 두는 값이다 (통계 · TOTAL TIME · 주간 합계가 그대로 쓴다. 겹치면 나중 일정 색).

import { SLOT_COUNT } from "./types";
import { UUID } from "./uuid";

export interface TimeEvent {
  id: UUID;
  from: number;
  to: number;
  cat: number | null;
  title: string;
  note: string;
  place: string;
}

const clampSlot = (n: number) => Math.max(0, Math.min(SLOT_COUNT - 1, Math.floor(n)));

export function normEvent(e: TimeEvent): TimeEvent {
  const a = clampSlot(e.from), b = clampSlot(e.to);
  return { ...e, from: Math.min(a, b), to: Math.max(a, b) };
}

/** 일정에서 칸 색을 계산한다. 겹치면 목록에서 나중 일정 색 (보이는 맨 위 색과 같다) */
export function slotsFromEvents(events: TimeEvent[]): number[] {
  const s = Array(SLOT_COUNT).fill(-1);
  for (const e of events) {
    if (e.cat == null) continue;
    for (let i = e.from; i <= e.to; i++) s[i] = e.cat;
  }
  return s;
}

/** 예전 칸 색에서 일정을 만든다: 이어진 같은 색 덩어리 하나 = 일정 하나 */
export function eventsFromSlots(slots: number[], newId: () => UUID): TimeEvent[] {
  const out: TimeEvent[] = [];
  let i = 0;
  while (i < slots.length) {
    const v = slots[i];
    if (v < 0) { i++; continue; }
    let j = i;
    while (j + 1 < slots.length && slots[j + 1] === v) j++;
    out.push({ id: newId(), from: i, to: j, cat: v, title: "", note: "", place: "" });
    i = j + 1;
  }
  return out;
}

/** 지우개: a ~ b 칸을 일정에서 잘라낸다. 다 들어가면 지우고, 가운데면 둘로 나눈다 */
export function subtractRange(events: TimeEvent[], a: number, b: number, newId: () => UUID): TimeEvent[] {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  const out: TimeEvent[] = [];
  for (const e of events) {
    if (e.to < lo || e.from > hi) { out.push(e); continue; }
    if (e.from < lo) out.push({ ...e, to: lo - 1 });
    if (e.to > hi) out.push({ ...e, id: e.from < lo ? newId() : e.id, from: hi + 1 });
  }
  return out;
}

/** 형광펜별 칠한 분 (겹친 같은 형광펜 시간은 한 번) */
export function minutesByCat(events: TimeEvent[]): Map<number, number> {
  const per = new Map<number, Set<number>>();
  for (const e of events) {
    if (e.cat == null) continue;
    const s = per.get(e.cat) ?? new Set<number>();
    for (let i = e.from; i <= e.to; i++) s.add(i);
    per.set(e.cat, s);
  }
  return new Map([...per].map(([k, s]) => [k, s.size * 10]));
}

/** TOTAL TIME: counted 형광펜 일정이 덮은 시간 (겹친 시간은 한 번) */
export function countedMinutes(events: TimeEvent[], counted: Set<number>): number {
  const s = new Set<number>();
  for (const e of events) {
    if (e.cat == null || !counted.has(e.cat)) continue;
    for (let i = e.from; i <= e.to; i++) s.add(i);
  }
  return s.size * 10;
}

/** 칸 번호 → 그 일정이 놓인 줄 조각들 (줄 = 한 시간, 6칸) */
export function segments(e: TimeEvent, cols = 6): { row: number; c0: number; c1: number; first: boolean; last: boolean }[] {
  const out = [];
  for (let r = Math.floor(e.from / cols); r <= Math.floor(e.to / cols); r++) {
    const c0 = r === Math.floor(e.from / cols) ? e.from % cols : 0;
    const c1 = r === Math.floor(e.to / cols) ? e.to % cols : cols - 1;
    out.push({ row: r, c0, c1, first: r === Math.floor(e.from / cols), last: r === Math.floor(e.to / cols) });
  }
  return out;
}

type Raw = Record<string, unknown>;

export function decodeEvent(v: unknown): TimeEvent | null {
  const o = (v && typeof v === "object" ? v : {}) as Raw;
  if (typeof o.id !== "string" || typeof o.from !== "number" || typeof o.to !== "number") return null;
  return normEvent({
    id: o.id.toUpperCase(), from: o.from, to: o.to, cat: typeof o.cat === "number" ? o.cat : null,
    title: typeof o.title === "string" ? o.title : "", note: typeof o.note === "string" ? o.note : "",
    place: typeof o.place === "string" ? o.place : "",
  });
}

export function encodeEvent(e: TimeEvent): Raw {
  const o: Raw = { id: e.id, from: e.from, to: e.to };
  if (e.cat != null) o.cat = e.cat;
  if (e.title) o.title = e.title;
  if (e.note) o.note = e.note;
  if (e.place) o.place = e.place;
  return o;
}
