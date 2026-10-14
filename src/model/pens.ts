// 새 형광펜의 이름과 색 (원본 Settings.swift SettingsPenColors): 이미 쓰는 색과 가장 멀리 떨어진 형광 파스텔

export const PEN_CANDIDATES = ["B9E4A8", "FFC98C", "9ED3F4", "F5A7BA", "D6C4F3", "F7E07A",
  "A7E3D1", "FFB4A0", "CBE28A", "B5C2F6", "F2C3E0", "E6D2AE", "9FDFE3", "FFD8A6"];

const rgb = (hex: string): [number, number, number] => {
  const v = parseInt(hex.replace("#", ""), 16) || 0;
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
};

/** 사람 눈에 가까운 가중 RGB 거리 */
function distance(a: [number, number, number], b: [number, number, number]): number {
  const r = (a[0] + b[0]) / 2;
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return Math.sqrt((2 + r / 256) * dr * dr + 4 * dg * dg + (2 + (255 - r) / 256) * db * db);
}

export function suggestPenColor(used: string[]): string {
  const taken = used.map(rgb);
  let best = PEN_CANDIDATES[0], bestD = -1;
  for (const c of PEN_CANDIDATES) {
    const p = rgb(c);
    const d = taken.length ? Math.min(...taken.map((t) => distance(p, t))) : Infinity;
    if (d > bestD) { best = c; bestD = d; }
  }
  return best;
}

export function newPenName(names: string[]): string {
  const base = "새 형광펜";
  if (!names.includes(base)) return base;
  let n = 2;
  while (names.includes(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}
