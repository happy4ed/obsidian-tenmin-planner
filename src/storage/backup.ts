// 백업 (원본 S-06 · S-07): 펼친 책 한 권을 JSON 하나로, 그 JSON 을 새 플래너로 되살리기.
import * as Dates from "../model/dates";
import { hasRecord } from "../model/day";
import { decodeData, encodeData, PlannerData, stableStringify } from "../model/types";

const PREFIXES = ["10분 플래너 백업 - ", "Spiralday 백업 - ", "PaperPlanner 백업 - "];

/** 파일 이름에 못 쓰는 / : \ 줄바꿈 탭은 "-" */
export const safeName = (s: string) => s.replace(/[/:\\\n\t]/g, "-").trim();

export function backupFileName(bookName: string, today = new Date()): string {
  return `10분 플래너 백업 - ${safeName(bookName)} ${Dates.key(today)}.json`;
}

export const backupText = (data: PlannerData) => stableStringify(encodeData(data));

/** 파일 이름에서 책 이름: 접두와 날짜 꼬리를 뗀다 */
export function nameFromBackup(fileName: string): string {
  let n = fileName.replace(/\.json$/i, "");
  for (const p of PREFIXES) if (n.startsWith(p)) { n = n.slice(p.length); break; }
  n = n.replace(/\s+\d{4}-\d{2}-\d{2}$/, "").trim();
  return n || "가져온 플래너";
}

/** 백업 JSON 을 읽는다. 플래너 백업이 아니면 예외 */
export function parseBackup(text: string): PlannerData {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error("플래너 백업 파일이 아니라서 가져오지 못했어요."); }
  const o = raw as Record<string, unknown>;
  if (!o || typeof o !== "object" || !("days" in o || "prefs" in o || "weeks" in o)) {
    throw new Error("플래너 백업 파일이 아니라서 가져오지 못했어요.");
  }
  return decodeData(raw);
}

/** 기록이 있는 가장 이른 날 (없으면 null) */
export function firstRecordedDay(d: PlannerData): Date | null {
  const keys = Object.entries(d.days).filter(([, r]) => hasRecord(r)).map(([k]) => k).sort();
  return keys.length ? Dates.parseKey(keys[0]) : null;
}

/** 기록 요약 (S-08): 기록한 날 · 적은 할 일 · 칠한 시간 (지금 있는 형광펜 칸만) */
export function recordSummary(d: PlannerData): { days: number; tasks: number; minutes: number } {
  const ids = new Set(d.prefs.categories.map((c) => c.id));
  let days = 0, tasks = 0, cells = 0;
  for (const r of Object.values(d.days)) {
    if (hasRecord(r)) days++;
    tasks += r.tasks.filter((t) => t.text.trim() !== "").length;
    cells += r.slots.filter((s) => ids.has(s)).length;
  }
  return { days, tasks, minutes: cells * 10 };
}
