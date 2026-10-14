import { describe, expect, it } from "vitest";
import { civilOrdinal, makeHomeStats, ordinal, weekdayOf } from "../src/model/homeStats";
import { emptyData, emptyDay, Mark } from "../src/model/types";

const paint = (n: number, cat = 0) => { const d = emptyDay(); for (let i = 0; i < n; i++) d.slots[i] = cat; return d; };

describe("홈 통계 (원본 HomeStats 규칙)", () => {
  it("날 일련번호 · 요일", () => {
    expect(civilOrdinal(1970, 1, 1)).toBe(0);
    expect(ordinal("2026-10-14")).toBe(civilOrdinal(2026, 10, 14));
    expect(weekdayOf(civilOrdinal(2026, 10, 12))).toBe(0); // 월요일
    expect(ordinal("2026-13-01")).toBeNull();
  });
  it("이번 주 · 이번 달 합계는 TOTAL 포함 형광펜만", () => {
    const d = emptyData();
    d.days["2026-10-13"] = paint(6, 0);          // 60분
    d.days["2026-10-14"] = paint(3, 5);          // 개인: 합계 제외, 그래도 기록한 날
    d.days["2026-10-01"] = paint(12, 1);         // 120분 (지난주들)
    const s = makeHomeStats(d, new Date(2026, 9, 14));
    expect(s.weekMinutes).toBe(60);
    expect(s.monthMinutes).toBe(180);
    expect(s.monthDays).toBe(3);
    expect(s.daysInMonth).toBe(31);
    expect(s.categories[0]).toMatchObject({ id: 1, minutes: 120 });
  });
  it("STREAK: 오늘이 비면 어제부터, DAY OFF 는 건너뛴다", () => {
    const d = emptyData();
    d.days["2026-10-10"] = paint(1);
    d.days["2026-10-11"] = { ...emptyDay(), dayOff: true };
    d.days["2026-10-12"] = paint(1);
    d.days["2026-10-13"] = paint(1);
    const s = makeHomeStats(d, new Date(2026, 9, 14));
    expect(s.streakIncludesToday).toBe(false);
    expect(s.streak).toBe(3);
  });
  it("할 일 표시 · 완료율", () => {
    const d = emptyData();
    const r = emptyDay();
    r.tasks = [Mark.done, Mark.done, Mark.missed, Mark.none].map((m, i) => ({ id: `${i}`, text: "x", mark: m, cat: null, carriedFrom: null, row: i }));
    d.days["2026-10-14"] = r;
    const s = makeHomeStats(d, new Date(2026, 9, 14));
    expect([s.done, s.missed, s.unmarked]).toEqual([2, 1, 1]);
  });
  it("잔디는 5주 × 7일, 마지막 줄이 이번 주", () => {
    const s = makeHomeStats(emptyData(), new Date(2026, 9, 14));
    expect(s.calendar).toHaveLength(35);
    expect(s.calendar.find((c) => c.isToday)?.date.getDate()).toBe(14);
    expect(s.calendar[28].date.getDate()).toBe(12);
  });
  it("가장 자주 칠한 시간", () => {
    const d = emptyData();
    const r = emptyDay(); for (let i = 18; i < 24; i++) r.slots[i] = 0; // 09시 줄
    d.days["2026-10-14"] = r;
    expect(makeHomeStats(d, new Date(2026, 9, 14)).peakHour).toBe(3);
  });
});
