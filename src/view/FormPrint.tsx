// 종이에 인쇄된 일간 양식 (선 · 점선 · 체크 박스 · 라벨 · 시각 숫자). 원본 DailyFormPrint 를 SVG 로.
import * as F from "./form";
import { Ink } from "./theme";

const LABEL_FONT = `"Avenir Next", "Segoe UI", Inter, system-ui, sans-serif`;

function HLine({ x0, x1, y, w, c }: { x0: number; x1: number; y: number; w: number; c: string }) {
  return <rect x={x0} y={y - w / 2} width={x1 - x0} height={w} fill={c} />;
}

/** a → b 를 gap 에 가까운 등간격으로 나눠 점 */
function dots(ax: number, ay: number, bx: number, by: number, gap: number, size: number, ends = true): [number, number][] {
  const len = Math.hypot(bx - ax, by - ay);
  const n = Math.max(1, Math.round(len / gap));
  const out: [number, number][] = [];
  for (let i = ends ? 0 : 1; i <= (ends ? n : n - 1); i++) {
    const t = i / n;
    out.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
  }
  return out;
}

/** 라벨: 글꼴이 원본(Avenir Next)과 달라도 머리선 앞에 딱 맞게 폭(len)을 고정한다 */
function Label({ text, x, ruleY, dy, size, weight, len }: { text: string; x: number; ruleY: number; dy: number; size: number; weight: number; len: number }) {
  return (
    <text x={x} y={ruleY + dy} dominant-baseline="central" font-family={LABEL_FONT} font-size={size}
      font-weight={weight} fill={Ink.print} textLength={len} lengthAdjust="spacingAndGlyphs">{text}</text>
  );
}

