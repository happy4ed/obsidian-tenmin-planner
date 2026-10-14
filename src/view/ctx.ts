// 뷰 안의 공유 상태: 펼친 날, 고른 도구, 쓰는 칸 (원본 AppState 의 일부)
import { createContext } from "preact";
import { useContext } from "preact/hooks";
import type { App } from "obsidian";
import type { Planner } from "../model/planner";
import type { Wrap } from "../model/ruled";

/** 쓰는 칸 키: "t|<할 일 id>" · "c" (COMMENT) · "m|<n>" (메모 본문) · "mt|<n>" (메모 꼬리표) */
export type EditKey = string | null;

/** 도구: 형광펜 id, 지우개 = -1, 글씨 = -2, 밥시간 = -3 (원본과 같은 번호) */
export const ERASER = -1;
export const TEXT_TOOL = -2;
export const MEAL_TOOL = -3;

export interface ViewCtx {
  app: App;
  planner: Planner;
  wrap: Wrap;
  date: Date;
  tool: number;
  editing: EditKey;
  /** 지금 쓰는 칸 (렌더 사이에 바뀐 값까지) */
  editingNow(): EditKey;
  /** onDate: 그 칸이 속한 날 (주간에서 다른 요일 칸을 쓸 때) */
  setEditing(k: EditKey, onDate?: Date): void;
  setTool(t: number): void;
  go(d: Date): void;
  /** 지금 날에서 n 장 */
  step(n: number): void;
  openDDay(d: Date): void;
  /** PDF 로 그리는 중: 빈 칸 안내 · 메뉴 단추 같은 화면 전용 표시는 숨긴다 */
  printing?: boolean;
}

export const Ctx = createContext<ViewCtx | null>(null);

export function useCtx(): ViewCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("ViewCtx 없음");
  return c;
}
