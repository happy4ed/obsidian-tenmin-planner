// TASKS: 아무 줄에나 쓰고, 형광펜(분류)은 왼쪽 칸에서 나중에 고른다. 오른쪽 점선 박스 = 체크 표시.
import { Menu } from "obsidian";
import { useEffect, useRef } from "preact/hooks";
import * as F from "./form";
import { useCtx } from "./ctx";
import { hex } from "./theme";
import { TEXT_SCALE } from "../canvasWrap";
import { DayRecord, Mark, markLabel, PlanTask } from "../model/types";
import { owner, RowLayout, span } from "../model/ruled";
import { TASK_FONT, taskLayout } from "../model/day";
import { bookContains } from "../model/planner";
import * as Dates from "../model/dates";
import { occurrenceId } from "../model/repeat";
import { addQuickRepeatItems } from "./quickRepeat";
import { Planner } from "../model/planner";

/** 반복으로 생긴 할 일인지 */
const isRepeatTask = (p: Planner, d: Date, id: string) => p.repeats.some((r) => occurrenceId(r, d) === id.toUpperCase());

export const taskKey = (id: string) => `t|${id}`;

/** 펜으로 그린 체크 표시 (원본 MarkShape) */
export function MarkGlyph({ mark, size, color, stroke }: { mark: Mark; size: number; color: string; stroke: number }) {
  const i = size * 0.12, a = i, z = size - i, w = z - a, mid = size / 2;
  let d = "";
  if (mark === Mark.done) d = `M ${mid} ${a} A ${w / 2} ${w / 2} 0 1 1 ${mid - 0.01} ${a} Z`;
  else if (mark === Mark.partial) d = `M ${mid} ${a} L ${z} ${z - w * 0.04} L ${a} ${z - w * 0.04} Z`;
  else if (mark === Mark.missed) d = `M ${a} ${a} L ${z} ${z} M ${z} ${a} L ${a} ${z}`;
  else if (mark === Mark.moved) d = `M ${a} ${mid} L ${z} ${mid} M ${z - w * 0.4} ${a + w * 0.1} L ${z} ${mid} L ${z - w * 0.4} ${z - w * 0.1}`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {d && <path d={d} fill="none" stroke={color} stroke-width={stroke} stroke-linecap="round" stroke-linejoin="round" />}
    </svg>
  );
}

export function categoryMenu(e: MouseEvent, menu: Menu, task: PlanTask, onPick: (cat: number | null) => void, cats: { id: number; name: string; hex: string }[]) {
  for (const c of cats) {
    menu.addItem((it) => it.setTitle(`● ${c.name}`).setChecked(task.cat === c.id).onClick(() => onPick(c.id)));
  }
  menu.addItem((it) => it.setTitle("없음").setChecked(task.cat == null).onClick(() => onPick(null)));
  menu.showAtMouseEvent(e);
}

export function Tasks({ day, accent }: { day: DayRecord; accent: string }) {
  const c = useCtx();
  const { planner: p, date, wrap } = c;
  const L = taskLayout(day.tasks, wrap);
  const pitch = F.taskPitch(L.rows);
  const sc = L.scale;

  const start = (row: number) => c.setEditing(taskKey(p.addTask(date, row)));

  return (
    <>
      {L.owners.map((o, r) => o == null && (
        <div key={`e${r}`} class="tmp-hit" style={F.place({ x: F.taskTextX, y: F.gridTop + r * pitch, w: F.taskTextWidth, h: pitch })}
          onClick={() => start(r)} />
      ))}
      {day.tasks.map((t, k) => k < L.items.length && (
        <TaskEntry key={t.id} task={t} k={k} L={L} pitch={pitch} sc={sc} tasks={day.tasks} accent={accent} />
      ))}
    </>
  );
}

function TaskEntry({ task, k, L, pitch, sc, tasks, accent }: {
  task: PlanTask; k: number; L: RowLayout; pitch: number; sc: number; tasks: PlanTask[]; accent: string;
}) {
  const c = useCtx();
  const { planner: p, date } = c;
  const item = L.items[k];
  const r0 = item.row;
  const cat = p.category(task.cat);
  const key = taskKey(task.id);
  const editing = c.editing === key;
  const font = TASK_FONT * sc * item.fit * TEXT_SCALE;
  const above = owner(L, r0 - 1);
  const showTag = cat && (above == null || p.category(tasks[above].cat)?.id !== cat.id);
  const b = F.box(r0, L.rows);

  const pickCat = (e: MouseEvent) => {
    e.stopPropagation();
    categoryMenu(e, new Menu(), task, (v) => p.setCategory(date, task.id, v), p.categories);
  };

  const contextMenu = (e: MouseEvent) => {
    if (editing) return; // 쓰는 중이면 글상자 기본 메뉴
    e.preventDefault();
    taskMenu(e, c, date, task);
  };

  return (
    <>
      {showTag && (
        <div class="tmp-cat-tag" style={{ ...F.place({ x: F.left + 6, y: F.gridTop + r0 * pitch + 3 * sc, w: F.categoryX - F.left - 12, h: pitch - 6 * sc }), fontSize: `${37 * sc * TEXT_SCALE}px` }}>
          {cat!.name}
        </div>
      )}
      <div class="tmp-cat-cell" title="형광펜 (분류) 고르기"
        style={F.place({ x: F.left + 3, y: F.gridTop + r0 * pitch + 3 * sc, w: F.categoryX - F.left - 7, h: span(item) * pitch - 6 * sc })}
        onClick={pickCat} />
      <div class="tmp-entry" style={F.place({ x: F.taskTextX, y: F.gridTop + r0 * pitch, w: F.taskTextWidth, h: span(item) * pitch })}
        onContextMenu={contextMenu as never}>
        {editing
          ? <TaskEditor task={task} L={L} k={k} font={font} pitch={pitch} />
          : item.lines.map((line, j) => (
            <div key={j} class="tmp-line" style={{ top: `${j * pitch}px`, height: `${pitch}px`, lineHeight: `${pitch}px`, fontSize: `${font}px` }}
              onClick={() => c.setEditing(key)}>
              <span class="tmp-line-text" style={task.mark === Mark.done && cat ? { backgroundImage: highlight(hex(cat.hex)) } : undefined}>
                {line || " "}
              </span>
            </div>
          ))}
      </div>
      <button class="tmp-mark" aria-label={markLabel[task.mark]} title={markLabel[task.mark]}
        style={F.place(b)} onClick={(e) => { e.stopPropagation(); p.cycleMark(date, task.id); }}>
        {task.mark !== Mark.none && <MarkGlyph mark={task.mark} size={b.w * 0.98} color={accent} stroke={5.6 * sc} />}
      </button>
    </>
  );
}

