import { describe, expect, it } from "vitest";
import { describeRule, newRule, nextOccurrences, occurrenceId, occursOn, RepeatRule, decodeRule, encodeRule } from "../src/model/repeat";
import { Planner } from "../src/model/planner";
import { approxWrap } from "../src/model/ruled";
import { decodeData, emptyData, encodeData, Mark } from "../src/model/types";
import * as Dates from "../src/model/dates";

const D = (m: number, d: number, y = 2026) => new Date(y, m - 1, d);
const keys = (ds: Date[]) => ds.map((d) => Dates.key(d).slice(5));
const rule = (p: Partial<RepeatRule>): RepeatRule => ({ ...newRule("11111111-1111-4111-8111-111111111111", D(10, 14)), ...p });

describe("반복 규칙", () => {
  it("매일 · n일마다", () => {
    expect(keys(nextOccurrences(rule({ freq: "daily" }), D(10, 14), 3))).toEqual(["10-14", "10-15", "10-16"]);
    expect(keys(nextOccurrences(rule({ freq: "daily", interval: 3 }), D(10, 14), 3))).toEqual(["10-14", "10-17", "10-20"]);
  });
  it("주마다: 시작일 요일, 2주마다", () => {
    expect(keys(nextOccurrences(rule({ freq: "weekly", interval: 2 }), D(10, 14), 3))).toEqual(["10-14", "10-28", "11-11"]);
  });
  it("요일마다: 화 · 목, 평일", () => {
    expect(keys(nextOccurrences(rule({ freq: "weekdays", weekdays: [1, 3] }), D(10, 14), 4))).toEqual(["10-15", "10-20", "10-22", "10-27"]);
    expect(describeRule(rule({ freq: "weekdays", weekdays: [0, 1, 2, 3, 4] }))).toBe("매주 평일");
  });
  it("달마다: 같은 날짜 (없으면 말일) · 몇째 요일 · 말일", () => {
    expect(keys(nextOccurrences(rule({ freq: "monthly", start: D(1, 31) }), D(1, 1), 3))).toEqual(["01-31", "02-28", "03-31"]);
    // 2026-10-14 = 둘째 수요일
    expect(keys(nextOccurrences(rule({ freq: "monthly", monthly: "nth" }), D(10, 14), 3))).toEqual(["10-14", "11-11", "12-09"]);
    expect(describeRule(rule({ freq: "monthly", monthly: "nth" }))).toBe("매월 둘째 수요일");
    expect(keys(nextOccurrences(rule({ freq: "monthly", monthly: "last" }), D(10, 14), 2))).toEqual(["10-31", "11-30"]);
  });
  it("연마다: 2/29 는 평년에 2/28", () => {
    const r = rule({ freq: "yearly", start: D(2, 29, 2028) });
    expect(nextOccurrences(r, D(1, 1, 2029), 1).map(Dates.key)).toEqual(["2029-02-28"]);
  });
  it("끝: 날짜까지 · n번 · 멈춤 · 예외", () => {
    expect(nextOccurrences(rule({ end: { type: "until", until: D(10, 16) } }), D(10, 14), 9)).toHaveLength(3);
    expect(nextOccurrences(rule({ end: { type: "count", count: 2 } }), D(10, 14), 9)).toHaveLength(2);
    expect(occursOn(rule({ paused: true }), D(10, 14))).toBe(false);
    expect(occursOn(rule({ exceptions: ["2026-10-15"] }), D(10, 15))).toBe(false);
  });
  it("파일 왕복", () => {
    const r = rule({ freq: "weekdays", weekdays: [4, 0], end: { type: "count", count: 5 }, skipDayOff: true, cat: 2 });
    expect(decodeRule(JSON.parse(JSON.stringify(encodeRule(r))))).toEqual({ ...r, weekdays: [0, 4] });
  });
});

describe("반복 할 일 만들기", () => {
  const wrap = approxWrap();
  it("펼친 날에 한 번만 만들고, 그날 하나를 지우면 다시 만들지 않으며 반복은 그대로", () => {
    const p = new Planner(emptyData(), null, wrap);
    const id = p.addRepeat({ ...newRule("x", D(10, 14), "운동", 4) });
    const r = p.repeats[0];
    expect(p.applyRepeats([D(10, 14), D(10, 15)])).toBe(true);
    expect(p.applyRepeats([D(10, 14)])).toBe(false);
    expect(p.day(D(10, 14)).tasks.map((t) => [t.text, t.cat])).toEqual([["운동", 4]]);
    p.deleteTask(D(10, 15), occurrenceId(r, D(10, 15)));
    expect(p.applyRepeats([D(10, 15)])).toBe(false);
    expect(p.repeats).toHaveLength(1);
    expect(p.repeats[0].exceptions).toEqual(["2026-10-15"]);
    expect(id).toBeTruthy();
  });
  it("DAY OFF 빼고 · 반복 지우기 (앞으로 생긴 표시 없는 것만 함께)", () => {
    const p = new Planner(emptyData(), null, wrap);
    p.addRepeat({ ...newRule("x", D(1, 1, 2026), "일기"), skipDayOff: true });
    p.setDayOff(D(12, 25), true);
    p.applyRepeats([D(12, 25)]);
    expect(p.day(D(12, 25)).tasks).toHaveLength(0);
    const far = D(12, 30, 2099), farMarked = D(12, 31, 2099);
    p.applyRepeats([far, farMarked]);
    p.setMark(farMarked, p.day(farMarked).tasks[0].id, Mark.done);
    p.removeRepeat(p.repeats[0].id, true);
    expect(p.day(far).tasks).toHaveLength(0);
    expect(p.day(farMarked).tasks).toHaveLength(1);
  });
  it("prefs 에 저장되고 다시 읽힌다", () => {
    const p = new Planner(emptyData(), null, wrap);
    p.addRepeat({ ...newRule("x", D(10, 14), "보고"), freq: "monthly", monthly: "last" });
    const back = decodeData(JSON.parse(JSON.stringify(encodeData(p.data))));
    expect(back.prefs.repeats[0]).toMatchObject({ text: "보고", freq: "monthly", monthly: "last" });
  });
});

