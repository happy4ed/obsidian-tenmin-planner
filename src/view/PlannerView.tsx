// Obsidian 탭 하나 = 플래너. 위쪽 도구 팔레트 + 종이 한 장 (폭에 맞춰 비율 유지).
import { ItemView, Menu, WorkspaceLeaf } from "obsidian";
import { render } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import type TenMinPlanner from "../main";
import { Ctx, EditKey, ERASER, MEAL_TOOL, TEXT_TOOL, ViewCtx } from "./ctx";
import { concepts } from "./theme";
import { DailyPage } from "./DailyPage";
import { WeeklyPage, WEEK_H, WEEK_TASK_FONT, WEEK_W } from "./WeeklyPage";
import { HomePage } from "./HomePage";
import { Front, FrontPage } from "./FrontPage";
import { DDayModal, PenModal } from "./modals";
import { RepeatListModal } from "./repeatModals";
import * as F from "./form";
import { hex } from "./theme";
import * as Dates from "../model/dates";
import { bookContains } from "../model/planner";
import { BookInfo, PageKind } from "../model/types";
import { TASK_FONT } from "../model/day";
import { TEXT_SCALE } from "../canvasWrap";

export const VIEW_TYPE = "tenmin-planner";

/**
 * 종이 배율. page = 종이 한 장이 화면에 통째로 (폭 · 높이 둘 다), fit = 폭에 맞게,
 * text = 할 일 글씨가 본문 글자 크기와 같게. 그 위에 ± 로 곱한다.
 */
export interface Zoom { mode: "page" | "fit" | "text"; factor: number; }
export const DEFAULT_ZOOM: Zoom = { mode: "page", factor: 1 };
export type Zooms = Record<"daily" | "weekly" | "home", Zoom>;
/** 홈은 종이가 아니라 카드라서 배율만 (factor) 쓴다 */
export const defaultZooms = (): Zooms => ({ daily: { ...DEFAULT_ZOOM }, weekly: { ...DEFAULT_ZOOM }, home: { mode: "fit", factor: 1 } });
const GUTTER = 24;
const MIN_FACTOR = 0.25, MAX_FACTOR = 3;
const HOME_MIN = 0.5, HOME_MAX = 2.5;

interface Area { w: number; h: number; }

function pageScale(z: Zoom, area: Area, pageW: number, pageH: number, taskFont: number): number {
  const byW = area.w > GUTTER ? (area.w - GUTTER) / pageW : 0.3;
  let base: number;
  if (z.mode === "text") {
    const body = parseFloat(getComputedStyle(document.body).getPropertyValue("--font-text-size")) || 16;
    base = body / (taskFont * TEXT_SCALE);
  } else if (z.mode === "page") {
    base = Math.min(byW, area.h > GUTTER ? (area.h - GUTTER) / pageH : byW);
  } else {
    base = byW;
  }
  return Math.min(3, Math.max(0.05, base * z.factor));
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

  /** 지금 보는 쪽 종류와 날 (PDF 창이 기간을 채울 때) */
  current: { kind: PageKind; date: Date } | null = null;

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
  const [slow, setSlow] = useState(false);
  const rendered = plugin.planner;
  // 구독을 그리기 직후에 걸고, 그 사이 불러오기가 끝났으면 바로 다시 그린다 (알림을 놓치면 "여는 중" 에 멈춘다)
  useLayoutEffect(() => {
    const off = plugin.subscribe(() => setVersion((v) => v + 1));
    if (plugin.planner !== rendered) setVersion((v) => v + 1);
    return off;
  }, []);
  // 오래 걸리면 다시 시도 버튼
  useEffect(() => {
    if (plugin.planner) return;
    const t = window.setTimeout(() => setSlow(true), 6000);
    return () => window.clearTimeout(t);
  }, [plugin.planner]);
  const planner = plugin.planner;
  if (!planner) {
    return (
      <div class="tmp-empty">
        <div>{plugin.loadError ?? "플래너를 여는 중…"}</div>
        {(plugin.loadError || slow) && (
          <button class="mod-cta" onClick={() => { setSlow(false); void plugin.openStore(); }}>다시 시도</button>
        )}
      </div>
    );
  }
  return <Planner plugin={plugin} view={view} key={planner.book?.id ?? "none"} />;
}

