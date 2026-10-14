// 펼친 책 하나의 편집 규칙 (원본 PlannerStore 의 기록 부분). 파일 읽고 쓰기는 storage 가 맡는다.
// 고칠 때마다 onChange 를 부른다 — 저장 예약은 부르는 쪽(플러그인)이 한다.

import * as Dates from "./dates";
import {
  BookInfo, Category, DayRecord, DDay, emptyDay, emptyWeek, Mark, MAX_CATEGORIES, MAX_DDAYS, nextMark,
  PlannerData, PlanTask, TimeNote, WeekRecord,
} from "./types";
import { assignTaskRows, freeTaskRow, hasRecord, insertCarried, insertTask, isEmptyDay, joinCategoryGroup, lastTaskLine, taskRowsReady } from "./day";
import { Wrap } from "./ruled";
import { newPenName, suggestPenColor } from "./pens";
import { occurrenceId, occursOn, repeatEventId, RepeatRule } from "./repeat";
import { countedMinutes, eventsFromSlots, minutesByCat, normEvent, slotsFromEvents, subtractRange, TimeEvent } from "./events";

/** 칸 색만 있고 일정이 없는 날 → 일정으로 */
function migrateSlots(r: DayRecord): void {
  if (!r.events.length && r.slots.some((s) => s >= 0)) r.events = eventsFromSlots(r.slots, newUUID);
}
import { carryTaskId, newUUID, sameUUID, UUID } from "./uuid";

const clone = <T>(v: T): T => structuredClone(v);

export function bookContains(b: BookInfo, d: Date): boolean {
  const x = Dates.day(d);
  if (x < Dates.day(b.start)) return false;
  if (b.end && x > Dates.day(b.end)) return false;
  return true;
}

/** "D-3" / "D-DAY" / "D+2" */
export function ddayCount(dd: DDay, from: Date): string {
  const n = Dates.daysBetween(from, dd.date);
  return n > 0 ? `D-${n}` : n === 0 ? "D-DAY" : `D+${-n}`;
}

/** 1.0.2 까지의 파일: D-day 한 목록을 모든 날에 보여 줬다 → 기록한 날과 오늘에 복사해 붙인다 */
export function migrateDDaysPerDay(d: PlannerData, today: Date, book: BookInfo | null): string[] {
  const stamped: string[] = [];
  const lib = d.prefs.ddays;
  if (!d.prefs.ddaysPerDay && lib.length) {
    const copies = (): DDay[] => lib.slice(0, MAX_DDAYS).map((x) => ({ id: newUUID(), title: x.title, date: x.date, source: x.id }));
    for (const k of Object.keys(d.days).sort()) {
      const r = d.days[k];
      if (!hasRecord(r) || r.ddays.length) continue;
      r.ddays = copies();
      stamped.push(k);
    }
    const tk = Dates.key(today);
    if ((book ? bookContains(book, today) : true) && !(d.days[tk]?.ddays.length)) {
      const r = d.days[tk] ?? emptyDay();
      r.ddays = copies();
      d.days[tk] = r;
      stamped.push(tk);
    }
  }
  d.prefs.ddaysPerDay = true;
  return stamped;
}

export class Planner {
  constructor(
    public data: PlannerData,
    public book: BookInfo | null,
    private wrap: Wrap,
    public onChange: () => void = () => {},
  ) {
    // 예전 기록 (칸 색만 있는 날): 이어진 같은 색 덩어리를 일정 하나씩으로 옮긴다 (칸 색은 그대로)
    for (const r of Object.values(this.data.days)) migrateSlots(r);
  }

  // ── 날 ──────────────────────────────────────────────

  /** 그날 기록 (사본). 할 일은 늘 줄이 매겨져 줄 순서로 온다 */
  day(d: Date): DayRecord {
    const r = clone(this.data.days[Dates.key(d)] ?? emptyDay());
    if (!taskRowsReady(r)) assignTaskRows(r, this.wrap);
    return r;
  }

