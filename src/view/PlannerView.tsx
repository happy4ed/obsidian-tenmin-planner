// Obsidian 탭 하나 = 플래너. 위쪽 도구 팔레트 + 종이 한 장 (폭에 맞춰 비율 유지).
import { ItemView, Menu, WorkspaceLeaf } from "obsidian";
import { render } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import type TenMinPlanner from "../main";
import { Ctx, EditKey, ERASER, ViewCtx } from "./ctx";
import { DailyPage } from "./DailyPage";
import { WeeklyPage, WEEK_H, WEEK_TASK_FONT, WEEK_W } from "./WeeklyPage";
import { HomePage } from "./HomePage";
import { DDayModal, NewBookModal, PenModal } from "./modals";
import * as F from "./form";
import { hex } from "./theme";
import * as Dates from "../model/dates";
import { bookContains } from "../model/planner";
import { BookInfo, PageKind } from "../model/types";
import { TASK_FONT } from "../model/day";
import { TEXT_SCALE } from "../canvasWrap";

export const VIEW_TYPE = "tenmin-planner";

/** 종이 배율: 폭 맞춤(종이 한 장이 탭 폭에) 또는 글자 맞춤(할 일 글씨 = 본문 글자 크기), 그 위에 ± 로 곱한다 */
export interface Zoom { mode: "fit" | "text"; factor: number; }
export const DEFAULT_ZOOM: Zoom = { mode: "fit", factor: 1 };
export type Zooms = Record<"daily" | "weekly", Zoom>;
export const defaultZooms = (): Zooms => ({ daily: { ...DEFAULT_ZOOM }, weekly: { ...DEFAULT_ZOOM } });
const GUTTER = 24;

