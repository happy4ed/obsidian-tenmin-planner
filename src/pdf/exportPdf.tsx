// PDF 로 뽑기 (원본 PDF-02 ~ PDF-07). 종이 화면을 인쇄 모드로 따로 그려 한 장씩 이미지로 떠서 A4 에 놓는다.
// (데스크톱 인쇄 기능은 폰에서 쓸 수 없어서, 폰 · 데스크톱 모두 같은 방법으로 만든다)
//   일간 A4 반쪽 · 두 장씩: A4 가로 한 장에 이틀 (가운데를 자르면 실물 크기), 앞 장은 표지 · 첫 장이 나란히
//   일간 A4 세로: 하루 한 장 · 주간: A4 가로 한 주 한 장 · 홈: A4 가로 1장 (오늘 기준)
import { render } from "preact";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { Ctx, ViewCtx } from "../view/ctx";
import { DailyPage } from "../view/DailyPage";
import { WeeklyPage, WEEK_H, WEEK_W } from "../view/WeeklyPage";
import { FrontPage, Front } from "../view/FrontPage";
import { HomePage } from "../view/HomePage";
import { PAGE_H, PAGE_W } from "../view/form";
import { Ink } from "../view/theme";
import * as Dates from "../model/dates";
import { Planner } from "../model/planner";
import { Wrap } from "../model/ruled";
import { hasRecord } from "../model/day";

export type PdfKind = "daily" | "weekly" | "home";
export type Paper = "half" | "a4";

export interface PdfOptions {
  kind: PdfKind;
  paper: Paper;
  from: Date;
  to: Date;
  front: boolean;
  cutLine: boolean;
}

type Item = { front: Front } | { day: Date } | { week: Date } | { home: true };

/** 책 기간 안으로. 종료일이 없으면 시작일 · 오늘 중 늦은 날 + 1년까지 */
export function bookRange(p: Planner): [Date, Date] {
  const b = p.book;
  const today = Dates.day(new Date());
  if (!b) return [Dates.addDays(-365, today), Dates.addDays(365, today)];
  const start = Dates.day(b.start);
  const end = b.end ? Dates.day(b.end) : Dates.addDays(365, start > today ? start : today);
  return [start, end];
}

export function clampRange(p: Planner, a: Date, b: Date): [Date, Date] {
  const [lo, hi] = bookRange(p);
  const c = (d: Date) => (d < lo ? lo : d > hi ? hi : Dates.day(d));
  const x = c(a), y = c(b);
  return x <= y ? [x, y] : [y, x];
}

/** 기록이 있는 첫 날 ~ 마지막 날 (D-day 만 붙인 날은 빼고) */
export function recordedRange(p: Planner): [Date, Date] | null {
  const keys = Object.entries(p.data.days).filter(([, r]) => hasRecord(r)).map(([k]) => k).sort();
  if (!keys.length) return null;
  return [Dates.parseKey(keys[0])!, Dates.parseKey(keys[keys.length - 1])!];
}

export function plan(p: Planner, o: PdfOptions): Item[] {
  const items: Item[] = [];
  if (o.kind === "home") return [{ home: true }];
  if (o.front && p.book) items.push({ front: "cover" }, { front: "motto" });
  const [a, b] = clampRange(p, o.from, o.to);
  if (o.kind === "daily") {
    for (let d = a; d <= b; d = Dates.addDays(1, d)) items.push({ day: d });
  } else {
    for (let w = Dates.weekStart(a); w <= b; w = Dates.addDays(7, w)) items.push({ week: w });
  }
  return items;
}

/** 요약 문구: "표지·첫 장 + 14일 · A4 가로 8장 (두 장씩)" */
export function summary(p: Planner, o: PdfOptions): string {
  const items = plan(p, o);
  if (o.kind === "home") return "A4 가로 1장";
  const fronts = items.filter((i) => "front" in i).length;
  const n = items.length - fronts;
  const head = fronts ? "표지·첫 장 + " : "";
  if (o.kind === "weekly") return `${head}${n}주 · A4 가로 ${items.length}장`;
  if (o.paper === "half") return `${head}${n}일 · A4 가로 ${Math.ceil(items.length / 2)}장 (두 장씩)`;
  return `${head}${n}일 · A4 세로 ${items.length}장`;
}

