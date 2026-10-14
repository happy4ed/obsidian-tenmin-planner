// 책 맨 앞의 두 장 (원본 FrontMatter): 표지 → 첫 장 → 첫날(첫 주). 일간 · 주간에 모두 있고 홈에는 없다.
// 표지: 책 이름 · 기간 · "PLANNER ── 2026" 머리선 · 표지 색 띠. 이름 · 표지 색은 설정에서만 고친다.
// 첫 장: 적고 싶은 말 (prefs.motto). 가운데 정렬, 길면 글자가 줄어든다.
import { useEffect, useRef } from "preact/hooks";
import { useCtx } from "./ctx";
import { conceptOf, Ink } from "./theme";
import { TEXT_SCALE } from "../canvasWrap";
import { fitScale } from "../model/ruled";

export type Front = "cover" | "motto";

const fmt = (d: Date) => `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;

export function FrontPage({ front, w, h }: { front: Front; w: number; h: number }) {
  const c = useCtx();
  return (
    <div class="tmp-page tmp-front" style={{ width: `${w}px`, height: `${h}px`, background: Ink.paper }}
      onPointerDown={(e) => { if (e.target === e.currentTarget) c.setEditing(null); }}>
      {front === "cover" ? <Cover w={w} h={h} /> : <Motto w={w} h={h} />}
    </div>
  );
}

function Cover({ w, h }: { w: number; h: number }) {
  const c = useCtx();
  const b = c.planner.book;
  if (!b) return null;
  const color = conceptOf(b.cover).accent;
  const y0 = b.start.getFullYear(), y1 = b.end?.getFullYear();
  const years = y1 && y1 !== y0 ? `${y0} – ${y1}` : String(y0);
  const nameW = w * 0.74;
  const fit = fitScale(b.name, 124, nameW, 2, c.wrap, 0.4);
  const portrait = h > w;
  return (
    <>
      <div class="tmp-cover-rule" style={{ left: `${w * 0.13}px`, top: `${h * (portrait ? 0.18 : 0.16)}px`, width: `${w * 0.74}px` }}>
        <span>PLANNER</span><i /><span>{years}</span>
      </div>
      <div class="tmp-cover-name" style={{ left: `${w * 0.13}px`, top: `${h * (portrait ? 0.3 : 0.3)}px`, width: `${nameW}px`,
        fontSize: `${124 * fit * TEXT_SCALE}px` }}>{b.name}</div>
      <div class="tmp-cover-period" style={{ left: `${w * 0.13}px`, top: `${h * (portrait ? 0.56 : 0.62)}px`, width: `${w * 0.74}px` }}>
        {fmt(b.start)}  —  {b.end ? fmt(b.end) : ""}
      </div>
      <div class="tmp-cover-band" style={{ left: 0, top: `${h * (portrait ? 0.82 : 0.8)}px`, width: `${w}px`, height: `${h * 0.06}px`, background: color }} />
      <div class="tmp-cover-tag" style={{ left: `${w * 0.13}px`, top: `${h * (portrait ? 0.82 : 0.8) + h * 0.015}px`, height: `${h * 0.03}px`, fontSize: `${h * 0.018}px` }}>
        {conceptOf(b.cover).name}
      </div>
    </>
  );
}

function Motto({ w, h }: { w: number; h: number }) {
  const c = useCtx();
  const p = c.planner;
  const text = p.data.prefs.motto;
  const editing = c.editing === "motto";
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);
  const boxW = w * 0.72, boxH = h * 0.6;
  const fit = fitScale(text, 76, boxW, 14, c.wrap, 0.35);
  const font = 76 * fit * TEXT_SCALE;
  const style = { left: `${(w - boxW) / 2}px`, top: `${(h - boxH) / 2}px`, width: `${boxW}px`, height: `${boxH}px`, fontSize: `${font}px` };
  if (editing) {
    return (
      <textarea ref={ref} class="tmp-editor tmp-motto" style={style} value={text}
        onInput={(e) => p.setMotto((e.target as HTMLTextAreaElement).value)}
        onKeyDown={(e) => {
          if (e.isComposing) return;
          // 줄 바꿈은 Option(Alt)+Return 또는 Shift+Return, Return · Esc 는 쓰기를 마친다
          if (e.key === "Escape" || (e.key === "Enter" && !e.altKey && !e.shiftKey)) { e.preventDefault(); c.setEditing(null); }
        }}
        onBlur={() => window.setTimeout(() => { if (c.editingNow() === "motto") c.setEditing(null); }, 0)} />
    );
  }
  return (
    <div class="tmp-motto-view" style={{ ...style, color: text ? Ink.text : Ink.faint }} onClick={() => c.setEditing("motto")}>
      {text || (c.printing ? "" : "여기에 적고 싶은 말을 적어 보세요")}
    </div>
  );
}
