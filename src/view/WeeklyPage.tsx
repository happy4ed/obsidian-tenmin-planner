// 주간 페이지 (디자인 2000 × 1277, 월요일 시작 — 원본 WeeklyPage). 요일 칸의 할 일 · 체크 · 타임테이블은 일간과 같은 기록.
import { Menu } from "obsidian";
import { useEffect, useRef } from "preact/hooks";
import { useCtx } from "./ctx";
import { MarkGlyph, categoryMenu, highlight, taskKey, taskMenu } from "./Tasks";
import { Timetable } from "./Timetable";
import { conceptOf, hex, Ink } from "./theme";
import { place, Rect } from "./form";
import { TEXT_SCALE } from "../canvasWrap";
import * as Dates from "../model/dates";
import { bookContains } from "../model/planner";
import { Mark, PlanTask } from "../model/types";
import { fitScale } from "../model/ruled";

export const WEEK_W = 2000, WEEK_H = 1277;
const margin = 42, gap = 16, colW = 260;
const colX = (i: number) => margin + i * (colW + gap);
const headTop = 60, headH = 38;
const goalFrame: Rect = { x: margin, y: headTop, w: colX(4) + colW - margin, h: headH };
const goalSplit = margin + 130;
const reviewFrame: Rect = { x: colX(5), y: headTop, w: colX(6) + colW - colX(5), h: headH };
const reviewSplit = colX(6) - gap / 2;
const colTop = headTop + headH + 18;
const dayHeadH = 56, taskH = 35, taskLines = 10;
const ttTop = dayHeadH + taskH * taskLines + 16;
const rowH = 26;
const ttBottom = ttTop + rowH * 24;
const boxBottom = ttBottom + 12;
const footRule = 1218 - colTop;
const pad = 12, hourW = 26;
const cellsX = pad + hourW;
const cellW = (colW - cellsX - pad) / 6;
const textX = 24, markSize = 19, markMidX = colW - 26, textEnd = colW - 44;
const hX = 120, mX = colW - 20;
const TASK_FONT = 28;
export const WEEK_TASK_FONT = TASK_FONT;
const weekdays = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const weekdayColor = (i: number) => (i === 5 ? "#5E86D6" : i === 6 ? Ink.red : Ink.soft);

const hourLabel = (r: number) => { const h = (6 + r) % 24; return String(h % 12 === 0 ? 12 : h % 12); };

export function WeeklyPage({ start, onOpenDay }: { start: Date; onOpenDay: (d: Date) => void }) {
  const c = useCtx();
  const p = c.planner;
  const week = p.week(start);
  return (
    <div class="tmp-page" style={{ width: `${WEEK_W}px`, height: `${WEEK_H}px`, background: Ink.paper }}
      onPointerDown={(e) => { if (e.target === e.currentTarget) c.setEditing(null); }}>
      <WeekPrint />
      <Goal start={start} goal={week.goal} />
      <Stars start={start} stars={week.stars} />
      {Array.from({ length: 7 }, (_, i) => <DayColumn key={i} i={i} date={Dates.addDays(i, start)} onOpenDay={onOpenDay} />)}
    </div>
  );
}

