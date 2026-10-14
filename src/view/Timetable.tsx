// 타임테이블 (원본 SlotPainter).
// 칠하기: 시작 칸 ~ 지금 칸 사이를 행 우선(읽는 순서)으로 칠한다 (사각형이 아니다). 칸 번호 = 행 × 6 + 열.
//   시작 칸이 이미 같은 색이면 그 끌기 전체가 지우기. 범위가 줄면 줄어든 칸만 붓질 전 값으로.
// 지우개: 칸을 비우고, 놓을 때 범위와 겹치는 글씨 메모 · 밥시간도 지운다.
// 글씨: 칸을 누르거나 끌면 점선 밑줄 미리보기 → 놓으면 메모를 만들고 바로 쓴다 (시작 칸부터 그 줄 끝까지).
// 밥시간: 시작 칸부터 끝 칸까지 끈다. 누르기만 하면 1시간.
import { Menu } from "obsidian";
import { useEffect, useRef, useState } from "preact/hooks";
import * as F from "./form";
import { ERASER, MEAL_TOOL, TEXT_TOOL, useCtx } from "./ctx";
import { hex } from "./theme";
import { repainted } from "../model/day";
import { SLOT_COUNT, TimeNote } from "../model/types";
import { slotTime } from "../model/repeat";
import { addQuickRepeatItems } from "./quickRepeat";
import { TEXT_SCALE } from "../canvasWrap";

const COLS = 6, ROWS = 24;

interface Stroke { start: number; before: number[]; previous: [number, number] | null; value: number; last: number; }

export interface TimetableProps {
  date: Date; slots: number[]; notes: TimeNote[]; accent: string;
  /** 칸 영역 왼쪽 위 (디자인 단위)와 10분 칸 폭 · 한 시간 줄 높이 */
  x: number; y: number; cellW: number; rowH: number;
  disabled?: boolean;
}

export const noteKey = (id: string) => `n|${id}`;