function Planner({ plugin, view }: { plugin: TenMinPlanner; view: PlannerView }) {
  const p = plugin.planner!;
  const [kind, setKindState] = useState<PageKind>(() => p.data.prefs.lastKind);
  const [front, setFrontState] = useState<Front | null>(null);
  const frontRef = useRef<Front | null>(null);
  const lastPage = useRef<PageKind>(kind === "home" ? "daily" : kind);
  const [date, setDate] = useState(() => clamp(new Date(), p.book));
  // 키를 빠르게 연달아 눌러도 마지막으로 옮긴 날을 기준으로 (렌더를 기다리지 않는다)
  const dateRef = useRef(date);
  const kindRef = useRef(kind);
  const [toolState, setTool] = useState(() => p.categories[0]?.id ?? 0);
  // 고른 펜을 설정에서 지웠으면 첫 펜으로
  const tool = toolState >= 0 && !p.category(toolState) ? (p.categories[0]?.id ?? 0) : toolState;
  const [editing, setEditingState] = useState<EditKey>(null);
  const editingRef = useRef<EditKey>(null);
  const editDateRef = useRef<Date | null>(null);
  const [area, setArea] = useState<Area>({ w: 0, h: 0 });
  const [statusGap, setStatusGap] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  // 크기는 일간 · 주간 따로 기억한다 (주간은 7칸이라 폰에서는 글자 맞춤이 낫다)
  const [zooms, setZooms] = useState(plugin.settings.zooms);

  // 종이 칸 크기: 탭 폭과 화면(보이는 영역) 폭 중 작은 쪽, 높이는 종이 칸 위끝부터 화면 아래까지.
  // 종이를 담는 칸 자체에서 재면 종이 크기에 따라 칸이 같이 늘어 배율이 굳을 수 있고,
  // 폰에서는 탭 상자가 화면보다 넓게 잡힐 수 있어 화면 폭으로 한 번 더 막는다.
  useLayoutEffect(() => {
    const host = view.contentEl;
    const measure = () => {
      const vv = window.visualViewport;
      const vw = vv?.width ?? window.innerWidth, vh = vv?.height ?? window.innerHeight;
      const hr = host.getBoundingClientRect();
      const top = scroller.current?.getBoundingClientRect().top ?? hr.top;
      // 종이 아래 편집 줄 높이는 뺀다 (종이 칸 자체의 높이로 재면 종이 크기에 따라 늘 수 있어 쓰지 않는다)
      // 탭 아래 끝을 덮는 바가 있으면 그 높이만큼 아래 줄 밑을 비운다:
      // 데스크톱 오른쪽 아래 상태 표시줄(백링크 · 단어 수), 폰 화면 아래에 떠 있는 내비게이션 바
      const bars = new Set<Element>(Array.from(document.querySelectorAll(".status-bar, .mobile-navbar, .mobile-toolbar")));
      // 이름을 모르는 떠 있는 바도: 탭 아래쪽 몇 점을 탭 밖의 것이 덮고 있으면 그것 (바가 화면 끝에서 떠 있을 수 있어 높이를 몇 군데)
      const yb = Math.min(hr.bottom, vh);
      for (const fy of [4, 24, 48]) for (const fx of [0.2, 0.5, 0.8]) {
        for (const el of document.elementsFromPoint(hr.left + hr.width * fx, yb - fy)) {
          if (host.contains(el) || el.contains(host)) break;
          bars.add(el);
        }
      }
      let gap = 0;
      for (const el of bars) {
        if (host.contains(el) || el.getClientRects().length === 0) continue; // 고정 위치라 offsetParent 로는 못 본다
        const r = el.getBoundingClientRect();
        // 화면 전체를 덮는 창 (모달 바탕 등) 은 바가 아니다
        if (r.height <= 0 || r.height > vh * 0.3 || r.top < hr.top + hr.height / 2) continue;
        if (r.left < hr.right && r.right > hr.left && r.top < hr.bottom && r.bottom > hr.top) gap = Math.max(gap, Math.ceil(hr.bottom - r.top));
      }
      // 떠 있는 바와 아래 줄 사이를 조금 띄운다
      if (gap > 0) gap += 8;
      setStatusGap((g) => (g === gap ? g : gap));
      const toolbar = host.querySelector(".tmp-toolbar") as HTMLElement | null;
      // 아래 줄 높이 = 지금 높이 - 지금 여백 + 새 여백 (여백을 바꾸기 전에 재도 맞게)
      const curGap = toolbar ? parseFloat(toolbar.dataset.gap ?? "0") : 0;
      const tools = toolbar ? toolbar.offsetHeight - curGap + gap : 0;
      const w = Math.round(Math.min(hr.width || vw, vw));
      const h = Math.round(Math.max(0, Math.min(hr.bottom || vh, vh) - tools - top));
      setArea((a) => (a.w === w && a.h === h ? a : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    // 상태 표시줄 · 폰 내비게이션 바는 켜고 끄거나 숨을 수 있다 (크기가 바뀌면 다시 잰다)
    document.querySelectorAll(".status-bar, .mobile-navbar, .mobile-toolbar").forEach((el) => ro.observe(el));
    // 툴바가 여러 줄로 내려가면 종이 칸이 줄어든다
    host.querySelectorAll(".tmp-navbar, .tmp-toolbar").forEach((el) => ro.observe(el));
    const raf = requestAnimationFrame(measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      cancelAnimationFrame(raf);
    };
  }, []);

  const zk: keyof Zooms = kind;
  const zoom = zooms[zk] ?? defaultZooms()[zk];
  /** 크기 바꾸기: 빠르게 연달아 눌러도 마지막 값에서 (렌더를 기다리지 않는다) */
  const setZoom = (z: Zoom | ((cur: Zoom) => Zoom)) => {
    const all = plugin.settings.zooms;
    const cur = all[zk] ?? defaultZooms()[zk];
    const next = { ...all, [zk]: typeof z === "function" ? z(cur) : z };
    plugin.settings.zooms = next;
    setZooms(next);
    void plugin.saveSettings();
  };
  const pageW = kind === "weekly" ? WEEK_W : F.PAGE_W, pageH = kind === "weekly" ? WEEK_H : F.PAGE_H;
  const scale = pageScale(zoom, area, pageW, pageH, kind === "weekly" ? WEEK_TASK_FONT : TASK_FONT);
  const pinchState = useRef({ kind, zoom, scale, setZoom });
  pinchState.current = { kind, zoom, scale, setZoom };

  // 두 손가락 벌리기 · 오므리기: 움직이는 동안은 종이를 그림처럼 늘였다 줄이고 (가볍게),
  // 손을 떼면 배율을 저장하고 손가락 사이 그 자리가 그대로 손가락 밑에 오게 스크롤을 맞춘다
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    type Pinch = { d0: number; mx0: number; my0: number; ox: number; oy: number; w0: number; lo: number; hi: number; r: number; mx: number; my: number; target: HTMLElement };
    let pin: Pinch | null = null;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const mid = (t: TouchList) => ({ x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 });
    const start = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      const target = el.firstElementChild as HTMLElement | null;
      const d0 = dist(e.touches);
      if (!target || d0 < 10) return;
      const { kind: k, zoom: z, scale: s } = pinchState.current;
      const m = mid(e.touches), tr = target.getBoundingClientRect();
      const [lo, hi] = k === "home" ? [HOME_MIN / z.factor, HOME_MAX / z.factor]
        : [Math.max(MIN_FACTOR / z.factor, 0.05 / s), Math.min(MAX_FACTOR / z.factor, 3 / s)];
      pin = { d0, mx0: m.x, my0: m.y, ox: m.x - tr.left, oy: m.y - tr.top, w0: tr.width, lo, hi, r: 1, mx: m.x, my: m.y, target };
      target.style.transformOrigin = `${pin.ox}px ${pin.oy}px`;
      target.style.willChange = "transform";
      e.preventDefault();
    };
    const move = (e: TouchEvent) => {
      if (!pin || e.touches.length < 2) return;
      e.preventDefault();
      const m = mid(e.touches);
      pin.r = Math.min(pin.hi, Math.max(pin.lo, dist(e.touches) / pin.d0));
      pin.mx = m.x; pin.my = m.y;
      pin.target.style.transform = `translate(${m.x - pin.mx0}px, ${m.y - pin.my0}px) scale(${pin.r})`;
    };
    const end = (e: TouchEvent) => {
      if (!pin || e.touches.length >= 2) return;
      const q = pin;
      pin = null;
      q.target.style.transform = "";
      q.target.style.transformOrigin = "";
      q.target.style.willChange = "";
      if (Math.abs(q.r - 1) < 0.02) return;
      const { kind: k, setZoom: set } = pinchState.current;
      set((z) => (k === "home"
        ? { mode: "fit", factor: Math.round(Math.min(HOME_MAX, Math.max(HOME_MIN, z.factor * q.r)) * 100) / 100 }
        : { mode: z.mode, factor: Math.min(MAX_FACTOR, Math.max(MIN_FACTOR, z.factor * q.r)) }));
      // 다시 그린 뒤 (Preact 는 마이크로태스크에서 그린다), 그리기 전에 스크롤을 맞춘다
      void Promise.resolve().then(() => {
        const t = el.firstElementChild as HTMLElement | null;
        if (!t) return;
        const tr = t.getBoundingClientRect();
        const ra = tr.width / q.w0;
        el.scrollLeft += tr.left + q.ox * ra - q.mx;
        el.scrollTop += tr.top + q.oy * ra - q.my;
      });
    };
    el.addEventListener("touchstart", start, { passive: false });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
    };
  }, []);

  const setEditing = (k: EditKey, onDate?: Date) => {
    const prev = editingRef.current, prevDate = editDateRef.current ?? dateRef.current;
    if (prev === k) return;
    editingRef.current = k;
    editDateRef.current = k ? onDate ?? dateRef.current : null;
    plugin.setEditing(k != null);
    setEditingState(k);
    // 할 일 쓰기를 마치면 빈 할 일을 지운다 (지금 쓰는 것은 남긴다)
    if (prev?.startsWith("t|")) p.cleanup(prevDate, k?.startsWith("t|") ? k.slice(2) : null);
    // 글씨 메모를 다 쓰고 나면 빈 메모는 지운다
    if (prev?.startsWith("n|")) p.cleanupNotes(prevDate);
  };

  const go = (d: Date) => {
    const next = clamp(d, p.book);
    if (Dates.key(next) === Dates.key(dateRef.current)) return;
    setEditing(null);
    dateRef.current = next;
    setDate(next);
  };
  const setFront = (f: Front | null) => { frontRef.current = f; setFrontState(f); };

  /** 일간은 하루, 주간은 한 주씩. 홈은 넘기지 않는다. 첫날(첫 주) 앞에는 첫 장 → 표지 (표지 앞으로는 못 넘김) */
  const step = (n: number) => {
    const k = kindRef.current;
    if (k === "home") return;
    const b = p.book;
    const f = frontRef.current;
    if (f) {
      setEditing(null);
      if (n < 0) { if (f === "motto") setFront("cover"); return; }
      if (f === "cover") { setFront("motto"); return; }
      setFront(null);
      if (b) go(b.start);
      return;
    }
    if (k === "weekly") {
      const ws = Dates.weekStart(dateRef.current);
      const target = Dates.addDays(7 * n, ws);
      // 책 기간과 겹치는 주까지만. 첫 주에서 ← 면 첫 장
      if (b && Dates.addDays(6, target) < Dates.day(b.start)) { if (n < 0) { setEditing(null); setFront("motto"); } return; }
      if (b && b.end && target > Dates.day(b.end)) return;
      go(target);
    } else {
      if (b && n < 0 && Dates.key(dateRef.current) === Dates.key(Dates.day(b.start))) { setEditing(null); setFront("motto"); return; }
      go(Dates.addDays(n, dateRef.current));
    }
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
    else setFront(null); // 홈에는 앞 장이 없다
    kindRef.current = k;
    setKindState(k);
    if (p.data.prefs.lastKind !== k) p.editPrefs((pr) => { pr.lastKind = k; });
  };

  const goToday = () => {
    if (kindRef.current === "home") setKind(lastPage.current);
    setFront(null);
    go(new Date());
  };

  // 노트 카드의 「일간 · 주간 열기」: 그린 뒤 그 날로
  useEffect(() => {
    const o = plugin.pendingOpen;
    if (!o) return;
    plugin.pendingOpen = null;
    setFront(null);
    setKind(o.kind);
    go(o.date);
  });

  // 설정에서 기간을 바꿔 보던 날이 밖으로 나가면 가장 가까운 장으로 (앞 장을 보던 중이면 그대로)
  useEffect(() => {
    if (p.book && !bookContains(p.book, dateRef.current)) go(dateRef.current);
  });

  view.current = { kind, date };

  // 반복 할 일: 펼친 날(주간이면 그 주 7일, 홈이면 오늘)에 아직 안 넣은 것을 넣는다 (넣을 게 없으면 아무것도 바꾸지 않는다)
  useEffect(() => {
    if (front || !p.repeats.length) return;
    const days = kind === "weekly" ? Array.from({ length: 7 }, (_, i) => Dates.addDays(i, Dates.weekStart(date)))
      : kind === "home" ? [Dates.day(new Date())] : [date];
    p.applyRepeats(days);
  });

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
  // 앞 장이 있으면 첫날(첫 주)에서도 ← 가 된다. 표지가 맨 앞
  const atStart = b ? front === "cover" : true;
  const atEnd = !!b && !front && (kind === "weekly" ? !!b.end && Dates.addDays(7, ws) > Dates.day(b.end) : !bookContains(b, Dates.addDays(1, date)));
  const label = front ? (front === "cover" ? "표지" : "첫 장") : kind === "weekly"
    ? `${Dates.key(ws).slice(5)} – ${Dates.key(Dates.addDays(6, ws)).slice(5)}`
    : `${Dates.key(date)} ${Dates.weekdayEN[date.getDay()].slice(0, 3)}`;

  const bars = {
    plugin, kind, setKind, label, date, tool, setTool, step, goToday,
    isToday: !front && (kind === "weekly" ? Dates.weekStart(new Date()).getTime() === ws.getTime() : kind === "daily" && Dates.isToday(date)), front,
    atStart, atEnd, openDDay: () => ctx.openDDay(kind === "daily" ? date : Dates.day(new Date())), zoom, setZoom, scale, statusGap,
  };

  return (
    <Ctx.Provider value={ctx}>
      <div class="tmp-root" tabIndex={0} onKeyDown={onKey as never}>
        <Palette part="top" {...bars} />
        <div class="tmp-scroller" ref={scroller}>
          {kind === "home" ? <div class="tmp-home-zoom" style={{ zoom: String(zoom.factor) }}><HomePage openWeek={openWeek} openDay={openDay} /></div> : (
            <div class="tmp-sheet" style={{ width: `${pageW * scale}px`, height: `${pageH * scale}px` }}>
              <div class="tmp-scale" style={{ transform: `scale(${scale})`, width: `${pageW}px`, height: `${pageH}px` }}>
                {front ? <FrontPage front={front} w={pageW} h={pageH} />
                  : kind === "weekly" ? <WeeklyPage start={ws} onOpenDay={openDay} /> : <DailyPage />}
              </div>
            </div>
          )}
        </div>
        <Palette part="bottom" {...bars} />
      </div>
    </Ctx.Provider>
  );
}

