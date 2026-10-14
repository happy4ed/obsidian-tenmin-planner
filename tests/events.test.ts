import { describe, expect, it } from "vitest";
import { countedMinutes, eventsFromSlots, minutesByCat, segments, slotsFromEvents, subtractRange, TimeEvent } from "../src/model/events";
import { Planner } from "../src/model/planner";
import { approxWrap } from "../src/model/ruled";
import { decodeData, emptyData, emptyDay, encodeData } from "../src/model/types";

let n = 0;
const id = () => `ID${++n}`;
const ev = (from: number, to: number, cat = 0, title = ""): TimeEvent => ({ id: id(), from, to, cat, title, note: "", place: "" });
const D = new Date(2026, 9, 14);

describe("일정", () => {
  it("예전 칸 색 → 일정 (이어진 같은 색 하나 = 일정 하나)", () => {
    const s = Array(144).fill(-1); for (let i = 18; i < 21; i++) s[i] = 1; s[21] = 2; s[22] = 1;
    expect(eventsFromSlots(s, id).map((e) => [e.cat, e.from, e.to])).toEqual([[1, 18, 20], [2, 21, 21], [1, 22, 22]]);
  });
  it("겹친 시간은 한 번 · 형광펜별", () => {
    const es = [ev(18, 23, 1), ev(21, 26, 2), ev(30, 32, 5)];
    expect(countedMinutes(es, new Set([1, 2]))).toBe(90);
    expect(minutesByCat(es).get(2)).toBe(60);
    expect(slotsFromEvents(es).slice(20, 23)).toEqual([1, 2, 2]);
  });
  it("지우개: 다 들어가면 지우고, 가운데면 둘로", () => {
    const out = subtractRange([ev(0, 9, 1), ev(12, 13, 2)], 3, 5, id);
    expect(out.map((e) => [e.from, e.to])).toEqual([[0, 2], [6, 9], [12, 13]]);
    expect(subtractRange([ev(3, 4)], 0, 10, id)).toEqual([]);
  });
  it("줄 조각: 09:40–10:20 은 두 줄", () => {
    expect(segments(ev(22, 25)).map((s) => [s.row, s.c0, s.c1])).toEqual([[3, 4, 5], [4, 0, 1]]);
  });
});

describe("플래너 일정", () => {
  const wrap = approxWrap();
  it("30분 미팅 둘 연달아: 두 일정, TOTAL 60분, 제목 · 장소 저장, 핸들처럼 시작 · 끝 바꾸기", () => {
    const p = new Planner(emptyData(), null, wrap);
    const a = p.addEvent(D, { from: 18, to: 20, cat: 1, title: "A 미팅" });
    const b = p.addEvent(D, { from: 21, to: 23, cat: 1, title: "B 미팅", place: "3층" });
    expect(p.day(D).events).toHaveLength(2);
    expect(p.minutes(D)).toBe(60);
    p.updateEvent(D, b, (e) => { e.to = 26; });
    expect(p.minutes(D)).toBe(90);
    const back = decodeData(JSON.parse(JSON.stringify(encodeData(p.data))));
    expect(back.days["2026-10-14"].events.map((e) => [e.title, e.place, e.from, e.to])).toEqual([["A 미팅", "", 18, 20], ["B 미팅", "3층", 21, 26]]);
    p.removeEvent(D, a);
    expect(p.day(D).slots[18]).toBe(-1);
  });
  it("열 때 예전 칸 색을 일정으로 옮긴다", () => {
    const d = emptyData(); const r = emptyDay(); r.slots[0] = 0; r.slots[1] = 0; d.days["2026-10-14"] = r;
    const p = new Planner(d, null, wrap);
    expect(p.day(D).events.map((e) => [e.from, e.to, e.cat])).toEqual([[0, 1, 0]]);
  });
  it("지우개로 일정 가운데를 지우면 둘로 나뉜다", () => {
    const p = new Planner(emptyData(), null, wrap);
    p.addEvent(D, { from: 0, to: 11, cat: 0, title: "긴 일" });
    p.eraseRange(D, 4, 5);
    expect(p.day(D).events.map((e) => [e.from, e.to, e.title])).toEqual([[0, 3, "긴 일"], [6, 11, "긴 일"]]);
  });
});
