// 타임테이블 (원본 SlotPainter 에서 갈라선 일정판).
// 일정 하나 = 시작 · 끝 칸 + 형광펜 + 제목 · 내용 · 장소. 칸 번호 = 행 × 6 + 열 (행 = 한 시간, 06시부터).
// - 형광펜으로 끌면 새 일정 (이미 있는 일정 위에서도 겹치는 새 일정). 일정을 누르기만 하면 선택.
// - 겹친 일정은 반투명이라 색이 섞여 보인다. 일정마다 시작선이 있어 연달아 있어도 나뉘어 보인다.
// - 선택한 일정: 시작 · 끝 핸들로 끌어 조절, 말풍선에 전체 (제목 · 시간 · 장소 · 내용), "편집" 으로 팝업, "삭제" 로 지우기.
// - 지우개: 끈 범위를 일정에서 잘라내고, 겹치는 글씨 메모 · 밥시간도 지운다.
// - 글씨 · 밥시간 도구는 전과 같다.
import { Menu } from "obsidian";
import { useEffect, useRef, useState } from "preact/hooks";
import * as F from "./form";
import { ERASER, MEAL_TOOL, TEXT_TOOL, useCtx } from "./ctx";
import { hex } from "./theme";
import { SLOT_COUNT, TimeNote } from "../model/types";
import { segments, TimeEvent } from "../model/events";
import { slotTime } from "../model/repeat";
import { addQuickRepeatItems } from "./quickRepeat";
import { EventModal } from "./EventModal";
import { TEXT_SCALE } from "../canvasWrap";

const COLS = 6, ROWS = 24;

export interface TimetableProps {
  date: Date; slots: number[]; notes: TimeNote[]; accent: string; events: TimeEvent[];
  /** 칸 영역 왼쪽 위 (디자인 단위)와 10분 칸 폭 · 한 시간 줄 높이 */
  x: number; y: number; cellW: number; rowH: number;
  disabled?: boolean;
}

export const noteKey = (id: string) => `n|${id}`;

type Drag =
  | { kind: "new"; start: number; cur: number; onEvent: string | null; moved: boolean }
  | { kind: "erase"; start: number; cur: number }
  | { kind: "note"; start: number; cur: number }
  | { kind: "handle"; id: string; edge: "from" | "to"; other: number; from0: number; to0: number };