function Palette({ part, plugin, kind, setKind, label, date, tool, setTool, step, goToday, isToday, atStart, atEnd, openDDay, zoom, setZoom, scale, statusGap, front }: {
  /** top = 보기 · 이동 (종이 위), bottom = 편집 도구 (종이 아래) */
  part: "top" | "bottom";
  plugin: TenMinPlanner; kind: PageKind; setKind(k: PageKind): void; label: string; date: Date; tool: number; setTool(t: number): void;
  step(n: number): void; goToday(): void; isToday: boolean; atStart: boolean; atEnd: boolean; openDDay(): void; front: Front | null;
  zoom: Zoom; setZoom(z: Zoom | ((cur: Zoom) => Zoom)): void; scale: number; statusGap: number;
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
    m.addItem((it) => it.setTitle("새 플래너…").setIcon("plus").onClick(() => plugin.newBookDialog()));
    m.addItem((it) => it.setTitle("플래너 관리…").setIcon("settings").onClick(() => plugin.openSettings()));
    m.addSeparator();
    m.addItem((it) => it.setTitle("PDF로 내보내기…").setIcon("file-output").onClick(() => plugin.openPdfDialog()));
    m.addItem((it) => it.setTitle("백업 내보내기").setIcon("download").onClick(() => void plugin.exportBackup()));
    m.addItem((it) => it.setTitle("백업 가져오기…").setIcon("upload").onClick(() => plugin.importBackupDialog()));
    m.showAtMouseEvent(e);
  };

  const period = p.book ? `${Dates.key(p.book.start)} – ${p.book.end ? Dates.key(p.book.end) : "계속"}` : "";

  // 위 (종이 위) = 보기 · 이동: 플래너 · 홈 · 주간 · 일간 · 날짜 · 오늘 · D-day · 크기 · 설정
  // 아래 (종이 아래) = 편집 도구: 형광펜 · 지우개 · 글씨 · 밥 · 컬러
  // 줄마다 한 줄로 두고 넘치면 옆으로 밀어서 본다 (줄이 늘어나 종이를 밀어내지 않게).
  if (part === "top") {
    return (
      <div class="tmp-palette tmp-navbar">
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
        <button title={kind === "daily" ? "이 날의 D-day" : "오늘의 D-day"} disabled={!!front} onClick={openDDay}>D-day</button>
        <button title="반복 할 일 — 매일 · 주마다 · 요일마다 · 달마다 · 연마다" onClick={() => new RepeatListModal(plugin.app, plugin.planner!, Dates.day(new Date())).open()}>↻ 반복</button>
      </div>
      {kind === "home" ? (
        <div class="tmp-zoom">
          <button aria-label="작게" title="작게" onClick={() => setZoom((z) => ({ mode: "fit", factor: Math.round(Math.max(HOME_MIN, z.factor / 1.1) * 100) / 100 }))}>−</button>
          <button class={zoom.factor === 1 ? "is-active" : ""} title="기본 크기" onClick={() => setZoom({ mode: "fit", factor: 1 })}>기본</button>
          <button aria-label="크게" title="크게" onClick={() => setZoom((z) => ({ mode: "fit", factor: Math.round(Math.min(HOME_MAX, z.factor * 1.1) * 100) / 100 }))}>+</button>
          <span class="tmp-zoom-pct" title="지금 홈 배율">{Math.round(zoom.factor * 100)}%</span>
        </div>
      ) : <div class="tmp-zoom">
        <button aria-label="작게" title="작게" onClick={() => setZoom((z) => ({ mode: z.mode, factor: Math.max(MIN_FACTOR, z.factor / 1.2) }))}>−</button>
        {([["page", "한 장", "종이 한 장이 화면에 통째로"], ["fit", "폭", "종이가 화면 폭에 맞게"], ["text", "글자", "할 일 글씨가 Obsidian 본문 글자 크기와 같게"]] as const).map(([m, name, tip]) => (
          <button key={m} class={zoom.mode === m ? "is-active" : ""} title={tip} onClick={() => setZoom({ mode: m, factor: 1 })}>{name}</button>
        ))}
        <button aria-label="크게" title="크게" onClick={() => setZoom((z) => ({ mode: z.mode, factor: Math.min(MAX_FACTOR, z.factor * 1.2) }))}>+</button>
        <span class="tmp-zoom-pct" title="지금 종이 배율">{Math.round(scale * 100)}%</span>
      </div>}
      <button class="tmp-gear" aria-label="설정" title="설정" onClick={() => plugin.openSettings()}>⚙</button>
      </div>
    );
  }
  return (
    <div class="tmp-palette tmp-toolbar" data-gap={statusGap}
      style={statusGap ? { paddingBottom: `calc(6px + ${statusGap}px + env(safe-area-inset-bottom, 0px))` } : undefined}>
      {kind !== "home" && (
        <div class="tmp-pens">
          {p.categories.map((c, i) => (
            <button key={c.id} class={`tmp-pen ${tool === c.id ? "is-active" : ""}`} title={`${c.name} (${i + 1}) — 두 번 눌러 이름 · 색 바꾸기`}
              onClick={() => setTool(c.id)} onDblClick={() => new PenModal(plugin.app, p, c).open()}>
              <span class="tmp-swatch" style={{ background: hex(c.hex) }} />{c.name}
            </button>
          ))}
          <button class={`tmp-pen ${tool === ERASER ? "is-active" : ""}`} title="지우개 (E) — 칠한 칸, 글씨, 밥시간을 지운다"
            onClick={() => setTool(ERASER)}>⌫ 지우개</button>
          <button class={`tmp-pen ${tool === TEXT_TOOL ? "is-active" : ""}`} title="타임테이블에 글씨 쓰기 — 칸을 누르거나 끌어서 쓰기 시작"
            onClick={() => setTool(TEXT_TOOL)}>✎ 글씨</button>
          <button class={`tmp-pen ${tool === MEAL_TOOL ? "is-active" : ""}`} title="밥시간 — 시작 칸부터 끝 칸까지 끌기 (누르기만 하면 1시간)"
            onClick={() => setTool(MEAL_TOOL)}>🍴 밥</button>
        </div>
      )}
      <Colors plugin={plugin} kind={kind} date={date} disabled={!!front} />
    </div>
  );
}

