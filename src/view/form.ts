// 일간 양식 좌표 (디자인 단위, 페이지 1277 × 2000 — 원본 DailyForm)

export const PAGE_W = 1277;
export const PAGE_H = 2000;

export const dateRuleY = 72;
export const closeY = 366.7;
export const headerY = (dateRuleY + closeY) / 2;
export const gridTop = 444.5;
export const pitch = 76.12;
export const leftRows = 19;
export const taskCount = 15;
export const memoCount = 3;
export const memoRow = 16;
export const gridBottom = gridTop + leftRows * pitch;
export const hourPitch = (gridBottom - gridTop) / 24;
export const lineY = (r: number) => gridTop + r * pitch;
export const hourY = (r: number) => gridTop + r * hourPitch;

export const left = 55.4;
export const leftEnd = 793.9;
export const categoryX = 179.8;
export const boxMinX = 737.1;
export const boxSize = 43;
export const boxMidX = boxMinX + boxSize / 2;

export const timeLeft = 833.1;
export const cell = 56.27;
export const timeRight = timeLeft + 7 * cell;
export const slotsLeft = timeLeft + cell;

export const commentRuleX = 173.7;
export const commentMenuShift = 19;
export const totalRuleX = 949.1;
export const tasksRuleX = 131.2;
export const memoRuleX = 134.4;
export const timetableRuleX = 943.3;

export const heavy = 2.7;
export const medium = 1.35;
export const hair = 1.5;
export const dot = 2.1;
export const slotDot = 2.3;
export const boxDot = 3.5;
export const dotGap = 6.63;

export const tasksHeight = taskCount * pitch;
export const memoTop = lineY(memoRow);
export const memoHeight = memoCount * pitch;
export const taskPitch = (rows: number) => tasksHeight / Math.max(rows, 1);
export const memoPitch = (rows: number) => memoHeight / Math.max(rows, 1);

export interface Rect { x: number; y: number; w: number; h: number; }

export const inset = (r: Rect, t: number, l: number, b: number, rt: number): Rect =>
  ({ x: r.x + l, y: r.y + t, w: r.w - l - rt, h: r.h - t - b });

export const commentBox: Rect = { x: left, y: headerY, w: leftEnd - left, h: closeY - headerY };
export const totalBox: Rect = { x: timeLeft, y: headerY, w: timeRight - timeLeft, h: closeY - headerY };
export const dateBox: Rect = { x: left, y: dateRuleY, w: leftEnd - left, h: headerY - dateRuleY };
export const ddayBox: Rect = { x: timeLeft, y: dateRuleY, w: timeRight - timeLeft, h: headerY - dateRuleY };

export function box(r: number, rows: number): Rect {
  const p = taskPitch(rows);
  const size = Math.min(boxSize, p * 0.57);
  const mid = gridTop + (r + 0.5) * p;
  return { x: boxMidX - size / 2, y: mid - size / 2, w: size, h: size };
}

export const taskTextX = categoryX + 16;
export const taskTextWidth = boxMinX - 14 - taskTextX;

export const memoFont = 46;
export const memoTextX = categoryX + 16;
export const memoTextWidth = leftEnd - 12 - memoTextX;

/** 06시 시작. 12시간제 숫자 */
export const hourLabel = (row: number): string => {
  const h = (6 + row) % 24;
  return String(h % 12 === 0 ? 12 : h % 12);
};

export const place = (r: Rect): Record<string, string> =>
  ({ left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