/** 인쇄된 머리줄 · 7칸 (선 · 점선 박스 · 시각 숫자 · H M) */
function WeekPrint() {
  const els: preact.JSX.Element[] = [];
  const line = (k: string, x1: number, y1: number, x2: number, y2: number, color: string, w: number, dash?: string) =>
    els.push(<line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} stroke-width={w} stroke-dasharray={dash} stroke-linecap="round" />);
  const g = goalFrame, r = reviewFrame;
  els.push(<rect key="g" x={g.x} y={g.y} width={g.w} height={g.h} fill="none" stroke={Ink.dot} />);
  line("gs", goalSplit, g.y, goalSplit, g.y + g.h, Ink.dot, 1);
  els.push(<text key="gt" x={(g.x + goalSplit) / 2} y={g.y + g.h / 2} text-anchor="middle" dominant-baseline="central" class="tmp-wk-label">MY GOAL</text>);
  els.push(<rect key="r" x={r.x} y={r.y} width={r.w} height={r.h} fill="none" stroke={Ink.dot} />);
  line("rs", reviewSplit, r.y, reviewSplit, r.y + r.h, Ink.dot, 1);
  els.push(<text key="rt" x={(r.x + reviewSplit) / 2} y={r.y + r.h / 2} text-anchor="middle" dominant-baseline="central" class="tmp-wk-label">REVIEW OF THE WEEK</text>);
  for (let i = 0; i < 7; i++) {
    const ox = colX(i), oy = colTop, L = ox + pad, R = ox + colW - pad;
    els.push(<rect key={`b${i}`} x={ox} y={oy} width={colW} height={boxBottom} fill="none" stroke={Ink.rule} stroke-width={1.2} />);
    els.push(<text key={`w${i}`} x={R - 3} y={oy + dayHeadH * 0.56} text-anchor="end" dominant-baseline="central" class="tmp-wk-weekday" fill={weekdayColor(i)}>{weekdays[i]}</text>);
    line(`dh${i}`, L, oy + dayHeadH, R, oy + dayHeadH, Ink.soft, 1.2);
    for (let k = 1; k <= taskLines; k++) line(`t${i}-${k}`, L, oy + dayHeadH + taskH * k, R, oy + dayHeadH + taskH * k, Ink.rule, 1);
    for (let k = 0; k < taskLines; k++) {
      const b = boxRect(k);
      els.push(<rect key={`x${i}-${k}`} x={ox + b.x} y={oy + b.y} width={b.w} height={b.h} fill="none" stroke={Ink.dot} stroke-width={1.6} stroke-dasharray="0.1 3.1" stroke-linecap="round" />);
    }
    for (let rr = 0; rr <= 24; rr++) {
      const y = oy + ttTop + rr * rowH, edge = rr === 0 || rr === 24;
      line(`h${i}-${rr}`, L, y, R, y, edge ? Ink.print : Ink.rule, edge ? 1.3 : 1);
    }
    for (let k = 1; k <= 5; k++) {
      const x = ox + cellsX + k * cellW;
      line(`d${i}-${k}`, x, oy + ttTop + 2, x, oy + ttBottom - 2, Ink.dot, 1.4, "0.1 3");
    }
    line(`c${i}`, ox + cellsX, oy + ttTop, ox + cellsX, oy + ttBottom, Ink.print, 1.2);
    for (let rr = 0; rr < 24; rr++) {
      els.push(<text key={`n${i}-${rr}`} x={L + hourW / 2} y={oy + ttTop + (rr + 0.5) * rowH} text-anchor="middle" dominant-baseline="central" class="tmp-wk-hour">{hourLabel(rr)}</text>);
    }
    els.push(<text key={`H${i}`} x={ox + hX} y={oy + footRule - 9.5} text-anchor="middle" dominant-baseline="central" class="tmp-wk-unit">H</text>);
    els.push(<text key={`M${i}`} x={ox + mX} y={oy + footRule - 9.5} text-anchor="middle" dominant-baseline="central" class="tmp-wk-unit">M</text>);
    line(`f${i}`, L, oy + footRule, R, oy + footRule, Ink.dot, 1.1);
  }
  return <svg class="tmp-form" viewBox={`0 0 ${WEEK_W} ${WEEK_H}`} width={WEEK_W} height={WEEK_H} aria-hidden="true">{els}</svg>;
}

function boxRect(k: number): Rect {
  const size = Math.min(markSize, taskH * 0.57);
  const mid = dayHeadH + (k + 0.5) * taskH;
  return { x: markMidX - size / 2, y: mid - size / 2, w: size, h: size };
}

