// Obsidian 탭 하나 = 플래너. 위쪽 도구 팔레트 + 종이 한 장 (폭에 맞춰 비율 유지).
import { ItemView, Menu, WorkspaceLeaf } from "obsidian";
import { render } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import type TenMinPlanner from "../main";
import { Ctx, EditKey, ERASER, ViewCtx } from "./ctx";
import { DailyPage } from "./DailyPage";
import { DDayModal, NewBookModal, PenModal } from "./modals";
import * as F from "./form";
import { hex } from "./theme";
import * as Dates from "../model/dates";
import { bookContains } from "../model/planner";
import { BookInfo } from "../model/types";
import { TASK_FONT } from "../model/day";
import { TEXT_SCALE } from "../canvasWrap";

export const VIEW_TYPE = "tenmin-planner";

/** 종이 배율: 폭 맞춤(종이 한 장이 탭 폭에) 또는 글자 맞춤(할 일 글씨 = 본문 글자 크기), 그 위에 ± 로 곱한다 */
export interface Zoom { mode: "fit" | "text"; factor: number; }
export const DEFAULT_ZOOM: Zoom = { mode: "fit", factor: 1 };
const GUTTER = 24;

function pageScale(z: Zoom, width: number): number {
  let base: number;
  if (z.mode === "text") {
    const body = parseFloat(getComputedStyle(document.body).getPropertyValue("--font-text-size")) || 16;
    base = body / (TASK_FONT * TEXT_SCALE);
  } else {
    base = width > GUTTER ? (width - GUTTER) / F.PAGE_W : 0.3;
  }
  return Math.min(3, Math.max(0.1, base * z.factor));
}

/** 물리 키 → 숫자 (한글 입력 상태에서도 1-7 이 펜) */
const DIGIT_CODES = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7"];

export class PlannerView extends ItemView {
  constructor(leaf: WorkspaceLeaf, private plugin: TenMinPlanner) { super(leaf); }

  getViewType(): string { return VIEW_TYPE; }
  getDisplayText(): string { return this.plugin.planner?.book?.name ?? "10분 플래너"; }
  getIcon(): string { return "calendar-clock"; }

  async onOpen(): Promise<void> {
    this.contentEl.addClass("tmp-view");
    render(<Root plugin={this.plugin} view={this} />, this.contentEl);
  }

  async onClose(): Promise<void> {
    render(null, this.contentEl);
    await this.plugin.flush();
  }

  /** 명령 팔레트용: 지금 보는 날을 옮긴다 */
  command: ((cmd: "prev" | "next" | "today") => void) | null = null;
}

function clamp(d: Date, b: BookInfo | null): Date {
  if (!b) return Dates.day(d);
  if (Dates.day(d) < Dates.day(b.start)) return Dates.day(b.start);
  if (b.end && Dates.day(d) > Dates.day(b.end)) return Dates.day(b.end);
  return Dates.day(d);
}

function Root({ plugin, view }: { plugin: TenMinPlanner; view: PlannerView }) {
  const [, setVersion] = useState(0);
  useEffect(() => plugin.subscribe(() => setVersion((v) => v + 1)), []);
  const planner = plugin.planner;
  if (!planner) return <div class="tmp-empty">{plugin.loadError ?? "플래너를 여는 중…"}</div>;
  return <Planner plugin={plugin} view={view} key={planner.book?.id ?? "none"} />;
}

function Planner({ plugin, view }: { plugin: TenMinPlanner; view: PlannerView }) {
  const p = plugin.planner!;
  const [date, setDate] = useState(() => clamp(new Date(), p.book));
  // 키를 빠르게 연달아 눌러도 마지막으로 옮긴 날을 기준으로 (렌더를 기다리지 않는다)
  const dateRef = useRef(date);
  const [tool, setTool] = useState(() => p.categories[0]?.id ?? 0);
  const [editing, setEditingState] = useState<EditKey>(null);
  const editingRef = useRef<EditKey>(null);
  const root = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [zoom, setZoomState] = useState(plugin.settings.zoom);

  // 배율: 뷰(탭) 자체의 폭에서 잰다. 종이를 담는 칸에서 재면 종이 크기에 따라 칸이 같이 늘어 배율이 굳을 수 있다.
  useLayoutEffect(() => {
    const host = view.contentEl;
    const measure = () => setWidth(host.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    window.addEventListener("resize", measure);
    const raf = requestAnimationFrame(measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); cancelAnimationFrame(raf); };
  }, []);

  const setZoom = (z: Zoom) => { setZoomState(z); plugin.settings.zoom = z; void plugin.saveSettings(); };
  const scale = pageScale(zoom, width);
  const setEditing = (k: EditKey) => {
    const prev = editingRef.current;
    if (prev === k) return;
    editingRef.current = k;
    plugin.setEditing(k != null);
    setEditingState(k);
    // 할 일 쓰기를 마치면 빈 할 일을 지운다 (지금 쓰는 것은 남긴다)
    if (prev?.startsWith("t|")) p.cleanup(date, k?.startsWith("t|") ? k.slice(2) : null);
  };

  const go = (d: Date) => {
    const next = clamp(d, p.book);
    if (Dates.key(next) === Dates.key(dateRef.current)) return;
    setEditing(null);
    dateRef.current = next;
    setDate(next);
  };
  const step = (n: number) => go(Dates.addDays(n, dateRef.current));

  view.command = (cmd) => {
    if (cmd === "today") go(new Date());
    else step(cmd === "next" ? 1 : -1);
  };

  const ctx: ViewCtx = {
    app: plugin.app, planner: p, wrap: plugin.wrap, date, tool, editing,
    editingNow: () => editingRef.current, setEditing, setTool, go, step,
    openDDay: (d) => { setEditing(null); new DDayModal(plugin.app, p, d).open(); },
  };

  const onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest("textarea, input, [contenteditable=true]") || e.isComposing || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k === "ArrowLeft") step(-1);
    else if (k === "ArrowRight") step(1);
    else if (k === "t" || k === "T" || k === "ㅅ") go(new Date());
    else if (k === "e" || k === "E" || k === "ㄷ") setTool(ERASER);
    else if (k === "Escape") setEditing(null);
    else if (DIGIT_CODES.includes(e.code)) {
      const cat = p.categories[DIGIT_CODES.indexOf(e.code)];
      if (!cat) return;
      setTool(cat.id);
    } else return;
    e.preventDefault();
  };

  const atStart = !!p.book && !bookContains(p.book, Dates.addDays(-1, date));
  const atEnd = !!p.book && !bookContains(p.book, Dates.addDays(1, date));

  return (
    <Ctx.Provider value={ctx}>
      <div class="tmp-root" ref={root} tabIndex={0} onKeyDown={onKey as never}>
        <Palette plugin={plugin} date={date} tool={tool} setTool={setTool} go={go} step={step} atStart={atStart} atEnd={atEnd}
          openDDay={() => ctx.openDDay(date)} zoom={zoom} setZoom={setZoom} />
        <div class="tmp-scroller">
          <div class="tmp-sheet" style={{ width: `${F.PAGE_W * scale}px`, height: `${F.PAGE_H * scale}px` }}>
            <div class="tmp-scale" style={{ transform: `scale(${scale})` }}>
              <DailyPage />
            </div>
          </div>
        </div>
      </div>
    </Ctx.Provider>
  );
}

