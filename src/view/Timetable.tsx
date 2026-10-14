// 타임테이블: 형광펜을 골라 10분 칸을 끌어 칠한다 (원본 SlotPainter).
// - 시작 칸 ~ 지금 칸 사이를 행 우선(읽는 순서)으로 칠한다 (사각형이 아니다). 칸 번호 = 행 × 6 + 열.
// - 시작 칸이 이미 같은 색이면 그 끌기 전체가 지우기. 범위가 줄면 줄어든 칸만 붓질 전 값으로.
// - 지우개: 칸을 비우고, 놓을 때 범위와 겹치는 글씨 메모 · 밥시간도 지운다.
import { useRef } from "preact/hooks";
import * as F from "./form";
import { ERASER, useCtx } from "./ctx";
import { hex } from "./theme";
import { repainted } from "../model/day";
import { TimeNote } from "../model/types";
import { TEXT_SCALE } from "../canvasWrap";

const COLS = 6, ROWS = 24;
const W = COLS * F.cell, H = ROWS * F.hourPitch;

interface Stroke { start: number; before: number[]; previous: [number, number] | null; value: number; last: number; }

export function Timetable({ slots, notes, accent }: { slots: number[]; notes: TimeNote[]; accent: string }) {
  const c = useCtx();
  const { planner: p, date } = c;
  const stroke = useRef<Stroke | null>(null);
  const el = useRef<HTMLDivElement>(null);

  const slotAt = (e: PointerEvent): number => {
    const r = el.current!.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const y = ((e.clientY - r.top) / r.height) * H;
    const col = Math.min(COLS - 1, Math.max(0, Math.floor(x / F.cell)));
    const row = Math.min(ROWS - 1, Math.max(0, Math.floor(y / F.hourPitch)));
    return row * COLS + col;
  };

  const paint = (cur: number) => {
    const s = stroke.current!;
    const range: [number, number] = [Math.min(s.start, cur), Math.max(s.start, cur)];
    const now = p.day(date).slots;
    p.setSlots(date, repainted(now, s.before, s.previous, range, s.value));
    s.previous = range;
    s.last = cur;
  };

  const down = (e: PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    c.setEditing(null);
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* 합성 이벤트 등 */ }
    const start = slotAt(e);
    const before = p.day(date).slots;
    const value = c.tool === ERASER ? -1 : before[start] === c.tool ? -1 : c.tool;
    stroke.current = { start, before, previous: null, value, last: start };
    paint(start);
  };

  const move = (e: PointerEvent) => {
    if (!stroke.current) return;
    const cur = slotAt(e);
    if (cur !== stroke.current.last) paint(cur);
  };

  const up = () => {
    const s = stroke.current;
    stroke.current = null;
    if (s && c.tool === ERASER && s.previous) p.removeNotes(date, s.previous[0], s.previous[1]);
  };

  const cancel = () => {
    const s = stroke.current;
    stroke.current = null;
    if (s) p.setSlots(date, repainted(p.day(date).slots, s.before, s.previous, null, s.value));
  };

  // 이어진 같은 색은 한 막대로
  const bars: { row: number; c0: number; c1: number; color: string }[] = [];
  for (let row = 0; row < ROWS; row++) {
    let col = 0;
    while (col < COLS) {
      const v = slots[row * COLS + col];
      const cat = v >= 0 ? p.category(v) : undefined;
      if (!cat) { col++; continue; }
      let end = col;
      while (end + 1 < COLS && slots[row * COLS + end + 1] === v) end++;
      bars.push({ row, c0: col, c1: end, color: hex(cat.hex) });
      col = end + 1;
    }
  }

  return (
    <div ref={el} class={`tmp-timetable ${c.tool === ERASER ? "is-eraser" : ""}`}
      style={F.place({ x: F.slotsLeft, y: F.gridTop, w: W, h: H })}
      onPointerDown={down as never} onPointerMove={move as never} onPointerUp={up} onPointerCancel={cancel}>
      {bars.map((b) => (
        <div key={`${b.row}-${b.c0}`} class="tmp-bar" style={{
          left: `${b.c0 * F.cell + 1}px`, top: `${b.row * F.hourPitch + 4}px`,
          width: `${(b.c1 - b.c0 + 1) * F.cell - 2}px`, height: `${F.hourPitch - 8}px`, background: b.color,
        }} />
      ))}
      {notes.map((n) => <NoteMark key={n.id} note={n} accent={accent} />)}
    </div>
  );
}

/** 원본 앱에서 쓴 글씨 메모 · 밥시간 (만들기 · 고치기는 2차) */
function NoteMark({ note, accent }: { note: TimeNote; accent: string }) {
  const s = Math.min(note.start, note.end), e = Math.max(note.start, note.end);
  const row = Math.floor(s / COLS), col = s % COLS;
  if (note.kind === "text") {
    return (
      <div class="tmp-note" style={{ left: `${col * F.cell + 4}px`, top: `${row * F.hourPitch}px`, width: `${(COLS - col) * F.cell - 8}px`,
        height: `${F.hourPitch}px`, lineHeight: `${F.hourPitch}px`, fontSize: `${F.hourPitch * 0.62 * TEXT_SCALE / 0.8}px` }}>
        {note.text}
      </div>
    );
  }
  const er = Math.floor(e / COLS), ec = e % COLS;
  const y0 = row * F.hourPitch + F.hourPitch / 2, y1 = er * F.hourPitch + F.hourPitch / 2;
  const x0 = col * F.cell + F.cell / 2, x1 = (ec + 1) * F.cell - 6;
  return (
    <svg class="tmp-note" width={W} height={H} style={{ left: 0, top: 0 }} viewBox={`0 0 ${W} ${H}`}>
      <path d={row === er ? `M ${x0} ${y0} L ${x1} ${y1}` : `M ${x0} ${y0} L ${W - 4} ${y0} M 4 ${y1} L ${x1} ${y1}`}
        stroke={accent} stroke-width={4} fill="none" stroke-linecap="round" />
      <path d={`M ${x1 - 12} ${y1 - 9} L ${x1} ${y1} L ${x1 - 12} ${y1 + 9}`} stroke={accent} stroke-width={4} fill="none" stroke-linecap="round" />
      <text x={x0} y={y0} text-anchor="middle" dominant-baseline="central" font-size={F.hourPitch * 0.6}>🍴</text>
    </svg>
  );
}
