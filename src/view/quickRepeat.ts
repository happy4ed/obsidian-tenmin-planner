// 오른쪽 클릭 메뉴에서 바로 고르는 반복: 매일 · 매주 (그 요일) · 매월 (그날) · 매년 (그 날짜) · 자세히…
import { App, Menu, Notice } from "obsidian";
import { Planner } from "../model/planner";
import { describeRule, newRule, RepeatRule, WEEKDAY_KO, weekdayIndex } from "../model/repeat";
import { RepeatEditModal } from "./repeatModals";
import { UUID } from "../model/uuid";

export function addQuickRepeatItems(m: Menu, app: App, p: Planner, date: Date, base: Partial<RepeatRule>, adopt?: { date: Date; taskId: UUID }): void {
  const wd = WEEKDAY_KO[weekdayIndex(date)];
  const quick: [string, Partial<RepeatRule>][] = [
    ["매일 반복", { freq: "daily" }],
    ["평일 (월–금) 마다 반복", { freq: "weekdays", weekdays: [0, 1, 2, 3, 4] }],
    ["주말 (토 · 일) 마다 반복", { freq: "weekdays", weekdays: [5, 6] }],
    [`매주 ${wd}요일마다 반복`, { freq: "weekdays", weekdays: [weekdayIndex(date)] }],
    [`매월 ${date.getDate()}일마다 반복`, { freq: "monthly", monthly: "date" }],
    [`매년 ${date.getMonth() + 1}월 ${date.getDate()}일마다 반복`, { freq: "yearly" }],
  ];
  for (const [title, f] of quick) {
    m.addItem((it) => it.setTitle(title).setIcon("repeat").onClick(() => {
      const rule = { ...newRule("", date), ...base, ...f };
      const { id: _id, exceptions: _e, paintedDays: _p, mealDays: _m, ...rest } = rule;
      const id = p.addRepeat(rest);
      if (adopt) p.adoptAsRepeat(adopt.date, adopt.taskId, id);
      new Notice(`반복을 만들었어요: ${describeRule(p.repeats.find((x) => x.id === id)!)}`);
    }));
  }
  m.addItem((it) => it.setTitle("요일 고르기 · 자세히…").setIcon("settings-2").onClick(() => {
    const init = { ...newRule("", date), ...base, freq: "weekdays" as const, weekdays: [weekdayIndex(date)] };
    new RepeatEditModal(app, p, init, null, () => {}, adopt).open();
  }));
}
