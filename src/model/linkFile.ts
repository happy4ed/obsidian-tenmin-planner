// 바로가기 파일 (<이름>.tenmin) 형식 · 노트 카드 인자. obsidian 없이 시험할 수 있게 따로 둔다.

import * as Dates from "./dates";
import { UUID } from "./uuid";

export const LINK_EXT = "tenmin";

/** 파일 이름에 못 쓰는 글자를 뺀다 */
export function safeName(name: string): string {
  const s = name.replace(/[\\/:*?"<>|#^[\]]/g, " ").replace(/\s+/g, " ").trim();
  return s || "플래너";
}

export const linkText = (id: UUID) => `${JSON.stringify({ type: "10분 플래너", book: id.toUpperCase() }, null, 2)}\n`;

/** 바로가기 내용 → 책 id (못 읽으면 null) */
export function parseLink(text: string): UUID | null {
  try {
    const v = JSON.parse(text) as { book?: unknown };
    return typeof v.book === "string" && v.book ? v.book.toUpperCase() : null;
  } catch { return null; }
}

export interface CardArgs { date: Date; book: string | null; }

export function parseCardArgs(src: string, notePath: string, today: Date): CardArgs {
  let date: Date | null = null, book: string | null = null;
  for (const line of src.split("\n")) {
    const m = /^\s*([^:：]+?)\s*[:：]\s*(.*)$/.exec(line);
    if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === "날짜" || k === "date") date = v === "오늘" || v === "today" ? Dates.day(today) : Dates.parseKey(v);
    else if (k === "플래너" || k === "book") book = v || null;
  }
  if (!date) {
    const name = notePath.split("/").pop() ?? "";
    const m = /(\d{4}-\d{2}-\d{2})/.exec(name);
    if (m) date = Dates.parseKey(m[1]);
  }
  return { date: date ?? Dates.day(today), book };
}