/** 컬러 9개: 일간은 "오늘의 컬러" (그날만), 주간 · 홈은 "기본 컬러". 오른쪽 클릭으로 기본 정하기 · 기본 따르기 */
function Colors({ plugin, kind, date, disabled }: { plugin: TenMinPlanner; kind: PageKind; date: Date; disabled?: boolean }) {
  const p = plugin.planner!;
  const daily = kind === "daily";
  const def = p.data.prefs.defaultTheme;
  const current = daily ? p.themeOf(date) : def;
  return (
    <div class={`tmp-colors ${disabled ? "is-disabled" : ""}`} title={daily ? "오늘의 컬러 — 이 날만 바꿔요" : "기본 컬러 — 따로 고르지 않은 모든 날"}>
      <span class="tmp-colors-label">{daily ? "오늘의 컬러" : "기본 컬러"}</span>
      {concepts.map((cc) => (
        <button key={cc.id} class={`tmp-color ${current === cc.id ? "is-active" : ""}`} aria-label={cc.name} title={def === cc.id ? `${cc.name} · 기본 컬러 (가운데 흰 점)` : cc.name}
          style={{ background: cc.accent }}
          onClick={() => (daily ? p.pickDayTheme(date, cc.id) : p.setDefaultTheme(cc.id))}
          onContextMenu={(e) => {
            e.preventDefault();
            const m = new Menu();
            m.addItem((it) => it.setTitle("기본 컬러로 정하기").setChecked(def === cc.id).onClick(() => p.setDefaultTheme(cc.id)));
            if (daily) m.addItem((it) => it.setTitle("이 날은 기본 컬러 따르기").setDisabled(p.day(date).theme == null).onClick(() => p.setTheme(date, null)));
            m.showAtMouseEvent(e as unknown as MouseEvent);
          }}>
          {def === cc.id && <i class="tmp-color-default" />}
        </button>
      ))}
    </div>
  );
}