  editDay(d: Date, f: (r: DayRecord) => void): void {
    const k = Dates.key(d);
    const r = clone(this.data.days[k] ?? emptyDay());
    if (!taskRowsReady(r)) assignTaskRows(r, this.wrap);
    const evBefore = JSON.stringify(r.events), slBefore = r.slots.join(",");
    f(r);
    if (!taskRowsReady(r)) assignTaskRows(r, this.wrap);
    // 일정이 바뀌면 칸 색을 다시 계산하고, 칸 색만 직접 바뀌었으면 (예전 방식) 일정을 칸 색에서 다시 만든다
    if (JSON.stringify(r.events) !== evBefore) r.slots = slotsFromEvents(r.events);
    else if (r.slots.join(",") !== slBefore) r.events = eventsFromSlots(r.slots, newUUID);
    if (isEmptyDay(r)) delete this.data.days[k];
    else this.data.days[k] = r;
    this.onChange();
  }

  week(start: Date): WeekRecord {
    return clone(this.data.weeks[Dates.key(start)] ?? emptyWeek());
  }

  editWeek(start: Date, f: (w: WeekRecord) => void): void {
    const w = this.week(start);
    f(w);
    this.data.weeks[Dates.key(start)] = w;
    this.onChange();
  }

  editPrefs(f: (p: PlannerData["prefs"]) => void): void {
    f(this.data.prefs);
    this.onChange();
  }

  /** 첫 장에 적는 말 */
  setMotto(text: string): void { this.editPrefs((p) => { p.motto = text; }); }

  /** 이 기간 밖에 있는 기록한 날 수 (기간을 줄이기 전 경고용) */
  recordedOutside(start: Date, end: Date | null): number {
    const s = Dates.key(Dates.day(start)), e = end ? Dates.key(Dates.day(end)) : null;
    return Object.entries(this.data.days).filter(([k, r]) => hasRecord(r) && (k < s || (e != null && k > e))).length;
  }

  /** 저장한 D-day 를 붙여 둔 날 수 */
  ddayAttachedDays(libraryID: UUID): number {
    return Object.values(this.data.days).filter((r) => r.ddays.some((d) => sameUUID(d.source, libraryID))).length;
  }

  get recordedDayCount(): number {
    return Object.values(this.data.days).filter(hasRecord).length;
  }

  // ── 할 일 ────────────────────────────────────────────

  addTask(d: Date, row: number, cat: number | null = null): UUID {
    const t: PlanTask = { id: newUUID(), text: "", mark: Mark.none, cat, carriedFrom: null, row: null };
    this.editDay(d, (r) => insertTask(r, t, row, this.wrap));
    return t.id;
  }

  /** 마지막으로 쓴 줄 다음의 빈 줄에 (주간 페이지의 빈 줄을 눌렀을 때) */
  addTaskAfterLast(d: Date, cat: number | null = null): UUID {
    const t: PlanTask = { id: newUUID(), text: "", mark: Mark.none, cat, carriedFrom: null, row: null };
    this.editDay(d, (r) => insertTask(r, t, freeTaskRow(r, lastTaskLine(r, () => true, this.wrap) ?? -1, this.wrap), this.wrap));
    return t.id;
  }

  setTaskText(d: Date, id: UUID, text: string): void {
    this.editDay(d, (r) => {
      const t = r.tasks.find((x) => sameUUID(x.id, id));
      if (t) t.text = text;
    });
  }

  /** 비어 있는 할 일을 지운다 (지금 쓰고 있는 것은 남긴다). 남은 할 일은 제 줄에 그대로 */
  cleanup(d: Date, keep: UUID | null = null): void {
    const blank = (t: PlanTask) => !sameUUID(t.id, keep) && t.text.trim() === "";
    const gone = this.day(d).tasks.filter(blank);
    if (!gone.length) return;
    this.noteRepeatException(d, gone.map((t) => t.id));
    this.editDay(d, (r) => { r.tasks = r.tasks.filter((t) => !blank(t)); });
  }

  /** 펜 클릭: 없음 → ○ → △ → × → → → 없음 */
  cycleMark(d: Date, id: UUID): void {
    const t = this.day(d).tasks.find((x) => sameUUID(x.id, id));
    if (t) this.setMark(d, id, nextMark(t.mark));
  }

