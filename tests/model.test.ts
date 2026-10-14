import { describe, expect, it } from "vitest";
import { carryTaskId, sha1 } from "../src/model/uuid";
import {
  decodeData, decodeDay, emptyData, emptyDay, encodeData, encodeDay, legacyDDayId, Mark, PlanTask, stableStringify,
} from "../src/model/types";
import { assignTaskRows, insertCarried, joinCategoryGroup, repainted, taskRowsReady } from "../src/model/day";
import { approxWrap } from "../src/model/ruled";
import { ddayCount, migrateDDaysPerDay, Planner } from "../src/model/planner";
import * as Dates from "../src/model/dates";

const wrap = approxWrap();
const task = (text: string, cat: number | null = null, row: number | null = null, id?: string): PlanTask => ({
  id: id ?? crypto.randomUUID().toUpperCase(), text, mark: Mark.none, cat, carriedFrom: null, row,
});

describe("UUID 규칙 (원본과 같은 벡터)", () => {
  it("SHA-1", () => {
    const hex = Array.from(sha1(new TextEncoder().encode("abc")), (b) => b.toString(16).padStart(2, "0")).join("");
    expect(hex).toBe("a9993e364706816aba3e25717850c26c9cd0d89d");
  });
  it("carryTaskId", () => {
    expect(carryTaskId("3F2504E0-4F89-11D3-9A0C-0305E82C3301")).toBe("0D594A5F-8FD8-50CA-803B-6260FFD0478F");
  });
  it("legacyDDayId", () => {
    expect(legacyDDayId("시험", new Date("2026-11-01T15:00:00Z"))).toBe("116E4CC2-C837-5BC7-BDC4-D978F1815524");
  });
});

describe("읽기 · 쓰기", () => {
  it("없는 키를 채우고 slots 는 144칸으로 맞춘다", () => {
    const d = decodeDay({ slots: [0, 1], memos: ["a"] });
    expect(d.slots.length).toBe(144);
    expect(d.slots.slice(0, 3)).toEqual([0, 1, -1]);
    expect(d.memos).toEqual(["a", "", ""]);
    expect(d.dayOff).toBe(false);
  });
  it("원본이 생략하는 키는 쓰지 않는다", () => {
    const o = encodeDay(emptyDay());
    expect(Object.keys(o).sort()).toEqual(["comment", "memoTags", "memos", "notes", "slots", "tasks"]);
    const t = encodeDay({ ...emptyDay(), tasks: [task("a")] }).tasks as Record<string, unknown>[];
    expect(Object.keys(t[0]).sort()).toEqual(["id", "mark", "text"]);
  });
  it("왕복해도 같다 (키 정렬)", () => {
    const d = emptyData();
    d.days["2026-10-14"] = { ...emptyDay(), tasks: [task("기획서", 3, 0)], comment: "좋은 하루", dayOff: true };
    const s1 = stableStringify(encodeData(d));
    const s2 = stableStringify(encodeData(decodeData(JSON.parse(s1))));
    expect(s2).toBe(s1);
  });
  it("형광펜이 0개이거나 12개를 넘으면 기본값", () => {
    expect(decodeData({ prefs: { categories: [] } }).prefs.categories.length).toBe(7);
  });
});

describe("할 일 줄", () => {
  it("예전 기록(줄 없음): 같은 형광펜끼리 모은 순서로 0,1,2…", () => {
    const d = { ...emptyDay(), tasks: [task("a", 1), task("b", 2), task("c", 1)] };
    assignTaskRows(d, wrap);
    expect(d.tasks.map((t) => [t.text, t.row])).toEqual([["a", 0], ["c", 1], ["b", 2]]);
    expect(taskRowsReady(d)).toBe(true);
  });
  it("일부만 줄이 없거나 겹치면: 줄 있는 것은 그대로, 나머지는 위 빈 줄부터", () => {
    const d = { ...emptyDay(), tasks: [task("a", null, 2), task("b", null, 2), task("c", null, null)] };
    assignTaskRows(d, wrap);
    expect(d.tasks.map((t) => [t.text, t.row])).toEqual([["b", 0], ["c", 1], ["a", 2]]);
  });
  it("넘어온 할 일은 같은 형광펜 묶음 바로 아래로, 아래 할 일은 빈 줄까지 밀린다", () => {
    const d = { ...emptyDay(), tasks: [task("a", 1, 0), task("b", 1, 1), task("x", 2, 2), task("y", 2, 3), task("z", null, 5)] };
    insertCarried(d, task("new", 1), wrap);
    expect(d.tasks.map((t) => [t.text, t.row])).toEqual([["a", 0], ["b", 1], ["new", 2], ["x", 3], ["y", 4], ["z", 5]]);
  });
  it("형광펜을 고르면 그 묶음으로 옮긴다", () => {
    const d = { ...emptyDay(), tasks: [task("a", 1, 0), task("m", null, 1), task("k", 1, 4, "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA")] };
    joinCategoryGroup(d, "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA", wrap);
    expect(d.tasks.map((t) => [t.text, t.row])).toEqual([["a", 0], ["k", 1], ["m", 2]]);
  });
});

