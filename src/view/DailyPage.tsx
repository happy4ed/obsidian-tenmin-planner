// 일간 페이지 (디자인 1277 × 2000). 인쇄된 양식 위에 글 · 펜 · 형광펜을 올린다 (원본 DailyPage).
import { Menu } from "obsidian";
import { useEffect, useMemo, useRef } from "preact/hooks";
import * as F from "./form";
import { useCtx } from "./ctx";
import { FormPrint } from "./FormPrint";
import { Tasks } from "./Tasks";
import { Timetable } from "./Timetable";
import { conceptOf, Ink } from "./theme";
import { TEXT_SCALE } from "../canvasWrap";
import * as Dates from "../model/dates";
import { ddayCount, Planner } from "../model/planner";
import { taskLayout } from "../model/day";
import { fitScale, flowLayout } from "../model/ruled";

const COMMENT_FONT = 50;

export function DailyPage() {
  const c = useCtx();
  const { planner: p, date, wrap } = c;
  const day = p.day(date);
  const concept = conceptOf(p.themeOf(date));
  const L = taskLayout(day.tasks, wrap);
  const memo = memoLayout(c.editing, day, wrap);
  const form = useMemo(() => <FormPrint taskRows={L.rows} memoRows={memo.L.rows} commentMenu />, [L.rows, memo.L.rows]);

  return (
    <div class="tmp-page" style={{ width: `${F.PAGE_W}px`, height: `${F.PAGE_H}px`, background: Ink.paper }}
      onPointerDown={(e) => { if (e.target === e.currentTarget) c.setEditing(null); }}>
      {form}
      <DateField accent={concept.accent} tint={concept.tint} />
      <DDayField accent={concept.accent} />
      {day.dayOff
        ? <div class="tmp-dayoff" style={{ ...F.place(F.commentBox), color: concept.accent }}>DAY OFF</div>
        : <Comment text={day.comment} />}
      <CommentMenu dayOff={day.dayOff} />
      <TotalTime minutes={p.minutes(date)} color={concept.accent} />
      <Tasks day={day} accent={concept.accent} />
      <Memos memo={memo} />
      <Timetable date={date} slots={day.slots} notes={day.notes} accent={concept.accent}
        x={F.slotsLeft} y={F.gridTop} cellW={F.cell} rowH={F.hourPitch} />
      <Corners />
    </div>
  );
}

function DateField({ accent, tint }: { accent: string; tint: string }) {
  const { date } = useCtx();
  const digits = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const wd = Dates.weekdayEN[date.getDay()].slice(0, 3);
  return (
    <div class="tmp-date" style={F.place(F.inset(F.dateBox, 16, 16, 10, 16))}>
      <span class="tmp-date-text" style={{ backgroundImage: `linear-gradient(to top, transparent 4%, ${tint} 4%, ${tint} 30%, transparent 30%)` }}>
        <span style={{ color: Ink.text }}>{digits}</span> <span style={{ color: accent }}>{wd}</span>
      </span>
    </div>
  );
}

function DDayField({ accent }: { accent: string }) {
  const c = useCtx();
  const list = c.planner.day(c.date).ddays;
  const two = list.length > 1;
  return (
    <div class="tmp-dday" style={F.place(F.inset(F.ddayBox, 16, 16, 10, 16))} title="이 날의 D-day — 저장한 D-day 를 고르거나 새로 만들어 붙여요 (최대 2개)"
      onClick={() => c.openDDay(c.date)}>
      {list.length === 0 && <div class="tmp-dday-empty">+ D-day</div>}
      {list.map((d) => (
        <div key={d.id} class="tmp-dday-row">
          <span style={{ fontSize: `${(two ? 38 : 48) * TEXT_SCALE}px`, color: Ink.text }}>{d.title || "D-day"}</span>
          <span style={{ fontSize: `${(two ? 46 : 64) * TEXT_SCALE}px`, color: accent, fontWeight: 700 }}>{ddayCount(d, c.date)}</span>
        </div>
      ))}
    </div>
  );
}

function Comment({ text }: { text: string }) {
  const c = useCtx();
  const r = F.inset(F.commentBox, 16, 16, 10, 16);
  const editing = c.editing === "c";
  const sc = fitScale(text, COMMENT_FONT, r.w - 16, 3, c.wrap);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);
  const font = COMMENT_FONT * sc * TEXT_SCALE;
  return editing ? (
    <textarea ref={ref} class="tmp-editor tmp-comment" style={{ ...F.place(r), fontSize: `${font}px` }} value={text}
      onInput={(e) => c.planner.setComment(c.date, (e.target as HTMLTextAreaElement).value)}
      onKeyDown={(e) => {
        if (e.isComposing) return;
        if (e.key === "Escape" || (e.key === "Enter" && !e.altKey && !e.shiftKey)) { e.preventDefault(); c.setEditing(null); }
      }}
      onBlur={() => window.setTimeout(() => { if (c.editingNow() === "c") c.setEditing(null); }, 0)} />
  ) : (
    <div class="tmp-comment-view" style={{ ...F.place(r), fontSize: `${font}px` }} onClick={() => c.setEditing("c")}>{text}</div>
  );
}