  /** → 가 되면 다음 날로 넘기고, → 를 떼면 다음 날에 넘긴 것을 손대지 않았을 때만 거둔다 */
  setMark(d: Date, id: UUID, m: Mark): void {
    const t = this.day(d).tasks.find((x) => sameUUID(x.id, id));
    if (!t) return;
    if (t.mark !== m) {
      this.editDay(d, (r) => { const x = r.tasks.find((y) => sameUUID(y.id, id)); if (x) x.mark = m; });
    }
    if (m === Mark.moved) this.carryForward(d, t);
    else if (t.mark === Mark.moved) this.withdrawCarry(d, t);
  }

  postpone(d: Date, id: UUID): void { this.setMark(d, id, Mark.moved); }

  /** 다음 날에 이 할 일에서 넘어온 할 일 */
  carriedCopy(id: UUID, from: Date): PlanTask | undefined {
    return this.day(Dates.addDays(1, from)).tasks.find((t) => sameUUID(t.carriedFrom, id));
  }

  private carryForward(d: Date, t: PlanTask): void {
    const next = Dates.addDays(1, d);
    if (t.text.trim() === "") return;
    if (this.book && !bookContains(this.book, next)) return;
    if (this.carriedCopy(t.id, d)) return;
    const carried = carryTaskId(t.id);
    const id = this.day(next).tasks.some((x) => sameUUID(x.id, carried)) ? newUUID() : carried;
    this.editDay(next, (r) => insertCarried(r, { id, text: t.text, mark: Mark.none, cat: t.cat, carriedFrom: t.id, row: null }, this.wrap));
  }

  private withdrawCarry(d: Date, t: PlanTask): void {
    const copy = this.carriedCopy(t.id, d);
    if (!copy || copy.mark !== Mark.none || copy.text !== t.text || copy.cat !== t.cat) return;
    this.editDay(Dates.addDays(1, d), (r) => { r.tasks = r.tasks.filter((x) => !sameUUID(x.id, copy.id)); });
  }

  /** 형광펜(분류)을 고른다. 같은 형광펜 할 일이 있으면 그 묶음 바로 아래로 */
  setCategory(d: Date, id: UUID, cat: number | null): void {
    const t = this.day(d).tasks.find((x) => sameUUID(x.id, id));
    if (!t || t.cat === cat) return;
    this.editDay(d, (r) => {
      const x = r.tasks.find((y) => sameUUID(y.id, id));
      if (!x) return;
      x.cat = cat;
      joinCategoryGroup(r, id, this.wrap);
    });
  }

  /** 할 일을 지운다. 반복으로 생긴 할 일이면 그날 하나만 지우고 (다시 만들지 않게 적어 둔다) 반복은 그대로 */
  deleteTask(d: Date, id: UUID): void {
    this.noteRepeatException(d, [id]);
    this.editDay(d, (r) => { r.tasks = r.tasks.filter((t) => !sameUUID(t.id, id)); });
  }

  // ── 반복 할 일 ──────────────────────────────────────

  get repeats(): RepeatRule[] { return this.data.prefs.repeats; }

  /** 새 반복. 시작일부터 바로 그날 할 일도 만든다 */
  addRepeat(r: Omit<RepeatRule, "id" | "exceptions" | "paintedDays">): UUID {
    const rule: RepeatRule = { ...r, id: newUUID(), exceptions: [], paintedDays: [] };
    this.editPrefs((p) => p.repeats.push(rule));
    return rule.id;
  }

  updateRepeat(id: UUID, f: (r: RepeatRule) => void): void {
    this.editPrefs((p) => { const r = p.repeats.find((x) => sameUUID(x.id, id)); if (r) f(r); });
  }