export function Timetable({ date, notes, accent, events, x, y, cellW, rowH, disabled }: TimetableProps) {
  const c = useCtx();
  const p = c.planner;
  const W = COLS * cellW, H = ROWS * rowH;
  const el = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [preview, setPreview] = useState<{ a: number; b: number; kind: Drag["kind"] } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const noteTool = c.tool === TEXT_TOOL || c.tool === MEAL_TOOL;

  // 선택한 일정은 Delete · Backspace 로 바로 지운다 (글을 쓰는 중이면 그대로)
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, [contenteditable=true]")) return;
      e.preventDefault();
      e.stopPropagation();
      p.removeEvent(date, selected);
      setSelected(null);
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [selected, date.getTime()]);

  // 다른 날로 넘기면 선택을 푼다
  useEffect(() => { setSelected(null); setHover(null); }, [date.getTime()]);
  // 바깥을 누르면 선택을 푼다
  useEffect(() => {
    if (!selected) return;
    const off = (e: PointerEvent) => { if (!el.current?.contains(e.target as Node)) setSelected(null); };
    document.addEventListener("pointerdown", off, true);
    return () => document.removeEventListener("pointerdown", off, true);
  }, [selected]);

  const slotAt = (e: PointerEvent): number => {
    const r = el.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const py = ((e.clientY - r.top) / r.height) * H;
    const col = Math.min(COLS - 1, Math.max(0, Math.floor(px / cellW)));
    const row = Math.min(ROWS - 1, Math.max(0, Math.floor(py / rowH)));
    return row * COLS + col;
  };

  // 두 번째 손가락이 닿으면 (핀치 줌) 하던 끌기를 그만둔다. 손잡이로 늘이던 일정은 처음 길이로
  const abort = () => {
    const d = drag.current;
    drag.current = null;
    setPreview(null);
    if (d?.kind === "handle") p.updateEvent(date, d.id, (x) => { x.from = d.from0; x.to = d.to0; });
  };
  useEffect(() => {
    const onTouch = (e: TouchEvent) => { if (e.touches.length > 1 && drag.current) abort(); };
    document.addEventListener("touchstart", onTouch, { capture: true, passive: true });
    return () => document.removeEventListener("touchstart", onTouch, { capture: true });
  });

  const down = (e: PointerEvent) => {
    if (e.button !== 0 || disabled || !e.isPrimary) return;
    const t = e.target as HTMLElement;
    if (t.closest(".tmp-note-hit, .tmp-note-edit, .tmp-bubble, .tmp-meal-icon")) return;
    e.preventDefault();
    c.setEditing(null);
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* 합성 이벤트 등 */ }
    const handle = t.closest(".tmp-handle") as HTMLElement | null;
    if (handle) {
      const ev = events.find((x) => x.id === handle.dataset.id);
      if (!ev) return;
      const edge = handle.dataset.edge as "from" | "to";
      drag.current = { kind: "handle", id: ev.id, edge, other: edge === "from" ? ev.to : ev.from, from0: ev.from, to0: ev.to };
      return;
    }
    const start = slotAt(e);
    if (noteTool) { drag.current = { kind: "note", start, cur: start }; setPreview({ a: start, b: start, kind: "note" }); return; }
    if (c.tool === ERASER) { drag.current = { kind: "erase", start, cur: start }; setPreview({ a: start, b: start, kind: "erase" }); return; }
    const onEvent = (t.closest(".tmp-ev") as HTMLElement | null)?.dataset.id ?? null;
    drag.current = { kind: "new", start, cur: start, onEvent, moved: false };
    if (!onEvent) setPreview({ a: start, b: start, kind: "new" });
  };

  const move = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || !e.isPrimary) return;
    const cur = slotAt(e);
    if (d.kind === "handle") {
      const a = Math.min(cur, d.other), b = Math.max(cur, d.other);
      p.updateEvent(date, d.id, (x) => { x.from = a; x.to = b; });
      return;
    }
    if (cur === d.cur) return;
    d.cur = cur;
    if (d.kind === "new") d.moved = true;
    setPreview({ a: Math.min(d.start, cur), b: Math.max(d.start, cur), kind: d.kind });
  };

  const up = (e: PointerEvent) => {
    if (!e.isPrimary) return;
    const d = drag.current;
    drag.current = null;
    setPreview(null);
    if (!d || d.kind === "handle") return;
    const a = Math.min(d.start, d.cur), b = Math.max(d.start, d.cur);
    if (d.kind === "erase") { p.eraseRange(date, a, b); p.removeNotes(date, a, b); setSelected(null); return; }
    if (d.kind === "note") {
      if (c.tool === TEXT_TOOL) {
        const id = p.addNote(date, { kind: "text", start: a, end: Math.floor(a / COLS) * COLS + COLS - 1, text: "" });
        c.setEditing(noteKey(id), date);
      } else {
        p.addNote(date, { kind: "meal", start: a, end: a === b ? Math.min(a + 5, SLOT_COUNT - 1) : b, text: "" });
      }
      return;
    }
    // 일정 위를 누르기만 했으면 선택, 끌었으면 (겹치는) 새 일정
    if (d.onEvent && !d.moved) { setSelected(d.onEvent === selected ? null : d.onEvent); return; }
    if (c.tool < 0) return;
    const id = p.addEvent(date, { from: a, to: b, cat: c.tool });
    setSelected(id);
  };

  const cancel = () => { drag.current = null; setPreview(null); };

  const openEdit = (ev: TimeEvent) => { setSelected(null); new EventModal(c.app, p, date, ev.id).open(); };

  const barMenu = (e: MouseEvent, ev: TimeEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    const m = new Menu();
    m.addItem((it) => it.setTitle("편집…").setIcon("pencil").onClick(() => openEdit(ev)));
    m.addItem((it) => it.setTitle("지우기").setIcon("trash").onClick(() => p.removeEvent(date, ev.id)));
    m.addSeparator();
    m.addItem((it) => it.setTitle(`이 일정 ${slotTime(ev.from)}–${slotTime(ev.to, true)} 을 반복으로`).setDisabled(true));
    addQuickRepeatItems(m, c.app, p, date, { text: ev.title, cat: ev.cat, paint: { from: ev.from, to: ev.to } });
    m.showAtMouseEvent(e);
  };

  const cls = c.tool === ERASER ? "is-eraser" : c.tool === TEXT_TOOL ? "is-text" : c.tool === MEAL_TOOL ? "is-meal" : "";
  const shown = events.find((e) => e.id === (selected ?? hover));
  // 지금 화면 배율 (말풍선 글자를 화면 기준 크기로)
  const screenScale = el.current ? el.current.getBoundingClientRect().width / W : 1;

  return (
    <div ref={el} class={`tmp-timetable ${cls}`} style={F.place({ x, y, w: W, h: H })}
      onPointerDown={down as never} onPointerMove={move as never} onPointerUp={up as never} onPointerCancel={cancel}>
      {events.map((ev) => {
        const cat = p.category(ev.cat);
        const color = cat ? hex(cat.hex) : "#CFCFD4";
        const segs = segments(ev, COLS);
        const isSel = ev.id === selected;
        return segs.map((s, i) => (
          <div key={`${ev.id}-${i}`} data-id={ev.id} class={`tmp-ev ${isSel ? "is-selected" : ""} ${s.first ? "is-first" : ""} ${s.last ? "is-last" : ""}`}
            style={{ left: `${s.c0 * cellW + 1}px`, top: `${s.row * rowH + rowH * 0.08}px`, width: `${(s.c1 - s.c0 + 1) * cellW - 2}px`,
              height: `${rowH * 0.84}px`, background: color, ["--ev" as never]: color }}
            onPointerEnter={() => setHover(ev.id)} onPointerLeave={() => setHover((h) => (h === ev.id ? null : h))}
            onContextMenu={(e) => barMenu(e as unknown as MouseEvent, ev)}>
            {s.first && ev.title && <span class="tmp-ev-title" style={{ fontSize: `${rowH * 0.4 * TEXT_SCALE / 0.8}px` }}>{ev.title}</span>}
          </div>
        ));
      })}
      {selected && (() => {
        const ev = events.find((e) => e.id === selected);
        if (!ev) return null;
        const segs = segments(ev, COLS), f = segs[0], l = segs[segs.length - 1];
        const r = rowH * 0.19;
        return (
          <>
            <div class="tmp-handle" data-id={ev.id} data-edge="from" title="시작 조절"
              style={{ left: `${f.c0 * cellW - r}px`, top: `${f.row * rowH + rowH / 2 - r}px`, width: `${2 * r}px`, height: `${2 * r}px`, borderColor: accent }} />
            <div class="tmp-handle" data-id={ev.id} data-edge="to" title="끝 조절"
              style={{ left: `${(l.c1 + 1) * cellW - r}px`, top: `${l.row * rowH + rowH / 2 - r}px`, width: `${2 * r}px`, height: `${2 * r}px`, borderColor: accent }} />
          </>
        );
      })()}
      {preview && <Preview preview={preview} tool={c.tool} accent={accent} cellW={cellW} rowH={rowH} color={c.tool >= 0 ? hex(p.category(c.tool)?.hex ?? "CFCFD4") : accent} />}
      {notes.map((n) => n.kind === "text"
        ? <TextNote key={n.id} date={date} note={n} cellW={cellW} rowH={rowH} disabled={disabled} />
        : <MealNote key={n.id} date={date} note={n} accent={accent} cellW={cellW} rowH={rowH} disabled={disabled} />)}
      {shown && !preview && !c.printing && (
        <Bubble ev={shown} cellW={cellW} rowH={rowH} W={W} H={H} scale={screenScale} selected={shown.id === selected}
          onEdit={() => openEdit(shown)} onDelete={() => { p.removeEvent(date, shown.id); setSelected(null); setHover(null); }} />
      )}
    </div>
  );
}