export function fileName(p: Planner, o: PdfOptions): string {
  const name = (p.book?.name ?? "플래너").replace(/[/:\\\n\t]/g, "-");
  if (o.kind === "home") return `${name} 홈.pdf`;
  const [a, b] = clampRange(p, o.from, o.to);
  const k = (d: Date) => Dates.key(d).replace(/-/g, "");
  const layout = o.kind === "weekly" ? "주간" : o.paper === "half" ? "일간(A4 반쪽)" : "일간(A4 세로)";
  return `${name} ${layout} ${k(a)}-${k(b)}.pdf`;
}

const tick = () => new Promise<void>((r) => window.setTimeout(r, 0));

async function snap(host: HTMLElement, p: Planner, wrap: Wrap, item: Item, kind: PdfKind): Promise<{ img: string; w: number; h: number }> {
  const portrait = kind === "daily";
  const w = "home" in item ? 1400 : portrait ? PAGE_W : WEEK_W;
  const h = "home" in item ? 0 : portrait ? PAGE_H : WEEK_H;
  const date = "day" in item ? item.day : "week" in item ? item.week : Dates.day(new Date());
  const ctx: ViewCtx = {
    app: null as never, planner: p, wrap, date, tool: -99, editing: null, printing: true,
    editingNow: () => null, setEditing: () => {}, setTool: () => {}, go: () => {}, step: () => {}, openDDay: () => {},
  };
  const box = document.createElement("div");
  box.className = "tmp-print-box";
  box.style.width = `${w}px`;
  if (h) box.style.height = `${h}px`;
  host.appendChild(box);
  render(
    <Ctx.Provider value={ctx}>
      {"front" in item ? <FrontPage front={item.front} w={w} h={h} />
        : "week" in item ? <WeeklyPage start={item.week} onOpenDay={() => {}} />
        : "home" in item ? <div class="tmp-print-home"><HomePage openWeek={() => {}} openDay={() => {}} /></div>
        : <DailyPage />}
    </Ctx.Provider>,
    box,
  );
  await tick();
  const canvas = await html2canvas(box, { scale: "home" in item ? 1.2 : 1, backgroundColor: Ink.paper, logging: false, useCORS: false });
  render(null, box);
  box.remove();
  return { img: canvas.toDataURL("image/jpeg", 0.88), w: canvas.width, h: canvas.height };
}

/** 그림을 칸(x, y, w, h mm) 안에 비율을 지켜 가운데 놓는다 */
function place(doc: jsPDF, s: { img: string; w: number; h: number }, x: number, y: number, w: number, h: number): void {
  const k = Math.min(w / s.w, h / s.h);
  const iw = s.w * k, ih = s.h * k;
  doc.addImage(s.img, "JPEG", x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}

export async function buildPdf(p: Planner, wrap: Wrap, o: PdfOptions, progress: (done: number, total: number) => void): Promise<ArrayBuffer> {
  const items = plan(p, o);
  const landscape = o.kind !== "daily" || o.paper === "half";
  const doc = new jsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "mm", format: "a4", compress: true });
  const layout = o.kind === "home" ? "홈" : o.kind === "weekly" ? "주간" : o.paper === "half" ? "일간 (A4 반쪽)" : "일간 (A4 세로)";
  doc.setProperties({ title: `${p.book?.name ?? "플래너"} — ${layout}`, creator: "10분 플래너" });
  const host = document.createElement("div");
  host.className = "tmp-print-host";
  document.body.appendChild(host);
  try {
    const W = landscape ? 297 : 210, H = landscape ? 210 : 297, m = 6;
    const half = o.kind === "daily" && o.paper === "half";
    const perSheet = half ? 2 : 1;
    let n = 0;
    for (let i = 0; i < items.length; i += perSheet) {
      if (i > 0) doc.addPage();
      for (let j = 0; j < perSheet && i + j < items.length; j++) {
        const s = await snap(host, p, wrap, items[i + j], o.kind);
        if (half) place(doc, s, j * (W / 2) + m, m, W / 2 - 2 * m, H - 2 * m);
        else place(doc, s, m, m, W - 2 * m, H - 2 * m);
        progress(++n, items.length);
        await tick();
      }
      if (half && o.cutLine) {
        // 가운데 자르는 선: 0.5pt 점선 3-3, 위아래 8pt 눈금
        const pt = 0.3528;
        doc.setDrawColor(150);
        doc.setLineWidth(0.5 * pt);
        doc.setLineDashPattern([3 * pt, 3 * pt], 0);
        doc.line(W / 2, 0, W / 2, H);
        doc.setLineDashPattern([], 0);
        doc.line(W / 2, 0, W / 2, 8 * pt);
        doc.line(W / 2, H - 8 * pt, W / 2, H);
      }
    }
  } finally {
    host.remove();
  }
  return doc.output("arraybuffer");
}