  /** 반복을 지운다. withFuture 면 오늘 뒤에 만들어 두고 아직 표시하지 않은 할 일도 지운다 (지난 날 기록은 그대로) */
  removeRepeat(id: UUID, withFuture = false): void {
    const rule = this.repeats.find((x) => sameUUID(x.id, id));
    if (!rule) return;
    this.data.prefs.repeats = this.repeats.filter((x) => !sameUUID(x.id, id));
    if (withFuture) {
      const today = Dates.key(new Date());
      for (const [k, r] of Object.entries(this.data.days)) {
        if (k <= today) continue;
        const d = Dates.parseKey(k)!;
        const occ = occurrenceId(rule, d);
        const hasTask = r.tasks.some((t) => sameUUID(t.id, occ) && t.mark === Mark.none);
        const painted = rule.paint && rule.cat != null && rule.paintedDays.includes(k);
        if (!hasTask && !painted) continue;
        r.tasks = r.tasks.filter((t) => !(sameUUID(t.id, occ) && t.mark === Mark.none));
        if (painted) {
          const eid = repeatEventId(rule, d);
          r.events = r.events.filter((e) => !sameUUID(e.id, eid));
          r.slots = slotsFromEvents(r.events);
        }
        if (isEmptyDay(r)) delete this.data.days[k];
      }
    }
    this.onChange();
  }

  /** 오른쪽 클릭 "반복으로 만들기": 그 할 일을 그날의 반복 할 일로 삼는다 (같은 날 하나 더 생기지 않게 id 를 바꾼다) */
  adoptAsRepeat(d: Date, taskId: UUID, ruleId: UUID): void {
    const rule = this.repeats.find((x) => sameUUID(x.id, ruleId));
    if (!rule || !occursOn(rule, d)) return;
    const occ = occurrenceId(rule, d);
    this.editDay(d, (r) => {
      const t = r.tasks.find((x) => sameUUID(x.id, taskId));
      if (t && !r.tasks.some((x) => sameUUID(x.id, occ))) t.id = occ;
    });
  }

  /** 반복으로 생긴 할 일이 그날 몇 개 있는지 (설정 · 지우기 안내용) */
  repeatMadeCount(id: UUID): number {
    const rule = this.repeats.find((x) => sameUUID(x.id, id));
    if (!rule) return 0;
    let n = 0;
    for (const [k, r] of Object.entries(this.data.days)) {
      const occ = occurrenceId(rule, Dates.parseKey(k)!);
      if (r.tasks.some((t) => sameUUID(t.id, occ)) || rule.paintedDays.includes(k)) n++;
    }
    return n;
  }

  /** 지운 할 일이 반복으로 생긴 것이면 그 규칙의 예외에 그날을 적는다 */
  private noteRepeatException(d: Date, ids: UUID[]): void {
    const k = Dates.key(d);
    for (const rule of this.repeats) {
      const occ = occurrenceId(rule, d);
      if (ids.some((id) => sameUUID(id, occ)) && !rule.exceptions.includes(k)) rule.exceptions.push(k);
    }
  }

  /** 펼친 날들에 반복 할 일을 만들고 타임테이블을 칠한다 (책 기간 밖 · 이미 한 날 · 지운 날 · DAY OFF 건너뛰기는 빼고).
   * 칠하기는 빈 칸에만 (이미 칠한 칸은 그대로) 하고, 한 번 칠한 날은 지워도 다시 칠하지 않는다. 바꾼 게 있으면 true */
  applyRepeats(dates: Date[]): boolean {
    if (!this.repeats.length) return false;
    let made = false;
    for (const d of dates) {
      if (this.book && !bookContains(this.book, d)) continue;
      const k = Dates.key(d);
      const due = this.repeats.filter((rule) => rule.paused ? false : this.repeatDueOn(rule, d));
      if (!due.length) continue;
      const cur = this.data.days[k];
      const live = due.filter((rule) => !(rule.skipDayOff && cur?.dayOff));
      const todo = live.filter((rule) => {
        if (!rule.text.trim() || rule.exceptions.includes(k)) return false;
        const occ = occurrenceId(rule, d);
        return !cur?.tasks.some((t) => sameUUID(t.id, occ));
      });
      const paints = live.filter((rule) => rule.paint && rule.cat != null && !rule.paintedDays.includes(k));
      if (!todo.length && !paints.length) continue;
      for (const rule of paints) rule.paintedDays.push(k);
      this.editDay(d, (r) => {
        for (const rule of todo) {
          insertCarried(r, { id: occurrenceId(rule, d), text: rule.text, mark: Mark.none, cat: rule.cat, carriedFrom: null, row: null }, this.wrap);
        }
        for (const rule of paints) {
          const id = repeatEventId(rule, d);
          if (!r.events.some((e) => sameUUID(e.id, id))) {
            r.events.push(normEvent({ id, from: rule.paint!.from, to: rule.paint!.to, cat: rule.cat, title: rule.text, note: "", place: "" }));
          }
        }
      });
      made = true;
    }
    return made;
  }

