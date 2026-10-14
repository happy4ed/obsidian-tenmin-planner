// 손글씨를 인쇄된 줄에 맞춰 흘려 쓰는 계산 (원본 RuledText).
// 줄 나눔(wrap)은 글꼴 측정이 필요해서 밖에서 받는다 — 화면에서는 캔버스 측정, 시험에서는 글자 수 기준.

/** 한 줄 폭에 맞게 줄을 나눈다. 빈 글은 빈 줄 하나. */
export type Wrap = (text: string, fontSize: number, width: number) => string[];

export interface RowItem {
  /** 쓰기 시작한 줄 */
  row: number;
  /** 줄마다 나뉜 글 (쓰는 줄 수 = lines.length) */
  lines: string[];
  /** 막혀서 줄인 글자 비율 (1 = 그대로) */
  fit: number;
}

export interface RowLayout {
  /** 칸(줄) 수. minRows 보다 크면 그만큼 줄 간격을 좁혀 같은 높이에 넣는다 */
  rows: number;
  /** 줄 간격과 글자에 곱할 비율 (= minRows / rows) */
  scale: number;
  items: RowItem[];
  /** 줄마다 그 줄에 쓴 항목 번호 (빈 줄은 null) */
  owners: (number | null)[];
}

export const span = (it: RowItem): number => it.lines.length;
export const owner = (L: RowLayout, row: number): number | null => (row >= 0 && row < L.owners.length ? L.owners[row] : null);
export const emptyRows = (L: RowLayout): number[] => L.owners.flatMap((o, i) => (o == null ? [i] : []));

export function fitScale(text: string, fontSize: number, width: number, maxLines: number, wrap: Wrap, minScale = 0.4): number {
  let s = 1;
  while (s > minScale) {
    if (wrap(text, fontSize * s, width).length <= maxLines) break;
    s *= 0.94;
  }
  return Math.max(s, minScale);
}

/**
 * 줄 번호를 정해 쓴 항목들을 놓는다. items 는 줄 번호가 커지는 순서.
 * 항목은 제 줄에서 시작해 아래 줄이 비어 있는 동안만 이어 쓰고, 막히면 가진 줄에 맞춰 글자를 줄인다.
 */
export function rowLayout(items: { row: number; text: string }[], minRows: number, fontSize: number, width: number,
  wrap: Wrap, minFit = 0.4): RowLayout {
  const rows = Math.max(minRows, Math.max(-1, ...items.map((i) => i.row)) + 1);
  const s = minRows / rows;
  const fs = fontSize * s;
  const owners: (number | null)[] = Array(rows).fill(null);
  const out: RowItem[] = [];
  items.forEach((it, k) => {
    const r = Math.min(Math.max(it.row, 0), rows - 1);
    const limit = k + 1 < items.length ? Math.min(Math.max(items[k + 1].row, r + 1), rows) : rows;
    const avail = Math.max(1, limit - r);
    let fit = 1;
    let lines = wrap(it.text, fs, width);
    if (lines.length > avail) {
      fit = fitScale(it.text, fs, width, avail, wrap, minFit);
      lines = wrap(it.text, fs * fit, width);
      // 가장 작게 줄여도 넘치면 남은 줄에 담고 끝에 … (글은 그대로 있다)
      if (lines.length > avail) {
        lines = lines.slice(0, avail);
        lines[avail - 1] += "…";
      }
    }
    for (let j = r; j < Math.min(r + lines.length, rows); j++) if (owners[j] == null) owners[j] = k;
    out.push({ row: r, lines, fit });
  });
  return { rows, scale: s, items: out, owners };
}

export interface FlowLayout { rows: number; scale: number; lines: string[][]; start: number[]; used: number; }

/** items 를 minRows 칸짜리 영역에 차례로 흘려 쓴다 (1.0.4 까지의 할 일 · 메모) */
export function flowLayout(items: string[], minRows: number, fontSize: number, width: number, wrap: Wrap,
  minScale = 0.45): FlowLayout {
  let rows = minRows;
  let result: FlowLayout | null = null;
  for (let n = 0; n < 24; n++) {
    const s = minRows / rows;
    const lines = items.map((t) => wrap(t, fontSize * s, width));
    const need = lines.reduce((a, l) => a + l.length, 0);
    const start: number[] = [];
    let r = 0;
    for (const l of lines) { start.push(r); r += l.length; }
    result = { rows: Math.max(rows, need), scale: s, lines, start, used: need };
    if (need <= rows || s <= minScale) break;
    rows = need;
  }
  return result!;
}

/** 시험용 · 글꼴이 없을 때: 글자 폭을 fontSize × ratio 로 보고 나눈다 (공백에서 먼저 끊는다) */
export function approxWrap(ratio = 0.9): Wrap {
  return (text, fontSize, width) => {
    if (!text) return [""];
    const per = Math.max(1, Math.floor(width / (fontSize * ratio)));
    const out: string[] = [];
    for (const para of text.split("\n")) {
      let rest = para;
      if (!rest) { out.push(""); continue; }
      while (rest.length > per) {
        const cut = rest.lastIndexOf(" ", per);
        const at = cut > 0 ? cut + 1 : per;
        out.push(rest.slice(0, at));
        rest = rest.slice(at);
      }
      out.push(rest);
    }
    return out;
  };
}
