// 화면용 줄 나눔: 캔버스로 손글씨 글꼴 폭을 재서 나눈다 (원본 CoreText 와 비슷하게 — 공백에서 먼저, 안 되면 글자 단위).
// 원본과 글꼴 엔진이 달라 아주 긴 할 일은 줄 수가 한 줄쯤 다를 수 있다.

import { Wrap } from "./model/ruled";

export const HAND_FONT = "PoorStory";
export const HAND_SCALE = 0.9;

export function canvasWrap(family = `"${HAND_FONT}", "Nanum Pen Script", cursive`): Wrap {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) throw new Error("canvas 2d 를 쓸 수 없음");
  return (text, fontSize, width) => {
    if (!text) return [""];
    ctx.font = `${fontSize * HAND_SCALE}px ${family}`;
    const w = Math.max(width, 10);
    const out: string[] = [];
    for (const para of text.split("\n")) {
      if (!para) { out.push(""); continue; }
      let line = "";
      let lastSpace = -1;
      for (const ch of Array.from(para)) {
        const next = line + ch;
        if (ctx.measureText(next).width <= w || line === "") {
          line = next;
          if (ch === " ") lastSpace = line.length;
          continue;
        }
        if (lastSpace > 0 && ch !== " ") {
          out.push(line.slice(0, lastSpace));
          line = line.slice(lastSpace) + ch;
        } else {
          out.push(line);
          line = ch === " " ? "" : ch;
        }
        lastSpace = line.lastIndexOf(" ") >= 0 ? line.lastIndexOf(" ") + 1 : -1;
      }
      out.push(line);
    }
    return out;
  };
}