function Palette({ plugin, date, tool, setTool, go, step, atStart, atEnd, openDDay, zoom, setZoom }: {
  plugin: TenMinPlanner; date: Date; tool: number; setTool(t: number): void; go(d: Date): void; step(n: number): void;
  atStart: boolean; atEnd: boolean; openDDay(): void; zoom: Zoom; setZoom(z: Zoom): void;
}) {
  const p = plugin.planner!;
  const books = plugin.store.library.books;

  const bookMenu = (e: MouseEvent) => {
    const m = new Menu();
    for (const b of books) {
      const name = b.isSample && !b.name.includes("예시") ? `${b.name} · 예시` : b.name;
      m.addItem((it) => it.setTitle(name).setChecked(b.id === p.book?.id).onClick(() => void plugin.switchBook(b.id)));
    }
    m.addSeparator();
    m.addItem((it) => it.setTitle("새 플래너…").setIcon("plus").onClick(() => {
      const n = books.filter((b) => !b.isSample).length;
      new NewBookModal(plugin.app, n ? `내 플래너 ${n + 1}` : "내 플래너", (name, s, en) => void plugin.createBook(name, s, en)).open();
    }));
    m.showAtMouseEvent(e);
  };

  const period = p.book ? `${Dates.key(p.book.start)} – ${p.book.end ? Dates.key(p.book.end) : "계속"}` : "";

  return (
    <div class="tmp-palette">
      <button class="tmp-book" title={`${p.book?.name ?? ""} · ${period}`} onClick={bookMenu as never}>
        📓 {p.book?.name ?? "플래너"} ▾
      </button>
      <div class="tmp-nav">
        <button aria-label="이전 장" title="이전 장 (←)" disabled={atStart} onClick={() => step(-1)}>‹</button>
        <span class="tmp-nav-date">{Dates.key(date)} {Dates.weekdayEN[date.getDay()].slice(0, 3)}</span>
        <button aria-label="다음 장" title="다음 장 (→)" disabled={atEnd} onClick={() => step(1)}>›</button>
        <button title="오늘 (T)" disabled={Dates.isToday(date)} onClick={() => go(new Date())}>오늘</button>
        <button title="이 날의 D-day" onClick={openDDay}>D-day</button>
      </div>
      <div class="tmp-pens">
        {p.categories.map((c, i) => (
          <button key={c.id} class={`tmp-pen ${tool === c.id ? "is-active" : ""}`} title={`${c.name} (${i + 1}) — 두 번 눌러 이름 · 색 바꾸기`}
            onClick={() => setTool(c.id)} onDblClick={() => new PenModal(plugin.app, p, c).open()}>
            <span class="tmp-swatch" style={{ background: hex(c.hex) }} />{c.name}
          </button>
        ))}
        <button class={`tmp-pen ${tool === ERASER ? "is-active" : ""}`} title="지우개 (E) — 칠한 칸, 글씨, 밥시간을 지운다"
          onClick={() => setTool(ERASER)}>⌫ 지우개</button>
      </div>
      <div class="tmp-zoom">
        <button aria-label="작게" title="작게" onClick={() => setZoom({ mode: zoom.mode, factor: Math.max(0.5, zoom.factor / 1.15) })}>−</button>
        <button class={zoom.mode === "fit" && zoom.factor === 1 ? "is-active" : ""} title="종이 한 장이 폭에 꼭 맞게"
          onClick={() => setZoom({ mode: "fit", factor: 1 })}>폭</button>
        <button class={zoom.mode === "text" && zoom.factor === 1 ? "is-active" : ""} title="할 일 글씨가 Obsidian 본문 글자 크기와 같게"
          onClick={() => setZoom({ mode: "text", factor: 1 })}>글자</button>
        <button aria-label="크게" title="크게" onClick={() => setZoom({ mode: zoom.mode, factor: Math.min(3, zoom.factor * 1.15) })}>+</button>
      </div>
      <button class="tmp-gear" aria-label="설정" title="설정" onClick={() => plugin.openSettings()}>⚙</button>
    </div>
  );
}