describe("미루기 →", () => {
  const today = new Date(2026, 9, 14);
  const setup = () => {
    const p = new Planner(emptyData(), null, wrap);
    const id = p.addTask(today, 0, 2);
    p.setTaskText(today, id, "보고서");
    return { p, id };
  };
  it("다음 날 같은 글 · 같은 형광펜 · 표시 없음으로 넘어가고 id 는 carryTaskId", () => {
    const { p, id } = setup();
    p.setMark(today, id, Mark.moved);
    const next = p.day(Dates.addDays(1, today)).tasks;
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ text: "보고서", cat: 2, mark: Mark.none, carriedFrom: id, id: carryTaskId(id) });
  });
  it("→ 를 떼면 손대지 않은 사본은 거둔다", () => {
    const { p, id } = setup();
    p.setMark(today, id, Mark.moved);
    p.setMark(today, id, Mark.none);
    expect(p.day(Dates.addDays(1, today)).tasks).toHaveLength(0);
  });
  it("사본을 고쳤으면 남긴다", () => {
    const { p, id } = setup();
    p.setMark(today, id, Mark.moved);
    const next = Dates.addDays(1, today);
    p.setTaskText(next, carryTaskId(id), "보고서 마무리");
    p.cycleMark(today, id); // → 다음은 없음
    expect(p.day(next).tasks.map((t) => t.text)).toEqual(["보고서 마무리"]);
  });
  it("책 기간 밖으로는 넘기지 않는다", () => {
    const p = new Planner(emptyData(), { id: "B", name: "b", start: today, end: today, cover: 0, created: today, isSample: false }, wrap);
    const id = p.addTask(today, 0);
    p.setTaskText(today, id, "x");
    p.setMark(today, id, Mark.moved);
    expect(p.day(Dates.addDays(1, today)).tasks).toHaveLength(0);
  });
});

describe("TOTAL · D-day · 칠하기", () => {
  it("12칸 칠하면 120분 (원본 시험과 같다)", () => {
    const p = new Planner(emptyData(), null, wrap);
    const t = new Date(2026, 9, 14);
    p.editDay(t, (r) => { for (let s = 0; s < 12; s++) r.slots[s] = 0; });
    expect(p.minutes(t)).toBe(120);
    p.editDay(t, (r) => { r.slots[20] = 5; }); // 개인: TOTAL 에 넣지 않는다
    expect(p.minutes(t)).toBe(120);
    expect(p.minutes(t, 5)).toBe(10);
  });
  it("D-10", () => {
    const p = new Planner(emptyData(), null, wrap);
    const t = new Date(2026, 9, 14);
    p.addDDay("런칭", Dates.addDays(10, t), t);
    const dd = p.day(t).ddays[0];
    expect(ddayCount(dd, t)).toBe("D-10");
    expect(p.ddayLibrary).toHaveLength(1);
  });
  it("D-day 는 하루 두 개까지", () => {
    const p = new Planner(emptyData(), null, wrap);
    const t = new Date(2026, 9, 14);
    p.addDDay("a", t, t); p.addDDay("b", t, t);
    expect(p.addDDay("c", t, t)).toBeNull();
  });
  it("끌어 칠하기: 범위 밖으로 나간 칸만 되돌린다", () => {
    const before = [-1, -1, 3, -1, -1];
    const step1 = repainted(before, before, null, [0, 3], 1);
    const step2 = repainted(step1, before, [0, 3], [0, 1], 1);
    expect(step2).toEqual([1, 1, 3, -1, -1]);
    expect(repainted(step2, before, [0, 1], null, 1)).toEqual(before);
  });
  it("빈 날은 저장하지 않는다", () => {
    const p = new Planner(emptyData(), null, wrap);
    const t = new Date(2026, 9, 14);
    const id = p.addTask(t, 0);
    p.cleanup(t);
    expect(p.data.days[Dates.key(t)]).toBeUndefined();
    expect(id).toBeTruthy();
  });
});

describe("1.0.2 파일 D-day 옮기기", () => {
  it("기록한 날과 오늘에 붙인다", () => {
    const d = decodeData({
      days: { "2026-10-01": { comment: "x" }, "2026-10-02": {} },
      prefs: { ddays: [{ id: "11111111-1111-4111-8111-111111111111", title: "시험", date: "2026-11-01T15:00:00Z" }] },
    });
    expect(d.prefs.ddaysPerDay).toBe(false);
    const stamped = migrateDDaysPerDay(d, new Date(2026, 9, 14), null);
    expect(stamped).toEqual(["2026-10-01", "2026-10-14"]);
    expect(d.days["2026-10-01"].ddays[0].source).toBe("11111111-1111-4111-8111-111111111111");
    expect(d.prefs.ddaysPerDay).toBe(true);
  });
});
