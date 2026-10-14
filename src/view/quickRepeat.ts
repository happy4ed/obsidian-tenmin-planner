// 오른쪽 클릭 메뉴에서 바로 고르는 반복: 매일 · 매주 (그 요일) · 매월 (그날) · 매년 (그 날짜) · 자세히…
import { App, Menu, Notice } from "obsidian";
import { Planner } from "../model/planner";
import { describeRule, newRule, RepeatFreq, RepeatRule, WEEKDAY_KO, weekdayIndex } from "../model/repeat";
import { RepeatEditModal } from "./repeatModals";
import { UUID } from "../model/uuid";

export function addQuickRepeatItems(m: Menu, app: App, p: Planner, date: Date, base: Partial<RepeatRule>, adopt?: { date: Date; taskId: UUID }): void {
  const wd = WEEKDAY_KO[weekdayIndex(date)];
  const quick: [RepeatFreq, string][] = [
    ["daily", "매일 반복"],
    ["weekly", `매주 ${wd}요일마다 반복`],
    ["monthly", `매월 ${date.getDate()}일마다 반복`],
    ["yearly", `매년 ${date.getMonth() + 1}월 ${date.getDate()}일마다 반복`],
  ];
  for (const [freq, title] of quick) {
    m.addItem((it) => it.setTitle(title).setIcon("repeat").onClick(() => {
      const rule = { ...newRule("", date), ...base, freq, monthly: "date" as const };
      const { id: _id, exceptions: _e, paintedDays: _p, ...rest } = rule;
      const id = p.addRepeat(rest);
      if (adopt) p.adoptAsRepeat(adopt.date, adopt.taskId, id);
      new Notice(`반복을 만들었어요: ${describeRule(p.repeats.find((x) => x.id === id)!)}`);
    }));
  }
  m.addItem((it) => it.setTitle("반복 자세히…").setIcon("settings-2").onClick(() => {
    const init = { ...newRule("", date), ...base, weekdays: [weekdayIndex(date)] };
    new RepeatEditModal(app, p, init, null, () => {}, adopt).open();
  }));
}