function Goal({ start, goal }: { start: Date; goal: string }) {
  const c = useCtx();
  const k = `wg|${Dates.key(start)}`;
  const editing = c.editing === k;
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);
  const rect: Rect = { x: goalSplit + 34, y: headTop + 2, w: goalFrame.x + goalFrame.w - goalSplit - 50, h: headH - 4 };
  if (editing) {
    return (
      <input ref={ref} class="tmp-editor tmp-wk-goal" style={{ ...place(rect), fontSize: `${30 * TEXT_SCALE}px` }} value={goal}
        placeholder="이번 주 목표"
        onInput={(e) => c.planner.editWeek(start, (w) => { w.goal = (e.target as HTMLInputElement).value; })}
        onKeyDown={(e) => { if (!e.isComposing && (e.key === "Enter" || e.key === "Escape")) { e.preventDefault(); c.setEditing(null); } }}
        onBlur={() => window.setTimeout(() => { if (c.editingNow() === k) c.setEditing(null); }, 0)} />
    );
  }
  return (
    <div class="tmp-wk-goal-view" style={{ ...place(rect), fontSize: `${30 * TEXT_SCALE}px`, color: goal ? Ink.text : Ink.faint }}
      onClick={() => c.setEditing(k)}>
      {goal ? <span class="tmp-wk-goal-mark" style={{ color: Ink.text, ["--mark" as never]: conceptOf(c.planner.data.prefs.defaultTheme).accent }}>{goal}</span>
        : c.printing ? "" : "이번 주 목표"}
    </div>
  );
}

function Stars({ start, stars }: { start: Date; stars: number }) {
  const c = useCtx();
  const box: Rect = { x: reviewSplit, y: headTop, w: reviewFrame.x + reviewFrame.w - reviewSplit, h: headH };
  return (
    <div class="tmp-wk-stars" style={place(box)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} class={n <= stars ? "is-on" : ""} aria-label={`별 ${n}개`}
          onClick={() => c.planner.editWeek(start, (w) => { w.stars = w.stars === n ? 0 : n; })}>★</button>
      ))}
    </div>
  );
}

function DayColumn({ i, date, onOpenDay }: { i: number; date: Date; onOpenDay: (d: Date) => void }) {
  const c = useCtx();
  const p = c.planner;
  const day = p.day(date);
  const concept = conceptOf(p.themeOf(date));
  const inBook = !p.book || bookContains(p.book, date);
  const ox = colX(i), oy = colTop;
  const tasks = day.tasks;
  const minutes = p.minutes(date);
  const [h, m] = Dates.formatHM(minutes);
  const today = Dates.isToday(date);

  return (
    <div class="tmp-wk-col" style={place({ x: ox, y: oy, w: colW, h: boxBottom })}>
      <button class="tmp-wk-date" style={place({ x: pad, y: 6, w: 120, h: dayHeadH - 12 })} disabled={!inBook}
        title="그날 일간 페이지 열기" onClick={() => onOpenDay(date)}>
        <span style={today ? { backgroundImage: `linear-gradient(to top, transparent 6%, ${concept.tint} 6%, ${concept.tint} 40%, transparent 40%)` } : undefined}>
          {date.getMonth() + 1}/{date.getDate()}
        </span>
        <span class="tmp-wk-arrow">↗</span>
      </button>
      {day.dayOff && <div class="tmp-wk-dayoff" style={{ ...place({ x: colW - 104, y: 2, w: 92, h: 20 }), color: concept.accent, borderColor: concept.accent }}>DAY OFF</div>}
      {Array.from({ length: taskLines }, (_, k) => {
        const t = tasks[k];
        const more = k === taskLines - 1 ? tasks.length - taskLines : 0;
        return t
          ? <WeekTask key={t.id} date={date} task={t} k={k} more={more} accent={concept.accent} onOpenDay={onOpenDay} disabled={!inBook} />
          : (inBook && <div key={`e${k}`} class="tmp-hit" style={place({ x: textX - 8, y: dayHeadH + k * taskH, w: textEnd - textX + 8, h: taskH })}
            onClick={() => c.setEditing(taskKey(p.addTaskAfterLast(date)), date)} />);
      })}
      <Timetable date={date} slots={day.slots} notes={day.notes} events={day.events} accent={concept.accent}
        x={cellsX} y={ttTop} cellW={cellW} rowH={rowH} disabled={!inBook} />
      {minutes > 0 && (
        <>
          <div class="tmp-wk-sum" style={{ ...place({ x: pad, y: footRule - 40, w: hX - 9 - pad, h: 44 }), color: concept.accent }}>{h}</div>
          <div class="tmp-wk-sum" style={{ ...place({ x: hX + 9, y: footRule - 40, w: mX - 9 - (hX + 9), h: 44 }), color: concept.accent }}>{m}</div>
        </>
      )}
      {!inBook && <div class="tmp-wk-locked" title="이 플래너의 기간이 아닌 날이에요" style={place({ x: 0, y: 0, w: colW, h: boxBottom })} />}
    </div>
  );
}