/** COMMENT 라벨 바로 뒤의 ▾ : 작성하기 · DAY OFF */
function CommentMenu({ dayOff }: { dayOff: boolean }) {
  const c = useCtx();
  return (
    <button class="tmp-comment-menu" aria-label="COMMENT 메뉴" style={F.place({ x: 160.3 + 2, y: F.headerY - 14, w: 26, h: 28 })}
      onClick={(e) => {
        const m = new Menu();
        m.addItem((it) => it.setTitle("작성하기").setChecked(!dayOff).onClick(() => { c.setEditing(null); c.planner.setDayOff(c.date, false); }));
        m.addItem((it) => it.setTitle("DAY OFF").setChecked(dayOff).onClick(() => { c.setEditing(null); c.planner.setDayOff(c.date, true); }));
        m.showAtMouseEvent(e as unknown as MouseEvent);
      }}>▾</button>
  );
}

function TotalTime({ minutes, color }: { minutes: number; color: string }) {
  const [h, m] = Dates.formatHM(minutes);
  return (
    <div class="tmp-total" style={{ ...F.place(F.inset(F.totalBox, 16, 16, 10, 16)), color, opacity: minutes === 0 ? 0.12 : 1 }}>
      <span class="d">{h}</span><span class="u">H</span><span class="d">{m}</span><span class="u">M</span>
    </div>
  );
}

// ── MEMO ──────────────────────────────────────────────

interface MemoState { L: ReturnType<typeof flowLayout>; n: number; }

function memoLayout(editing: string | null, day: ReturnType<Planner["day"]>, wrap: Parameters<typeof flowLayout>[4]): MemoState {
  const n = Planner.memoCount(day);
  const items = Array.from({ length: n }, (_, i) => day.memos[i] ?? "");
  if (editing === `m|${n}` || editing === `mt|${n}`) items.push("");
  return { L: flowLayout(items, F.memoCount, F.memoFont, F.memoTextWidth - 12, wrap), n };
}

function Memos({ memo }: { memo: MemoState }) {
  const c = useCtx();
  const { L, n } = memo;
  const day = c.planner.day(c.date);
  const p = F.memoPitch(L.rows);
  const sc = L.scale;
  const font = F.memoFont * sc * TEXT_SCALE;
  return (
    <>
      {L.lines.map((lines, i) => {
        const r0 = L.start[i];
        return (
          <div key={`memo${i}`}>
            <MemoField k={`mt|${i}`} value={day.memoTags[i] ?? ""} center
              rect={{ x: F.left + 4, y: F.memoTop + r0 * p, w: F.categoryX - F.left - 8, h: p }} font={34 * sc * TEXT_SCALE} pitch={p}
              lines={[day.memoTags[i] ?? ""]} onInput={(v) => c.planner.setMemoTag(c.date, i, v)} next={`m|${i}`} />
            <MemoField k={`m|${i}`} value={day.memos[i] ?? ""}
              rect={{ x: F.memoTextX, y: F.memoTop + r0 * p, w: F.memoTextWidth, h: lines.length * p }} font={font} pitch={p}
              lines={lines} onInput={(v) => c.planner.setMemo(c.date, i, v)} next={`m|${i + 1}`} />
          </div>
        );
      })}
      {Array.from({ length: Math.max(0, L.rows - L.used) }, (_, j) => L.used + j).map((r) => (
        <div key={`me${r}`}>
          <div class="tmp-hit" style={F.place({ x: F.left + 4, y: F.memoTop + r * p, w: F.categoryX - F.left - 8, h: p })} onClick={() => c.setEditing(`mt|${n}`)} />
          <div class="tmp-hit" style={F.place({ x: F.memoTextX, y: F.memoTop + r * p, w: F.memoTextWidth, h: p })} onClick={() => c.setEditing(`m|${n}`)} />
        </div>
      ))}
    </>
  );
}

function MemoField({ k, value, rect, font, pitch, lines, onInput, next, center }: {
  k: string; value: string; rect: F.Rect; font: number; pitch: number; lines: string[];
  onInput: (v: string) => void; next: string; center?: boolean;
}) {
  const c = useCtx();
  const editing = c.editing === k;
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);
  if (editing) {
    return (
      <textarea ref={ref} class={`tmp-editor ${center ? "is-center" : ""}`} style={{ ...F.place(rect), fontSize: `${font}px`, lineHeight: `${pitch}px` }}
        value={value} onInput={(e) => onInput((e.target as HTMLTextAreaElement).value)}
        onKeyDown={(e) => {
          if (e.isComposing) return;
          if (e.key === "Escape") { e.preventDefault(); c.setEditing(null); }
          else if (e.key === "Enter" && !e.shiftKey && !e.altKey) { e.preventDefault(); c.setEditing(next); }
        }}
        onBlur={() => window.setTimeout(() => { if (c.editingNow() === k) c.setEditing(null); }, 0)} />
    );
  }
  return (
    <div class={`tmp-entry ${center ? "is-center" : ""}`} style={F.place(rect)} onClick={() => c.setEditing(k)}>
      {lines.map((l, j) => (
        <div key={j} class="tmp-line" style={{ top: `${j * pitch}px`, height: `${pitch}px`, lineHeight: `${pitch}px`, fontSize: `${font}px` }}>
          <span class="tmp-line-text">{l || " "}</span>
        </div>
      ))}
    </div>
  );
}

/** 종이 아래 두 모서리: 앞 = 다음 장, 뒤 = 이전 장 */
function Corners() {
  const c = useCtx();
  return (
    <>
      <div class="tmp-corner" title="이전 장 (←)" style={F.place({ x: 28, y: F.PAGE_H - 104, w: 150, h: 104 })}
        onClick={() => c.step(-1)} />
      <div class="tmp-corner" title="다음 장 (→)" style={F.place({ x: F.PAGE_W - 150, y: F.PAGE_H - 104, w: 150, h: 104 })}
        onClick={() => c.step(1)} />
    </>
  );
}