  /** 끝 · 횟수 · 모양으로 그날 반복하는지 (지운 날 예외는 할 일에만 적용하므로 여기서는 보지 않는다) */
  private repeatDueOn(rule: RepeatRule, d: Date): boolean {
    return occursOn({ ...rule, exceptions: [] }, d);
  }

  // ── COMMENT · MEMO ───────────────────────────────────

  setComment(d: Date, text: string): void { this.editDay(d, (r) => { r.comment = text; }); }

  /** 메모는 3칸이 기본이고, 넘치면 늘어난다 */
  setMemo(d: Date, i: number, text: string): void {
    this.editDay(d, (r) => { while (r.memos.length <= i) r.memos.push(""); r.memos[i] = text; });
  }

  setMemoTag(d: Date, i: number, text: string): void {
    this.editDay(d, (r) => { while (r.memoTags.length <= i) r.memoTags.push(""); r.memoTags[i] = text; });
  }

  /** 끝에 붙은 빈 메모는 칸으로만 남긴다: 내용이 있는 마지막 메모까지의 개수 */
  static memoCount(r: DayRecord): number {
    let n = 0;
    for (let i = 0; i < Math.max(r.memos.length, r.memoTags.length); i++) {
      if ((r.memos[i] ?? "") !== "" || (r.memoTags[i] ?? "") !== "") n = i + 1;
    }
    return n;
  }

  // ── 타임테이블 ───────────────────────────────────────

  setSlots(d: Date, slots: number[]): void {
    this.editDay(d, (r) => { r.slots = slots.slice(0, r.slots.length); });
  }

  /** TOTAL TIME (분). cat 을 주면 그 형광펜만. 겹친 시간은 한 번만 센다 */
  minutes(d: Date, cat: number | null = null): number {
    const ev = this.day(d).events;
    if (cat != null) return minutesByCat(ev).get(cat) ?? 0;
    const counted = new Set(this.data.prefs.categories.filter((c) => c.counts).map((c) => c.id));
    return countedMinutes(ev, counted);
  }

  // ── 일정 (타임테이블) ─────────────────────────────────

  addEvent(d: Date, e: Omit<TimeEvent, "id" | "title" | "note" | "place"> & Partial<TimeEvent>): UUID {
    const ev = normEvent({ title: "", note: "", place: "", ...e, id: e.id ?? newUUID() });
    this.editDay(d, (r) => r.events.push(ev));
    return ev.id;
  }

  updateEvent(d: Date, id: UUID, f: (e: TimeEvent) => void): void {
    this.editDay(d, (r) => {
      const i = r.events.findIndex((x) => sameUUID(x.id, id));
      if (i < 0) return;
      const e = { ...r.events[i] };
      f(e);
      r.events[i] = normEvent(e);
    });
  }

  removeEvent(d: Date, id: UUID): void {
    this.editDay(d, (r) => { r.events = r.events.filter((x) => !sameUUID(x.id, id)); });
  }

  /** 지우개: 그 범위를 일정에서 잘라낸다 */
  eraseRange(d: Date, a: number, b: number): void {
    if (!this.day(d).events.some((e) => e.to >= Math.min(a, b) && e.from <= Math.max(a, b))) return;
    this.editDay(d, (r) => { r.events = subtractRange(r.events, a, b, newUUID); });
  }

  addNote(d: Date, note: Omit<TimeNote, "id">): UUID {
    const n: TimeNote = { id: newUUID(), ...note };
    this.editDay(d, (r) => r.notes.push(n));
    return n.id;
  }

  updateNote(d: Date, id: UUID, f: (n: TimeNote) => void): void {
    this.editDay(d, (r) => { const n = r.notes.find((x) => sameUUID(x.id, id)); if (n) f(n); });
  }

