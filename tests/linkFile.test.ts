import { describe, expect, it } from "vitest";
import { linkText, parseCardArgs, parseLink, safeName } from "../src/model/linkFile";
import * as Dates from "../src/model/dates";

describe("바로가기 파일", () => {
  it("쓴 id 를 그대로 읽는다 (대문자)", () => {
    expect(parseLink(linkText("ab12-cd"))).toBe("AB12-CD");
  });
  it("못 읽는 내용은 null", () => {
    expect(parseLink("")).toBeNull();
    expect(parseLink("{}")).toBeNull();
    expect(parseLink('{"book":3}')).toBeNull();
  });
  it("파일 이름에 못 쓰는 글자는 빼고, 비면 '플래너'", () => {
    expect(safeName("2026/상반기: 공부*")).toBe("2026 상반기 공부");
    expect(safeName(" #[]|")).toBe("플래너");
  });
});

describe("노트 카드 인자", () => {
  const today = new Date(2026, 9, 15, 13, 5);
  it("날짜 · 플래너 줄", () => {
    const a = parseCardArgs("날짜: 2026-10-01\n플래너: 내 플래너", "Daily/2026-10-15.md", today);
    expect(Dates.key(a.date)).toBe("2026-10-01");
    expect(a.book).toBe("내 플래너");
  });
  it("날짜가 없으면 노트 이름의 날짜, 그것도 없으면 오늘", () => {
    expect(Dates.key(parseCardArgs("", "Daily/2026-10-03 회의.md", today).date)).toBe("2026-10-03");
    expect(Dates.key(parseCardArgs("", "메모.md", today).date)).toBe("2026-10-15");
    expect(Dates.key(parseCardArgs("date: today", "Daily/2026-10-03.md", today).date)).toBe("2026-10-15");
  });
  it("영문 키 · 전각 콜론도 받는다", () => {
    const a = parseCardArgs("book：Work\nDate: 2026-01-02", "x.md", today);
    expect(a.book).toBe("Work");
    expect(Dates.key(a.date)).toBe("2026-01-02");
  });
});
