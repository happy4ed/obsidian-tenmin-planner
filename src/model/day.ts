// 하루 기록의 규칙 (원본 DayRecord · DailyForm). 할 일은 TASKS 의 아무 줄에나 쓰고(row),
// tasks 배열은 늘 줄 순서로 둔다. 모든 함수는 받은 기록을 그 자리에서 고친다.

import { DayRecord, PlanTask } from "./types";
import { emptyRows, flowLayout, owner, RowLayout, rowLayout, span, Wrap } from "./ruled";
import { UUID, sameUUID } from "./uuid";

/** 일간 양식 숫자 (디자인 단위, 원본 DailyForm) */
export const TASK_COUNT = 15;
export const TASK_FONT = 46;
const CATEGORY_X = 179.8;
const BOX_MIN_X = 737.1;
/** 할 일 글 칸 폭에서 12 를 뺀 줄바꿈 계산 폭 */
export const TASK_WRAP_WIDTH = BOX_MIN_X - 14 - (CATEGORY_X + 16) - 12;

export function taskLayout(tasks: PlanTask[], wrap: Wrap): RowLayout {
  return rowLayout(tasks.map((t) => ({ row: t.row ?? 0, text: t.text })), TASK_COUNT, TASK_FONT, TASK_WRAP_WIDTH, wrap);
}

export function legacyTaskRows(texts: string[], wrap: Wrap): number[] {
  return flowLayout(texts, TASK_COUNT, TASK_FONT, TASK_WRAP_WIDTH, wrap).start;
}

/** 같은 형광펜끼리 모은다. 묶음 순서는 처음 나온 순서, 묶음 안 순서는 그대로 */
export function grouped(tasks: PlanTask[]): PlanTask[] {
  const order: (number | null)[] = [];
  const buckets = new Map<number | null, PlanTask[]>();
  for (const t of tasks) {
    if (!buckets.has(t.cat)) { order.push(t.cat); buckets.set(t.cat, []); }
    buckets.get(t.cat)!.push(t);
  }
  return order.flatMap((c) => buckets.get(c) ?? []);
}

export function hasRecord(d: DayRecord): boolean {
  return !(d.tasks.length === 0 && d.slots.every((s) => s < 0) && d.events.length === 0 && d.comment === ""
    && d.memos.every((m) => m === "") && d.memoTags.every((m) => m === "") && d.theme == null && d.notes.length === 0);
}

export const isEmptyDay = (d: DayRecord): boolean => !hasRecord(d) && d.ddays.length === 0 && !d.dayOff;

/** 모든 할 일에 줄이 있고, 줄 순서대로 놓여 있고, 겹치지 않는지 */
export function taskRowsReady(d: DayRecord): boolean {
  let last = -1;
  for (const t of d.tasks) {
    if (t.row == null || t.row <= last) return false;
    last = t.row;
  }
  return true;
}

const byRow = (a: PlanTask, b: PlanTask) => a.row! - b.row!;

/** 줄 번호가 없는 할 일에 줄을 매기고 줄 순서로 놓는다 */
export function assignTaskRows(d: DayRecord, wrap: Wrap): void {
  if (taskRowsReady(d)) return;
  if (d.tasks.every((t) => t.row == null)) {
    // 1.0.4 까지의 기록: 그때 보이던 그대로 (같은 형광펜끼리 모은 순서, 긴 할 일이 이어 쓰던 줄까지)
    const g = grouped(d.tasks);
    const starts = legacyTaskRows(g.map((t) => t.text), wrap);
    d.tasks = g.map((t, i) => ({ ...t, row: i < starts.length ? starts[i] : i }));
    return;
  }
  const used = new Set<number>();
  const pending: number[] = [];
  const order = d.tasks.map((_, i) => i).sort((a, b) => {
    const ra = d.tasks[a].row ?? Number.MAX_SAFE_INTEGER, rb = d.tasks[b].row ?? Number.MAX_SAFE_INTEGER;
    return ra !== rb ? ra - rb : a - b;
  });
  for (const i of order) {
    const r = d.tasks[i].row;
    if (r != null && r >= 0 && !used.has(r)) { used.add(r); continue; }
    pending.push(i);
  }
  let next = 0;
  for (const i of pending) {
    while (used.has(next)) next++;
    d.tasks[i] = { ...d.tasks[i], row: next };
    used.add(next);
  }
  d.tasks = order.map((i) => d.tasks[i]).sort(byRow);
}