  removeNote(d: Date, id: UUID): void {
    this.editDay(d, (r) => { r.notes = r.notes.filter((n) => !sameUUID(n.id, id)); });
  }

  /** 지우개: 범위와 겹치는 메모 · 밥시간을 지운다 */
  removeNotes(d: Date, from: number, to: number): void {
    const hit = (n: TimeNote) => Math.min(n.start, n.end) <= to && Math.max(n.start, n.end) >= from;
    if (!this.day(d).notes.some(hit)) return;
    this.editDay(d, (r) => { r.notes = r.notes.filter((n) => !hit(n)); });
  }

  cleanupNotes(d: Date): void {
    const blank = (n: TimeNote) => n.kind === "text" && n.text.trim() === "";
    if (!this.day(d).notes.some(blank)) return;
    this.editDay(d, (r) => { r.notes = r.notes.filter((n) => !blank(n)); });
  }

  // ── D-day ────────────────────────────────────────────

  get ddayLibrary(): DDay[] { return this.data.prefs.ddays; }

  /** 저장한 D-day 를 이 날에 복사해 붙인다. 이미 붙였거나 두 개가 다 찼으면 false */
  applyDDay(libraryID: UUID, d: Date): boolean {
    const item = this.ddayLibrary.find((x) => sameUUID(x.id, libraryID));
    if (!item) return false;
    const now = this.day(d).ddays;
    if (now.length >= MAX_DDAYS || now.some((x) => sameUUID(x.source, libraryID))) return false;
    this.editDay(d, (r) => r.ddays.push({ id: newUUID(), title: item.title, date: Dates.day(item.date), source: item.id }));
    return true;
  }

  /** 새 D-day 를 이 날에 붙인다. save 면 저장한 목록에도 더한다 */
  addDDay(title: string, date: Date, d: Date, save = true): UUID | null {
    if (this.day(d).ddays.length >= MAX_DDAYS) return null;
    const dayDate = Dates.day(date);
    const source = save ? this.addLibraryDDay(title, dayDate) : null;
    const copy: DDay = { id: newUUID(), title, date: dayDate, source };
    this.editDay(d, (r) => r.ddays.push(copy));
    return copy.id;
  }

  removeDDay(id: UUID, d: Date): void {
    this.editDay(d, (r) => { r.ddays = r.ddays.filter((x) => !sameUUID(x.id, id)); });
  }

  editDDay(id: UUID, d: Date, f: (x: DDay) => void): void {
    this.editDay(d, (r) => {
      const x = r.ddays.find((y) => sameUUID(y.id, id));
      if (!x) return;
      f(x);
      x.date = Dates.day(x.date);
    });
  }

  /** 어제와 같게: 전날 붙인 D-day 를 이 날에도 붙인다 (이미 있는 것은 건너뛴다) */
  copyPreviousDDays(d: Date): void {
    const prev = this.day(Dates.addDays(-1, d)).ddays;
    if (!prev.length) return;
    this.editDay(d, (r) => {
      for (const p of prev) {
        if (r.ddays.length >= MAX_DDAYS) break;
        const dup = r.ddays.some((x) => (p.source != null ? sameUUID(x.source, p.source)
          : x.title === p.title && x.date.getTime() === p.date.getTime()));
        if (!dup) r.ddays.push({ id: newUUID(), title: p.title, date: p.date, source: p.source });
      }
    });
  }

  addLibraryDDay(title: string, date: Date): UUID {
    const item: DDay = { id: newUUID(), title, date: Dates.day(date), source: null };
    this.editPrefs((p) => p.ddays.push(item));
    return item.id;
  }

  editLibraryDDay(id: UUID, f: (x: DDay) => void): void {
    this.editPrefs((p) => {
      const x = p.ddays.find((y) => sameUUID(y.id, id));
      if (!x) return;
      f(x);
      x.date = Dates.day(x.date);
    });
  }

  removeLibraryDDay(id: UUID): void {
    this.editPrefs((p) => { p.ddays = p.ddays.filter((x) => !sameUUID(x.id, id)); });
  }

  // ── 형광펜 · 컬러 · 쉬는 날 ───────────────────────────