function WeekTask({ date, task, k, more, accent, onOpenDay, disabled }: {
  date: Date; task: PlanTask; k: number; more: number; accent: string; onOpenDay: (d: Date) => void; disabled: boolean;
}) {
  const c = useCtx();
  const p = c.planner;
  const key = taskKey(task.id);
  const editing = c.editing === key;
  const cat = p.category(task.cat);
  const width = textEnd - textX - (more > 0 ? 42 : 0);
  const fit = fitScale(task.text, TASK_FONT, width, 1, c.wrap, 0.45);
  const font = TASK_FONT * fit * TEXT_SCALE;
  const y = dayHeadH + k * taskH;
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);
  const b = boxRect(k);

  const submit = () => {
    const tasks = p.day(date).tasks;
    const i = tasks.findIndex((t) => t.id === task.id);
    if (task.text.trim() === "" || i < 0 || i + 1 >= taskLines) { c.setEditing(null); return; }
    const next = tasks[i + 1];
    c.setEditing(taskKey(next ? next.id : p.addTaskAfterLast(date, task.cat)), date);
  };

  return (
    <>
      {cat && <div class="tmp-wk-catbar" style={{ ...place({ x: 14 - 2, y: y + (taskH - 17) / 2, w: 4, h: 17 }), background: hex(cat.hex) }} />}
      <div class="tmp-cat-cell" title="형광펜 (분류) 고르기" style={place({ x: 4, y: y + 2, w: 18, h: taskH - 4 })}
        onClick={(e) => { e.stopPropagation(); if (!disabled) categoryMenu(e as unknown as MouseEvent, new Menu(), task, (v) => p.setCategory(date, task.id, v), p.categories); }} />
      {editing ? (
        <input ref={ref} class="tmp-editor" style={{ ...place({ x: textX - 4, y: y + 2, w: width + 8, h: taskH - 4 }), fontSize: `${font}px` }}
          value={task.text}
          onInput={(e) => p.setTaskText(date, task.id, (e.target as HTMLInputElement).value)}
          onKeyDown={(e) => {
            if (e.isComposing) return;
            if (e.key === "Escape") { e.preventDefault(); c.setEditing(null); }
            else if (e.key === "Enter") { e.preventDefault(); submit(); }
          }}
          onBlur={() => window.setTimeout(() => { if (c.editingNow() === key) c.setEditing(null); }, 0)} />
      ) : (
        <div class="tmp-wk-task" style={{ ...place({ x: textX, y, w: width, h: taskH }), fontSize: `${font}px`, lineHeight: `${taskH}px` }}
          onClick={() => { if (!disabled) c.setEditing(key, date); }}
          onContextMenu={(e) => { if (disabled) return; e.preventDefault(); taskMenu(e as unknown as MouseEvent, c, date, task); }}>
          <span class="tmp-line-text" style={task.mark === Mark.done && cat ? { backgroundImage: highlight(hex(cat.hex)) } : undefined}>{task.text || " "}</span>
        </div>
      )}
      {more > 0 && (
        <button class="tmp-wk-more" title={`할 일 ${more}개 더 — 일간 페이지에서 보기`}
          style={place({ x: textEnd - 40, y: y + 6, w: 38, h: taskH - 12 })} onClick={() => onOpenDay(date)}>+{more}</button>
      )}
      <button class="tmp-mark" aria-label="체크 표시" style={place(b)} disabled={disabled}
        onClick={(e) => { e.stopPropagation(); if (c.editingNow()?.startsWith("t|")) c.setEditing(null); p.cycleMark(date, task.id); }}>
        {task.mark !== Mark.none && <MarkGlyph mark={task.mark} size={b.w * 0.98} color={accent} stroke={3} />}
      </button>
    </>
  );
}