/** 할 일 오른쪽 클릭 메뉴: 형광펜 · 체크 표시 · 내일로 미루기 · 삭제 (일간 · 주간 공용) */
export function taskMenu(e: MouseEvent, c: ReturnType<typeof useCtx>, date: Date, task: PlanTask) {
  const p = c.planner;
  const m = new Menu();
  m.addItem((it) => it.setTitle("형광펜 (분류)…").onClick(() => categoryMenu(e, new Menu(), task, (v) => p.setCategory(date, task.id, v), p.categories)));
  m.addSeparator();
  for (const mk of [Mark.none, Mark.done, Mark.partial, Mark.missed, Mark.moved]) {
    m.addItem((it) => it.setTitle(markLabel[mk]).setChecked(task.mark === mk).onClick(() => p.setMark(date, task.id, mk)));
  }
  m.addSeparator();
  const next = Dates.addDays(1, date);
  // 책의 마지막 날이면 → 표시만 한다 (다음 날로 넘기지 않는다)
  m.addItem((it) => it.setTitle(p.book && !bookContains(p.book, next) ? "내일로 미루기 (마지막 날 — 표시만)" : "내일로 미루기")
    .onClick(() => { if (c.editing?.startsWith("t|")) c.setEditing(null); p.postpone(date, task.id); }));
  m.addSeparator();
  addQuickRepeatItems(m, c.app, p, date, { text: task.text, cat: task.cat }, { date, taskId: task.id });
  m.addSeparator();
  m.addItem((it) => it.setTitle(isRepeatTask(p, date, task.id) ? "삭제 (이 날만 — 반복은 그대로)" : "삭제").onClick(() => p.deleteTask(date, task.id)));
  m.showAtMouseEvent(e);
}

/** 형광펜을 아래쪽에 굵게 그은 모양 */
export const highlight = (color: string) => `linear-gradient(to top, transparent 8%, ${color}DD 8%, ${color}DD 52%, transparent 52%)`;

function TaskEditor({ task, L, k, font, pitch }: { task: PlanTask; L: RowLayout; k: number; font: number; pitch: number }) {
  const c = useCtx();
  const { planner: p, date } = c;
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.selectionStart = el.selectionEnd = el.value.length;
  }, []);

  const item = L.items[k];

  const editRow = (row: number, cat: number | null) => {
    const o = owner(L, row);
    if (o != null && o !== k) c.setEditing(taskKey(c.planner.day(date).tasks[o].id));
    else c.setEditing(taskKey(p.addTask(date, row, cat)));
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.isComposing) return;
    const el = ref.current!;
    if (e.key === "Escape") { e.preventDefault(); c.setEditing(null); return; }
    if (e.key === "Enter" && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      if (el.value.trim() === "") { c.setEditing(null); return; }
      // 바로 아랫줄이 비었으면 거기에 새 할 일 (같은 형광펜), 다른 할 일이 있으면 그 할 일로. 맨 아래면 한 줄 더.
      editRow(item.row + span(item), task.cat);
      return;
    }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const down = e.key === "ArrowDown";
      const firstLen = item.lines[0]?.length ?? 0;
      const lastStart = el.value.length - (item.lines[item.lines.length - 1]?.length ?? 0);
      const atEdge = down ? el.selectionStart >= lastStart : el.selectionStart <= firstLen;
      const target = down ? item.row + span(item) : item.row - 1;
      if (!atEdge || target < 0 || target >= L.rows) return;
      e.preventDefault();
      editRow(target, null);
    }
  };

  return (
    <textarea ref={ref} class="tmp-editor" value={task.text} spellcheck={false}
      style={{ fontSize: `${font}px`, lineHeight: `${pitch}px` }}
      onInput={(e) => p.setTaskText(date, task.id, (e.target as HTMLTextAreaElement).value)}
      onKeyDown={onKey as never}
      onBlur={() => {
        // 다른 칸으로 옮긴 게 아니면 쓰기를 마친다
        window.setTimeout(() => { if (c.editingNow() === taskKey(task.id)) c.setEditing(null); }, 0);
      }} />
  );
}