export function FormPrint({ taskRows, memoRows, commentMenu }: { taskRows: number; memoRows: number; commentMenu: boolean }) {
  const ink = Ink.print, hair = Ink.rule;
  const tp = F.taskPitch(taskRows), mp = F.memoPitch(memoRows);
  const circles: [number, number, number, string][] = [];
  for (const [x, y] of dots(F.categoryX, F.lineY(0) + 7.2, F.categoryX, F.lineY(F.taskCount) - 1.2, F.dotGap, F.dot)) circles.push([x, y, F.dot / 2, Ink.dot]);
  for (const [x, y] of dots(F.categoryX, F.lineY(F.memoRow) + 18.5, F.categoryX, F.gridBottom - 4.5, F.dotGap, F.dot)) circles.push([x, y, F.dot / 2, "rgba(181,177,169,.55)"]);
  for (let k = 2; k <= 6; k++) {
    const x = F.timeLeft + k * F.cell;
    for (const [px, py] of dots(x, F.gridTop + 6.8, x, F.gridBottom - 5.8, F.dotGap, F.slotDot)) circles.push([px, py, F.slotDot / 2, Ink.dot]);
  }
  for (let i = 0; i < taskRows; i++) {
    const b = F.box(i, taskRows);
    const step = b.w / 6;
    const c: [number, number][] = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]];
    for (let s = 0; s < 4; s++) {
      const [a, z] = [c[s], c[(s + 1) % 4]];
      for (const [px, py] of dots(a[0], a[1], z[0], z[1], step, F.boxDot, s === 0 || s === 2)) circles.push([px, py, F.boxDot / 2, Ink.dot]);
    }
  }
  const light = 19.35, bold = 19.8;
  return (
    <svg class="tmp-form" viewBox={`0 0 ${F.PAGE_W} ${F.PAGE_H}`} width={F.PAGE_W} height={F.PAGE_H} aria-hidden="true">
      {/* DATE · D-DAY */}
      <Label text="DATE" x={F.left + 0.7} ruleY={F.dateRuleY} dy={0.5} size={light} weight={500} len={52} />
      <HLine x0={F.left + 70} x1={F.leftEnd} y={F.dateRuleY} w={F.heavy} c={ink} />
      <Label text="D-DAY" x={F.timeLeft} ruleY={F.dateRuleY} dy={-0.7} size={bold} weight={600} len={64} />
      <HLine x0={F.timeLeft + 80} x1={F.timeRight} y={F.dateRuleY} w={F.heavy} c={ink} />
      {/* COMMENT · TOTAL TIME */}
      <Label text="COMMENT" x={F.left + 0.7} ruleY={F.headerY} dy={0.5} size={light} weight={500} len={103.6} />
      <HLine x0={F.commentRuleX + (commentMenu ? F.commentMenuShift : 0)} x1={F.leftEnd} y={F.headerY} w={F.heavy} c={ink} />
      <Label text="TOTAL TIME" x={F.timeLeft} ruleY={F.headerY} dy={-0.7} size={bold} weight={600} len={F.totalRuleX - F.timeLeft - 12} />
      <HLine x0={F.totalRuleX} x1={F.timeRight} y={F.headerY} w={F.heavy} c={ink} />
      <HLine x0={F.left} x1={F.leftEnd} y={F.closeY} w={F.heavy} c={ink} />
      <HLine x0={F.timeLeft} x1={F.timeRight} y={F.closeY} w={F.heavy} c={ink} />
      {/* TASKS */}
      <Label text="TASKS" x={F.left + 1} ruleY={F.gridTop} dy={-1.2} size={bold} weight={600} len={F.tasksRuleX - F.left - 13} />
      <HLine x0={F.tasksRuleX} x1={F.leftEnd} y={F.lineY(0)} w={F.heavy} c={ink} />
      {Array.from({ length: taskRows - 1 }, (_, i) => i + 1).map((r) => (
        <HLine key={`t${r}`} x0={F.left} x1={F.leftEnd} y={F.gridTop + r * tp} w={r % 5 === 0 ? F.medium : F.hair} c={r % 5 === 0 ? ink : hair} />
      ))}
      <HLine x0={F.left} x1={F.leftEnd} y={F.lineY(F.taskCount)} w={F.heavy} c={ink} />
      {/* MEMO */}
      <Label text="MEMO" x={F.left} ruleY={F.lineY(F.memoRow)} dy={-1.7} size={light} weight={500} len={F.memoRuleX - F.left - 13} />
      <HLine x0={F.memoRuleX} x1={F.leftEnd} y={F.memoTop} w={F.heavy} c={ink} />
      {Array.from({ length: memoRows - 1 }, (_, i) => i + 1).map((r) => (
        <HLine key={`m${r}`} x0={F.left} x1={F.leftEnd} y={F.memoTop + r * mp} w={F.hair} c={hair} />
      ))}
      <HLine x0={F.left} x1={F.leftEnd} y={F.gridBottom} w={F.heavy} c={ink} />
      {/* TIMETABLE */}
      <Label text="TIMETABLE" x={F.timeLeft} ruleY={F.gridTop} dy={-1.4} size={bold} weight={600} len={F.timetableRuleX - F.timeLeft - 12} />
      <HLine x0={F.timetableRuleX} x1={F.timeRight} y={F.hourY(0)} w={F.heavy} c={ink} />
      {Array.from({ length: 23 }, (_, i) => i + 1).map((r) => (
        <HLine key={`h${r}`} x0={F.timeLeft} x1={F.timeRight} y={F.hourY(r)} w={F.hair} c={hair} />
      ))}
      <HLine x0={F.timeLeft} x1={F.timeRight} y={F.hourY(24)} w={F.heavy} c={ink} />
      <rect x={F.slotsLeft - 1.35 / 2} y={F.gridTop + 18.5} width={1.35} height={F.gridBottom - F.gridTop - 18.5} fill={hair} />
      {Array.from({ length: 24 }, (_, r) => (
        <text key={`n${r}`} x={F.timeLeft + F.cell / 2 + 0.6} y={F.hourY(r) + F.hourPitch / 2 + 0.7} text-anchor="middle"
          dominant-baseline="central" font-family={LABEL_FONT} font-size={23.1} font-weight={700} fill={ink}
          letter-spacing={hourLabelSpacing(r)}>{labelFor(r)}</text>
      ))}
      {circles.map(([x, y, r, c], i) => <circle key={`d${i}`} cx={x} cy={y} r={r} fill={c} />)}
    </svg>
  );
}

const labelFor = (r: number) => { const h = (6 + r) % 24; return String(h % 12 === 0 ? 12 : h % 12); };
const hourLabelSpacing = (r: number) => (labelFor(r).length > 1 ? -3 : 0);