export function Timetable({ date, slots, notes, accent, x, y, cellW, rowH, disabled }: TimetableProps) {
  const c = useCtx();
  const p = c.planner;
  const W = COLS * cellW, H = ROWS * rowH;
  const stroke = useRef<Stroke | null>(null);
  const drag = useRef<{ start: number; cur: number } | null>(null);
  const [preview, setPreview] = useState<{ start: number; cur: number } | null>(null);
  const el = useRef<HTMLDivElement>(null);
  const noteTool = c.tool === TEXT_TOOL || c.tool === MEAL_TOOL;

  const slotAt = (e: PointerEvent): number => {
    const r = el.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const py = ((e.clientY - r.top) / r.height) * H;
    const col = Math.min(COLS - 1, Math.max(0, Math.floor(px / cellW)));
    const row = Math.min(ROWS - 1, Math.max(0, Math.floor(py / rowH)));
    return row * COLS + col;
  };

  const paint = (cur: number) => {
    const s = stroke.current!;
    const range: [number, number] = [Math.min(s.start, cur), Math.max(s.start, cur)];
    p.setSlots(date, repainted(p.day(date).slots, s.before, s.previous, range, s.value));
    s.previous = range;
    s.last = cur;
  };

  const down = (e: PointerEvent) => {
    if (e.button !== 0 || disabled) return;
    if ((e.target as HTMLElement).closest(".tmp-note-hit, .tmp-note-edit")) return;
    e.preventDefault();
    c.setEditing(null);
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* 합성 이벤트 등 */ }
    const start = slotAt(e);
    if (noteTool) {
      drag.current = { start, cur: start };
      setPreview({ start, cur: start });
      return;
    }
    const before = p.day(date).slots;
    const value = c.tool === ERASER ? -1 : before[start] === c.tool ? -1 : c.tool;
    stroke.current = { start, before, previous: null, value, last: start };
    paint(start);
  };

  const move = (e: PointerEvent) => {
    const cur = slotAt(e);
    if (drag.current) {
      if (cur !== drag.current.cur) { drag.current = { ...drag.current, cur }; setPreview(drag.current); }
      return;
    }
    if (stroke.current && cur !== stroke.current.last) paint(cur);
  };

  const up = () => {
    const d = drag.current;
    drag.current = null;
    setPreview(null);
    if (d) {
      const a = Math.min(d.start, d.cur), b = Math.max(d.start, d.cur);
      if (c.tool === TEXT_TOOL) {
        // 글씨 메모는 시작 칸에서 그 줄 끝까지
        const id = p.addNote(date, { kind: "text", start: a, end: Math.floor(a / COLS) * COLS + COLS - 1, text: "" });
        c.setEditing(noteKey(id), date);
      } else {
        const end = a === b ? Math.min(a + 5, SLOT_COUNT - 1) : b; // 누르기만 하면 1시간
        p.addNote(date, { kind: "meal", start: a, end, text: "" });
      }
      return;
    }
    const s = stroke.current;
    stroke.current = null;
    if (s && c.tool === ERASER && s.previous) p.removeNotes(date, s.previous[0], s.previous[1]);
  };

  const cancel = () => {
    drag.current = null;
    setPreview(null);
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

  const cls = c.tool === ERASER ? "is-eraser" : c.tool === TEXT_TOOL ? "is-text" : c.tool === MEAL_TOOL ? "is-meal" : "";

  return (
    <div ref={el} class={`tmp-timetable ${cls}`} style={F.place({ x, y, w: W, h: H })}
      onPointerDown={down as never} onPointerMove={move as never} onPointerUp={up} onPointerCancel={cancel}>
      {bars.map((b) => (
        <div key={`${b.row}-${b.c0}`} class="tmp-bar" onContextMenu={(e) => {
          if (disabled) return;
          e.preventDefault();
          e.stopPropagation();
          // 이어진 같은 색 칸 (줄을 넘어가도) 을 한 일정으로
          const at = b.row * COLS + b.c0, v = slots[at];
          let from = at, to = b.row * COLS + b.c1;
          while (from > 0 && slots[from - 1] === v) from--;
          while (to < SLOT_COUNT - 1 && slots[to + 1] === v) to++;
          // 이 시간 (09:00–10:30) 을 바로 반복: 매일 · 매주 · 매월 · 매년 · 자세히…
          const m = new Menu();
          m.addItem((it) => it.setTitle(`이 시간 ${slotTime(from)}–${slotTime(to, true)} 을 반복으로`).setDisabled(true));
          addQuickRepeatItems(m, c.app, p, date, { text: "", cat: v, paint: { from, to } });
          m.showAtMouseEvent(e as unknown as MouseEvent);
        }} style={{
          left: `${b.c0 * cellW + 1}px`, top: `${b.row * rowH + rowH * 0.08}px`,
          width: `${(b.c1 - b.c0 + 1) * cellW - 2}px`, height: `${rowH * 0.84}px`, background: b.color,
        }} />
      ))}
      {notes.map((n) => n.kind === "text"
        ? <TextNote key={n.id} date={date} note={n} cellW={cellW} rowH={rowH} disabled={disabled} />
        : <MealNote key={n.id} date={date} note={n} accent={accent} cellW={cellW} rowH={rowH} disabled={disabled} />)}
      {preview && <Preview tool={c.tool} preview={preview} accent={accent} cellW={cellW} rowH={rowH} />}
    </div>
  );
}

/** 끄는 동안: 글씨는 점선 밑줄, 밥시간은 옅은 화살표 */
function Preview({ tool, preview, accent, cellW, rowH }: { tool: number; preview: { start: number; cur: number }; accent: string; cellW: number; rowH: number }) {
  const a = Math.min(preview.start, preview.cur), b = Math.max(preview.start, preview.cur);
  if (tool === TEXT_TOOL) {
    const row = Math.floor(a / COLS), col = a % COLS;
    return <div class="tmp-note-preview" style={{ left: `${col * cellW + 4}px`, top: `${row * rowH + rowH * 0.85}px`, width: `${(COLS - col) * cellW - 8}px`, borderColor: accent }} />;
  }
  return <MealArrow start={a} end={a === b ? Math.min(a + 5, SLOT_COUNT - 1) : b} accent={accent} cellW={cellW} rowH={rowH} faint />;
}