/** 할 일이 쓰고 있는 마지막 줄 (긴 할 일이 이어 쓴 줄까지). 맞는 할 일이 없으면 null */
export function lastTaskLine(d: DayRecord, which: (t: PlanTask) => boolean, wrap: Wrap): number | null {
  const L = taskLayout(d.tasks, wrap);
  for (let i = d.tasks.length - 1; i >= 0; i--) {
    if (which(d.tasks[i])) return L.items[i].row + span(L.items[i]) - 1;
  }
  return null;
}

/** 새 할 일을 놓을 줄: after 아래 첫 빈 줄 → 맨 위부터 첫 빈 줄 → 맨 끝에 한 줄 더 */
export function freeTaskRow(d: DayRecord, after: number, wrap: Wrap): number {
  const L = taskLayout(d.tasks, wrap);
  const empty = emptyRows(L);
  const r = empty.find((x) => x > after) ?? empty[0];
  return r ?? L.rows;
}

/** row 줄에 할 일을 넣는다 (그 줄을 다른 할 일이 쓰고 있으면 그 아래 빈 줄에). 넣은 줄을 돌려준다 */
export function insertTask(d: DayRecord, t: PlanTask, row: number, wrap: Wrap): number {
  assignTaskRows(d, wrap);
  const L = taskLayout(d.tasks, wrap);
  const r = row < 0 || owner(L, row) != null ? freeTaskRow(d, row, wrap) : row;
  d.tasks.push({ ...t, row: r });
  d.tasks.sort(byRow);
  return r;
}

/** row 줄에 끼워 넣는다. 그 줄부터 이어진 할 일들은 빈 줄이 나올 때까지 한 줄씩 아래로 */
export function insertShifting(d: DayRecord, t: PlanTask, row: number, wrap: Wrap): number {
  assignTaskRows(d, wrap);
  let cursor = row + 1;
  for (let k = 0; k < d.tasks.length; k++) {
    const r = d.tasks[k].row!;
    if (r < row) continue;
    if (r >= cursor) break; // 빈 줄을 만나면 멈춘다
    d.tasks[k] = { ...d.tasks[k], row: cursor };
    cursor++;
  }
  d.tasks.push({ ...t, row });
  d.tasks.sort(byRow);
  return row;
}

/** → 로 넘어온 할 일: 같은 형광펜 묶음 바로 아래 → 없으면 빈 줄 → 없으면 맨 끝 */
export function insertCarried(d: DayRecord, t: PlanTask, wrap: Wrap): number {
  assignTaskRows(d, wrap);
  if (t.cat != null) {
    const end = lastTaskLine(d, (x) => x.cat === t.cat, wrap);
    if (end != null) return insertShifting(d, t, end + 1, wrap);
  }
  const after = lastTaskLine(d, (x) => x.cat === t.cat, wrap) ?? -1;
  return insertTask(d, t, freeTaskRow(d, after, wrap), wrap);
}

/** 형광펜을 고른 할 일을 같은 형광펜 묶음으로 옮긴다 (이미 붙어 있으면 그대로) */
export function joinCategoryGroup(d: DayRecord, id: UUID, wrap: Wrap): void {
  assignTaskRows(d, wrap);
  const i = d.tasks.findIndex((t) => sameUUID(t.id, id));
  if (i < 0) return;
  const cat = d.tasks[i].cat;
  if (cat == null) return;
  const L = taskLayout(d.tasks, wrap);
  const others = d.tasks.map((_, k) => k).filter((k) => k !== i && d.tasks[k].cat === cat);
  if (others.length === 0) return;
  const start = L.items[i].row, end = start + span(L.items[i]);
  if (others.some((k) => L.items[k].row + span(L.items[k]) === start || L.items[k].row === end)) return;
  const [t] = d.tasks.splice(i, 1);
  const groupEnd = lastTaskLine(d, (x) => x.cat === cat, wrap);
  if (groupEnd == null) { d.tasks.splice(i, 0, t); return; }
  insertShifting(d, t, groupEnd + 1, wrap);
}

/**
 * 끌어 칠하기의 한 걸음: 이번 범위만 value 로 칠하고, 지난 걸음에 칠했지만 이번 범위 밖인 칸만 붓질 전 값으로 되돌린다.
 * range 가 null 이면 칠한 칸을 모두 되돌린다 (붓질 취소).
 */
export function repainted(current: number[], before: number[], previous: [number, number] | null,
  range: [number, number] | null, value: number): number[] {
  const next = current.slice();
  const inRange = (i: number) => range != null && i >= range[0] && i <= range[1];
  if (previous) {
    for (let i = previous[0]; i <= previous[1]; i++) {
      if (i >= 0 && i < next.length && i < before.length && !inRange(i)) next[i] = before[i];
    }
  }
  if (range) for (let i = range[0]; i <= range[1]; i++) if (i >= 0 && i < next.length) next[i] = value;
  return next;
}