function pageScale(z: Zoom, width: number, pageW: number, taskFont: number): number {
  let base: number;
  if (z.mode === "text") {
    const body = parseFloat(getComputedStyle(document.body).getPropertyValue("--font-text-size")) || 16;
    base = body / (taskFont * TEXT_SCALE);
  } else {
    base = width > GUTTER ? (width - GUTTER) / pageW : 0.3;
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
  command: ((cmd: "prev" | "next" | "today" | "daily" | "weekly" | "home") => void) | null = null;
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
  const [kind, setKindState] = useState<PageKind>(() => p.data.prefs.lastKind);
  const lastPage = useRef<PageKind>(kind === "home" ? "daily" : kind);
  const [date, setDate] = useState(() => clamp(new Date(), p.book));
  // 키를 빠르게 연달아 눌러도 마지막으로 옮긴 날을 기준으로 (렌더를 기다리지 않는다)
  const dateRef = useRef(date);
  const kindRef = useRef(kind);
  const [tool, setTool] = useState(() => p.categories[0]?.id ?? 0);
  const [editing, setEditingState] = useState<EditKey>(null);
  const editingRef = useRef<EditKey>(null);
  const editDateRef = useRef<Date | null>(null);
  const [width, setWidth] = useState(0);
  // 크기는 일간 · 주간 따로 기억한다 (주간은 7칸이라 폰에서는 글자 맞춤이 낫다)
  const [zooms, setZooms] = useState(plugin.settings.zooms);

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

  const zk: "daily" | "weekly" = kind === "weekly" ? "weekly" : "daily";
  const zoom = zooms[zk];
  const setZoom = (z: Zoom) => {
    const next = { ...zooms, [zk]: z };
    setZooms(next);
    plugin.settings.zooms = next;
    void plugin.saveSettings();
  };
  const pageW = kind === "weekly" ? WEEK_W : F.PAGE_W, pageH = kind === "weekly" ? WEEK_H : F.PAGE_H;
  const scale = pageScale(zoom, width, pageW, kind === "weekly" ? WEEK_TASK_FONT : TASK_FONT);

  const setEditing = (k: EditKey, onDate?: Date) => {
    const prev = editingRef.current, prevDate = editDateRef.current ?? dateRef.current;
    if (prev === k) return;
    editingRef.current = k;
    editDateRef.current = k ? onDate ?? dateRef.current : null;
    plugin.setEditing(k != null);
    setEditingState(k);
    // 할 일 쓰기를 마치면 빈 할 일을 지운다 (지금 쓰는 것은 남긴다)
    if (prev?.startsWith("t|")) p.cleanup(prevDate, k?.startsWith("t|") ? k.slice(2) : null);
  };

  const go = (d: Date) => {
    const next = clamp(d, p.book);
    if (Dates.key(next) === Dates.key(dateRef.current)) return;
    setEditing(null);
    dateRef.current = next;
    setDate(next);
  };
  /** 일간은 하루, 주간은 한 주씩. 홈은 넘기지 않는다 */
  const step = (n: number) => {
    const k = kindRef.current;
    if (k === "home") return;
    if (k === "weekly") {
      const ws = Dates.weekStart(dateRef.current);
      const target = Dates.addDays(7 * n, ws);
      // 책 기간과 겹치는 주까지만
      const b = p.book;
      if (b && (Dates.addDays(6, target) < Dates.day(b.start) || (b.end && target > Dates.day(b.end)))) return;
      go(target);
    } else go(Dates.addDays(n, dateRef.current));
  };

  const setKind = (k: PageKind) => {
    const from = kindRef.current;
    if (from === k) return;
    setEditing(null);
    if (from === "weekly" && k === "daily") {
      // 보던 주에 오늘이 있으면 오늘, 아니면 그 주 월요일
      const ws = Dates.weekStart(dateRef.current), now = new Date();
      go(Dates.weekStart(now).getTime() === ws.getTime() ? now : ws);
    }
    if (k !== "home") lastPage.current = k;
    kindRef.current = k;
    setKindState(k);
    if (p.data.prefs.lastKind !== k) p.editPrefs((pr) => { pr.lastKind = k; });
  };

  const goToday = () => {
    if (kindRef.current === "home") setKind(lastPage.current);
    go(new Date());
  };

  view.command = (cmd) => {
    if (cmd === "today") goToday();
    else if (cmd === "daily" || cmd === "weekly" || cmd === "home") setKind(cmd);
    else step(cmd === "next" ? 1 : -1);
  };

  const ctx: ViewCtx = {
    app: plugin.app, planner: p, wrap: plugin.wrap, date, tool, editing,
    editingNow: () => editingRef.current, setEditing, setTool, go, step,
    openDDay: (d) => { setEditing(null); new DDayModal(plugin.app, p, d).open(); },
  };

  const openDay = (d: Date) => { setKind("daily"); go(d); };
  const openWeek = (d: Date) => { setKind("weekly"); go(d); };

  const onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest("textarea, input, [contenteditable=true]") || e.isComposing || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key, top = kindRef.current !== "daily"; // 주간 · 홈은 스프링이 위
    if (k === "ArrowLeft") step(-1);
    else if (k === "ArrowRight") step(1);
    else if (top && (k === "ArrowUp" || k === "PageUp")) step(-1);
    else if (top && (k === "ArrowDown" || k === "PageDown")) step(1);
    else if (k === "t" || k === "T" || k === "ㅅ") goToday();
    else if (k === "w" || k === "W" || k === "ㅈ") setKind("weekly");
    else if (k === "d" || k === "D" || k === "ㅇ") setKind("daily");
    else if (k === "h" || k === "H" || k === "ㅗ") setKind("home");
    else if (k === "e" || k === "E" || k === "ㄷ") setTool(ERASER);
    else if (k === "Escape") setEditing(null);
    else if (DIGIT_CODES.includes(e.code)) {
      const cat = p.categories[DIGIT_CODES.indexOf(e.code)];
      if (!cat) return;
      setTool(cat.id);
    } else return;
    e.preventDefault();
  };

  const ws = Dates.weekStart(date);
  const b = p.book;
  const atStart = !!b && (kind === "weekly" ? Dates.addDays(-1, ws) < Dates.day(b.start) : !bookContains(b, Dates.addDays(-1, date)));
  const atEnd = !!b && (kind === "weekly" ? !!b.end && Dates.addDays(7, ws) > Dates.day(b.end) : !bookContains(b, Dates.addDays(1, date)));
  const label = kind === "weekly"
    ? `${Dates.key(ws).slice(5)} – ${Dates.key(Dates.addDays(6, ws)).slice(5)}`
    : `${Dates.key(date)} ${Dates.weekdayEN[date.getDay()].slice(0, 3)}`;

  return (
    <Ctx.Provider value={ctx}>
      <div class="tmp-root" tabIndex={0} onKeyDown={onKey as never}>
        <Palette plugin={plugin} kind={kind} setKind={setKind} label={label} tool={tool} setTool={setTool} step={step}
          goToday={goToday} isToday={kind === "weekly" ? Dates.weekStart(new Date()).getTime() === ws.getTime() : kind === "daily" && Dates.isToday(date)}
          atStart={atStart} atEnd={atEnd} openDDay={() => ctx.openDDay(kind === "daily" ? date : Dates.day(new Date()))} zoom={zoom} setZoom={setZoom} />
        <div class="tmp-scroller">
          {kind === "home" ? <HomePage openWeek={openWeek} openDay={openDay} /> : (
            <div class="tmp-sheet" style={{ width: `${pageW * scale}px`, height: `${pageH * scale}px` }}>
              <div class="tmp-scale" style={{ transform: `scale(${scale})`, width: `${pageW}px`, height: `${pageH}px` }}>
                {kind === "weekly" ? <WeeklyPage start={ws} onOpenDay={openDay} /> : <DailyPage />}
              </div>
            </div>
          )}
        </div>
      </div>
    </Ctx.Provider>
  );
}