/** 말풍선: 제목 · 시간 · 장소 · 내용. 종이 배율과 상관없이 화면에서 읽히는 크기 */
function Bubble({ ev, cellW, rowH, W, H, scale, selected, onEdit, onDelete }: {
  ev: TimeEvent; cellW: number; rowH: number; W: number; H: number; scale: number; selected: boolean; onEdit: () => void; onDelete: () => void;
}) {
  const c = useCtx();
  const cat = c.planner.category(ev.cat);
  const k = 1 / Math.max(scale, 0.05);
  const segs = segments(ev, COLS), f = segs[0], l = segs[segs.length - 1];
  const below = f.row < 3;
  const top = below ? (l.row + 1) * rowH + 4 * k : f.row * rowH - 4 * k;
  const left = Math.min(Math.max(0, f.c0 * cellW), W - 220 * k);
  const mins = (ev.to - ev.from + 1) * 10;
  return (
    <div class={`tmp-bubble ${below ? "is-below" : ""}`} style={{ left: `${left}px`, top: `${Math.min(top, H)}px`, width: `${220 * k}px`, fontSize: `${12.5 * k}px`, padding: `${8 * k}px ${10 * k}px`, borderRadius: `${8 * k}px` }}
      onPointerDown={(e) => e.stopPropagation()}>
      <div class="t">{ev.title || cat?.name || "일정"}</div>
      <div class="m">{slotTime(ev.from)} – {slotTime(ev.to, true)} · {mins >= 60 ? `${Math.floor(mins / 60)}시간${mins % 60 ? ` ${mins % 60}분` : ""}` : `${mins}분`}{cat && ev.title ? ` · ${cat.name}` : ""}</div>
      {ev.place && <div class="m">📍 {ev.place}</div>}
      {ev.note && <div class="n">{ev.note}</div>}
      {selected && (
        <div class="tmp-bubble-actions" style={{ gap: `${6 * k}px`, marginTop: `${8 * k}px` }}>
          <button style={{ fontSize: `${12 * k}px`, height: `${28 * k}px` }} onClick={onEdit}>편집</button>
          <button class="mod-warning" style={{ fontSize: `${12 * k}px`, height: `${28 * k}px` }} onClick={onDelete}>삭제</button>
        </div>
      )}
    </div>
  );
}