  get categories(): Category[] { return this.data.prefs.categories; }

  category(id: number | null): Category | undefined {
    return id == null ? undefined : this.categories.find((c) => c.id === id);
  }

  updateCategory(id: number, f: (c: Category) => void): void {
    this.editPrefs((p) => { const c = p.categories.find((x) => x.id === id); if (c) f(c); });
  }

  /** 새 형광펜: 이름 "새 형광펜 (n)", 색은 이미 쓰는 색과 가장 먼 후보. 12개면 null */
  addCategory(name?: string, hex?: string): number | null {
    if (this.categories.length >= MAX_CATEGORIES) return null;
    const id = Math.max(-1, ...this.categories.map((c) => c.id)) + 1;
    const n = name ?? newPenName(this.categories.map((c) => c.name));
    const h = hex ?? suggestPenColor(this.categories.map((c) => c.hex));
    this.editPrefs((p) => p.categories.push({ id, name: n, hex: h, counts: true }));
    return id;
  }

  /** 목록에서 한 칸 위(-1) · 아래(+1)로. 목록 순서 = 팔레트 순서 = 숫자 키 = 홈 막대 순서 */
  moveCategory(id: number, dir: -1 | 1): void {
    const i = this.categories.findIndex((c) => c.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= this.categories.length) return;
    this.editPrefs((p) => { const [c] = p.categories.splice(i, 1); p.categories.splice(j, 0, c); });
  }

  /** 지우기 전에 알려 줄 것: 그 펜으로 칠한 시간(분)과 분류한 할 일 수 (모든 날) */
  categoryUsage(id: number): { minutes: number; tasks: number } {
    let minutes = 0, tasks = 0;
    for (const r of Object.values(this.data.days)) {
      minutes += minutesByCat(r.events).get(id) ?? 0;
      tasks += r.tasks.filter((t) => t.cat === id).length;
    }
    return { minutes, tasks };
  }

  /** 형광펜을 지운다 (최소 1개는 남긴다). 그 펜으로 칠한 칸은 빈 칸, 그 색 할 일은 분류 없음으로 모든 날에서 정리 */
  removeCategory(id: number): void {
    if (this.categories.length <= 1) return;
    this.data.prefs.categories = this.data.prefs.categories.filter((c) => c.id !== id);
    for (const [k, r] of Object.entries(this.data.days)) {
      if (!r.events.some((e) => e.cat === id) && !r.slots.includes(id) && !r.tasks.some((t) => t.cat === id)) continue;
      r.events = r.events.filter((e) => e.cat !== id);
      r.slots = slotsFromEvents(r.events);
      r.tasks = r.tasks.map((t) => (t.cat === id ? { ...t, cat: null } : t));
      if (isEmptyDay(r)) delete this.data.days[k];
    }
    this.onChange();
  }

  /** 이 날의 컬러 컨셉 번호 */
  themeOf(d: Date): number { return this.day(d).theme ?? this.data.prefs.defaultTheme; }

  setTheme(d: Date, theme: number | null): void { this.editDay(d, (r) => { r.theme = theme; }); }

  /** 오늘의 컬러: 기본 컬러와 같은 색을 고르면 따로 고른 것을 지운다 (기본을 따른다) */
  pickDayTheme(d: Date, id: number): void {
    this.setTheme(d, id === this.data.prefs.defaultTheme ? null : id);
  }

  setDefaultTheme(id: number): void { this.editPrefs((p) => { p.defaultTheme = id; }); }

  /** 따로 컬러를 고른 날 수 */
  get themedDayCount(): number { return Object.values(this.data.days).filter((r) => r.theme != null).length; }

  /** 모든 날을 기본 컬러로 (비게 된 날은 지운다) */
  resetAllThemes(): void {
    for (const [k, r] of Object.entries(this.data.days)) {
      if (r.theme == null) continue;
      r.theme = null;
      if (isEmptyDay(r)) delete this.data.days[k];
    }
    this.onChange();
  }

  setDayOff(d: Date, on: boolean): void {
    if (this.day(d).dayOff === on) return;
    this.editDay(d, (r) => { r.dayOff = on; });
  }
}