function TextNote({ date, note, cellW, rowH, disabled }: { date: Date; note: TimeNote; cellW: number; rowH: number; disabled?: boolean }) {
  const c = useCtx();
  const key = noteKey(note.id);
  const editing = c.editing === key;
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);
  const s = Math.min(note.start, note.end);
  const row = Math.floor(s / COLS), col = s % COLS;
  const style = { left: `${col * cellW + 4}px`, top: `${row * rowH}px`, width: `${(COLS - col) * cellW - 8}px`, height: `${rowH}px` };
  const font = `${rowH * 0.74 * TEXT_SCALE}px`;
  if (editing) {
    return (
      <input ref={ref} class="tmp-editor tmp-note-edit" style={{ ...style, fontSize: font }} value={note.text}
        onPointerDown={(e) => e.stopPropagation()}
        onInput={(e) => c.planner.updateNote(date, note.id, (n) => { n.text = (e.target as HTMLInputElement).value; })}
        onKeyDown={(e) => { if (!e.isComposing && (e.key === "Enter" || e.key === "Escape")) { e.preventDefault(); c.setEditing(null); } }}
        onBlur={() => window.setTimeout(() => { if (c.editingNow() === key) c.setEditing(null); }, 0)} />
    );
  }
  return (
    <div class={`tmp-note tmp-note-text ${!disabled && c.tool === TEXT_TOOL ? "tmp-note-hit" : ""}`} style={{ ...style, lineHeight: `${rowH}px`, fontSize: font }}
      onClick={() => { if (!disabled && c.tool === TEXT_TOOL) c.setEditing(key, date); }}
      onContextMenu={(e) => {
        if (disabled) return;
        e.preventDefault();
        new Menu().addItem((it) => it.setTitle("메모 지우기").onClick(() => c.planner.removeNote(date, note.id))).showAtMouseEvent(e as unknown as MouseEvent);
      }}>
      {note.text}
    </div>
  );
}

function MealArrow({ start, end, accent, cellW, rowH, faint }: { start: number; end: number; accent: string; cellW: number; rowH: number; faint?: boolean }) {
  const W = COLS * cellW, H = ROWS * rowH;
  const r0 = Math.floor(start / COLS), r1 = Math.floor(end / COLS);
  const x0 = (start % COLS) * cellW + cellW / 2, x1 = ((end % COLS) + 1) * cellW - 6;
  const segs: string[] = [];
  for (let r = r0; r <= r1; r++) {
    const yy = r * rowH + rowH / 2;
    const a = r === r0 ? x0 : 4, b = r === r1 ? x1 : W - 4;
    segs.push(`M ${a} ${yy} L ${b} ${yy}`);
    // 줄이 바뀌면 줄 끝 갈고리
    if (r < r1) segs.push(`M ${b} ${yy} L ${b} ${yy + rowH * 0.32}`);
  }
  const y1 = r1 * rowH + rowH / 2;
  return (
    <svg class="tmp-note" width={W} height={H} style={{ left: 0, top: 0, opacity: faint ? 0.45 : 1 }} viewBox={`0 0 ${W} ${H}`}>
      <path d={segs.join(" ")} stroke={accent} stroke-width={Math.max(2, rowH * 0.09)} fill="none" stroke-linecap="round" />
      <path d={`M ${x1 - rowH * 0.28} ${y1 - rowH * 0.2} L ${x1} ${y1} L ${x1 - rowH * 0.28} ${y1 + rowH * 0.2}`} stroke={accent}
        stroke-width={Math.max(2, rowH * 0.09)} fill="none" stroke-linecap="round" />
    </svg>
  );
}

function MealNote({ date, note, accent, cellW, rowH, disabled }: { date: Date; note: TimeNote; accent: string; cellW: number; rowH: number; disabled?: boolean }) {
  const c = useCtx();
  const s = Math.min(note.start, note.end), e = Math.max(note.start, note.end);
  const row = Math.floor(s / COLS), col = s % COLS;
  return (
    <>
      <MealArrow start={s} end={e} accent={accent} cellW={cellW} rowH={rowH} />
      <div class="tmp-meal-icon" title="밥시간 — 오른쪽 클릭으로 지우기"
        style={{ left: `${col * cellW + cellW / 2 - rowH * 0.42}px`, top: `${row * rowH + rowH * 0.08}px`, width: `${rowH * 0.84}px`, height: `${rowH * 0.84}px`, fontSize: `${rowH * 0.55}px`, borderColor: accent }}
        onPointerDown={(ev) => ev.stopPropagation()}
        onContextMenu={(ev) => {
          if (disabled) return;
          ev.preventDefault();
          new Menu().addItem((it) => it.setTitle("밥시간 지우기").onClick(() => c.planner.removeNote(date, note.id))).showAtMouseEvent(ev as unknown as MouseEvent);
        }}>🍴</div>
    </>
  );
}