function Palette({ plugin, kind, setKind, label, tool, setTool, step, goToday, isToday, atStart, atEnd, openDDay, zoom, setZoom }: {
  plugin: TenMinPlanner; kind: PageKind; setKind(k: PageKind): void; label: string; tool: number; setTool(t: number): void;
  step(n: number): void; goToday(): void; isToday: boolean; atStart: boolean; atEnd: boolean; openDDay(): void;
  zoom: Zoom; setZoom(z: Zoom): void;
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
      <div class="tmp-kinds">
        {([["home", "홈", "H"], ["weekly", "주간", "W"], ["daily", "일간", "D"]] as const).map(([k, name, key]) => (
          <button key={k} class={kind === k ? "is-active" : ""} title={`${name} (${key})`} onClick={() => setKind(k)}>{name}</button>
        ))}
      </div>
      <div class="tmp-nav">
        {kind !== "home" && <button aria-label="이전 장" title="이전 장 (←)" disabled={atStart} onClick={() => step(-1)}>‹</button>}
        {kind !== "home" && <span class="tmp-nav-date">{label}</span>}
        {kind !== "home" && <button aria-label="다음 장" title="다음 장 (→)" disabled={atEnd} onClick={() => step(1)}>›</button>}
        <button title="오늘 (T)" disabled={isToday} onClick={goToday}>오늘</button>
        <button title={kind === "daily" ? "이 날의 D-day" : "오늘의 D-day"} onClick={openDDay}>D-day</button>
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
      {kind !== "home" && <div class="tmp-zoom">
        <button aria-label="작게" title="작게" onClick={() => setZoom({ mode: zoom.mode, factor: Math.max(0.5, zoom.factor / 1.15) })}>−</button>
        <button class={zoom.mode === "fit" && zoom.factor === 1 ? "is-active" : ""} title="종이 한 장이 폭에 꼭 맞게"
          onClick={() => setZoom({ mode: "fit", factor: 1 })}>폭</button>
        <button class={zoom.mode === "text" && zoom.factor === 1 ? "is-active" : ""} title="할 일 글씨가 Obsidian 본문 글자 크기와 같게"
          onClick={() => setZoom({ mode: "text", factor: 1 })}>글자</button>
        <button aria-label="크게" title="크게" onClick={() => setZoom({ mode: zoom.mode, factor: Math.min(3, zoom.factor * 1.15) })}>+</button>
      </div>}
      <button class="tmp-gear" aria-label="설정" title="설정" onClick={() => plugin.openSettings()}>⚙</button>
    </div>
  );
}