describe("타임테이블 반복 칠하기", () => {
  const wrap = approxWrap();
  it("겹치는 일정으로 들어가고, 지우개로 지운 날은 다시 만들지 않으며, 할 일 없이도 된다", () => {
    const p = new Planner(emptyData(), null, wrap);
    p.addRepeat({ ...newRule("x", D(10, 14), "", 1), freq: "weekdays", weekdays: [2], paint: { from: 18, to: 26 } });
    p.editDay(D(10, 14), (r) => { r.slots[20] = 3; }); // 이미 칠한 칸
    expect(p.applyRepeats([D(10, 14)])).toBe(true);
    const s = p.day(D(10, 14)).slots;
    // 이미 있던 일정(3)은 그대로 두고 그 위에 겹친다 (칸 색은 맨 위 = 나중 일정)
    expect(p.day(D(10, 14)).events.map((e) => [e.cat, e.from, e.to])).toEqual([[3, 20, 20], [1, 18, 26]]);
    expect(s.slice(18, 27)).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1]);
    expect(p.day(D(10, 14)).tasks).toHaveLength(0);
    expect(p.minutes(D(10, 14), 1)).toBe(90);
    expect(p.minutes(D(10, 14), 3)).toBe(10);
    // 지우개로 지움 → 다시 칠하지 않는다
    p.editDay(D(10, 14), (r) => { for (let i = 18; i <= 26; i++) r.slots[i] = -1; });
    expect(p.applyRepeats([D(10, 14)])).toBe(false);
    // 다음 주 수요일에는 칠한다, 목요일에는 안 한다
    p.applyRepeats([D(10, 21), D(10, 22)]);
    expect(p.day(D(10, 21)).slots[18]).toBe(1);
    expect(p.day(D(10, 22)).slots[18]).toBe(-1);
    expect(describeRule(p.repeats[0])).toBe("매주 수 · 09:00–10:30 일정");
  });
  it("반복 지우기 (앞으로도) 는 미래에 칠한 칸도 지운다", () => {
    const p = new Planner(emptyData(), null, wrap);
    p.addRepeat({ ...newRule("x", D(1, 1, 2099), "회의", 1), paint: { from: 0, to: 2 } });
    p.applyRepeats([D(1, 1, 2099)]);
    expect(p.day(D(1, 1, 2099)).slots.slice(0, 3)).toEqual([1, 1, 1]);
    p.removeRepeat(p.repeats[0].id, true);
    expect(p.data.days["2099-01-01"]).toBeUndefined();
  });
});

describe("밥시간 반복 · 지난 날에도 · 요일 여러 개", () => {
  const wrap = approxWrap();
  it("밥시간을 반복하는 날마다 넣고, 지운 날은 다시 넣지 않는다", () => {
    const p = new Planner(emptyData(), null, wrap);
    p.addRepeat({ ...newRule("x", D(10, 14)), meal: { from: 36, to: 41 } });
    p.applyRepeats([D(10, 14), D(10, 15)]);
    expect(p.day(D(10, 15)).notes.map((n) => [n.kind, n.start, n.end])).toEqual([["meal", 36, 41]]);
    p.removeNote(D(10, 15), p.day(D(10, 15)).notes[0].id);
    expect(p.applyRepeats([D(10, 15)])).toBe(false);
    expect(describeRule(p.repeats[0])).toBe("매일 · 밥 12:00–13:00");
  });
  it("지난 날에도: 적용 시작부터 어제까지 바로 넣고, 기준(요일 · 날짜)은 시작일 그대로", () => {
    const today = Dates.day(new Date());
    const p = new Planner(emptyData(), null, wrap);
    const id = p.addRepeat({ ...newRule("x", today, "정리"), freq: "monthly", monthly: "date", since: Dates.addDays(-70, today) });
    p.backfillRepeat(id);
    const made = Object.entries(p.data.days).filter(([, r]) => r.tasks.some((t) => t.text === "정리")).map(([k]) => Number(k.slice(8)));
    expect(made.length).toBeGreaterThanOrEqual(2);
    expect(made.every((d) => d === today.getDate() || d >= 28)).toBe(true);
  });
  it("매주 월 · 화 · 수만", () => {
    const r = rule({ freq: "weekdays", weekdays: [0, 1, 2] });
    expect(keys(nextOccurrences(r, D(10, 14), 4))).toEqual(["10-14", "10-19", "10-20", "10-21"]);
    expect(describeRule(r)).toBe("매주 월 · 화 · 수");
  });
});