function Preview({ preview, tool, accent, cellW, rowH, color }: { preview: { a: number; b: number; kind: string }; tool: number; accent: string; cellW: number; rowH: number; color: string }) {
  const { a, b, kind } = preview;
  if (kind === "note") {
    if (tool === TEXT_TOOL) {
      const row = Math.floor(a / COLS), col = a % COLS;
      return <div class="tmp-note-preview" style={{ left: `${col * cellW + 4}px`, top: `${row * rowH + rowH * 0.85}px`, width: `${(COLS - col) * cellW - 8}px`, borderColor: accent }} />;
    }
    return <MealArrow start={a} end={a === b ? Math.min(a + 5, SLOT_COUNT - 1) : b} accent={accent} cellW={cellW} rowH={rowH} faint />;
  }
  const segs = segments({ id: "", from: a, to: b, cat: null, title: "", note: "", place: "" }, COLS);
  return (
    <>
      {segs.map((s, i) => (
        <div key={i} class={`tmp-ev-preview ${kind === "erase" ? "is-erase" : ""}`} style={{ left: `${s.c0 * cellW + 1}px`, top: `${s.row * rowH + rowH * 0.08}px`,
          width: `${(s.c1 - s.c0 + 1) * cellW - 2}px`, height: `${rowH * 0.84}px`, background: kind === "erase" ? "transparent" : color }} />
      ))}
    </>
  );
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
          const m = new Menu();
          m.addItem((it) => it.setTitle("밥시간 지우기").setIcon("trash").onClick(() => c.planner.removeNote(date, note.id)));
          m.addSeparator();
          m.addItem((it) => it.setTitle(`밥시간 ${slotTime(s)}–${slotTime(e, true)} 을 반복으로`).setDisabled(true));
          addQuickRepeatItems(m, c.app, c.planner, date, { text: "", cat: null, meal: { from: s, to: e } });
          m.showAtMouseEvent(ev as unknown as MouseEvent);
        }}>🍴</div>
    </>
  );
}
