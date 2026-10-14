// 반복 할 일 창: 목록 (D-day 옆 "반복" 단추 · 설정) 과 만들기 · 고치기
import { App, Modal, Setting } from "obsidian";
import * as Dates from "../model/dates";
import { Planner } from "../model/planner";
import { describeRule, newRule, nextOccurrences, RepeatEnd, RepeatFreq, RepeatRule, WEEKDAY_KO, weekdayIndex, MonthlyMode } from "../model/repeat";
import { UUID } from "../model/uuid";

const FREQ: Record<RepeatFreq, string> = { daily: "매일", weekly: "주마다", weekdays: "요일마다", monthly: "달마다", yearly: "연마다" };
const UNIT: Record<RepeatFreq, string> = { daily: "일마다", weekly: "주마다", weekdays: "주마다", monthly: "달마다", yearly: "년마다" };
const short = (d: Date) => `${d.getMonth() + 1}/${d.getDate()} ${WEEKDAY_KO[weekdayIndex(d)]}`;

/** 반복 목록: 무엇을 · 언제 · 다음 날 · 고치기 · 멈춤 · 지우기 */
export class RepeatListModal extends Modal {
  constructor(app: App, private p: Planner, private today: Date) { super(app); }

  onOpen(): void { this.render(); }

  private render(): void {
    const el = this.contentEl;
    el.empty();
    this.titleEl.setText("반복 할 일");
    el.createEl("p", { cls: "setting-item-description",
      text: "반복하는 날을 펼치면 그날 할 일로 들어가요. 일정에서 지우면 그날 하나만 지워지고 반복은 그대로예요." });
    if (!this.p.repeats.length) el.createEl("p", { text: "아직 없어요. 할 일을 오른쪽 클릭해서 \"반복으로 만들기\" 로도 만들 수 있어요." });
    for (const r of this.p.repeats) repeatRow(el, this.app, this.p, r, this.today, () => this.render());
    new Setting(el).addButton((b) => b.setButtonText("새 반복").setCta().onClick(() => {
      new RepeatEditModal(this.app, this.p, newRule("", this.today), null, () => this.render()).open();
    }));
  }

  onClose(): void { this.contentEl.empty(); }
}

/** 목록 한 줄 (목록 창 · 설정이 같이 쓴다) */
export function repeatRow(el: HTMLElement, app: App, p: Planner, r: RepeatRule, today: Date, refresh: () => void): void {
  const next = nextOccurrences(r, today, 1)[0];
  const cat = p.category(r.cat);
  new Setting(el)
    .setName(`${r.text || "(할 일 없음)"}${cat ? `  · ${cat.name}` : ""}`)
    .setDesc(`${describeRule(r)} · ${next ? `다음 ${short(next)}` : "더 생기지 않아요"}`)
    .addExtraButton((b) => b.setIcon(r.paused ? "play" : "pause").setTooltip(r.paused ? "다시 반복" : "잠깐 멈춤")
      .onClick(() => { p.updateRepeat(r.id, (x) => { x.paused = !x.paused; }); refresh(); }))
    .addExtraButton((b) => b.setIcon("pencil").setTooltip("고치기…").onClick(() => new RepeatEditModal(app, p, r, r.id, refresh).open()))
    .addExtraButton((b) => b.setIcon("trash").setTooltip("반복 지우기…").onClick(() => new RepeatDeleteModal(app, p, r, refresh).open()));
}

/** 반복 지우기: 반복만 · 앞으로 생긴 (표시 없는) 할 일도 */
class RepeatDeleteModal extends Modal {
  constructor(app: App, private p: Planner, private r: RepeatRule, private done: () => void) { super(app); }

  onOpen(): void {
    const n = this.p.repeatMadeCount(this.r.id);
    this.titleEl.setText(`"${this.r.text || "반복"}" 반복 지우기`);
    this.contentEl.createEl("p", { text: `더는 새로 생기지 않아요. 이미 들어간 할 일은 ${n}일에 있어요. 지난 날 기록은 어느 쪽이든 그대로예요.` });
    new Setting(this.contentEl)
      .addButton((b) => b.setButtonText("취소").onClick(() => this.close()))
      .addButton((b) => b.setButtonText("반복만 지우기").onClick(() => { this.p.removeRepeat(this.r.id, false); this.close(); this.done(); }))
      .addButton((b) => b.setButtonText("앞으로 생긴 것도 지우기").setWarning()
        .onClick(() => { this.p.removeRepeat(this.r.id, true); this.close(); this.done(); }));
  }

  onClose(): void { this.contentEl.empty(); }
}

/** 반복 만들기 · 고치기 */
export class RepeatEditModal extends Modal {
  private r: RepeatRule;

  /** id 가 없으면 새로 만든다. adopt: 이 할 일(그날 · id)을 첫 반복 할 일로 삼는다 (오른쪽 클릭 "반복으로 만들기") */
  constructor(app: App, private p: Planner, init: RepeatRule, private id: UUID | null, private done: () => void,
    private adopt?: { date: Date; taskId: UUID }) {
    super(app);
    this.r = structuredClone(init);
  }

  onOpen(): void { this.render(); }

  private render(): void {
    const el = this.contentEl, r = this.r;
    el.empty();
    this.titleEl.setText(this.id ? "반복 고치기" : "반복 만들기");

    new Setting(el).setName("할 일").addText((t) => { t.setPlaceholder("예: 운동 30분").setValue(r.text).onChange((v) => { r.text = v; }); window.setTimeout(() => t.inputEl.focus(), 0); });
    new Setting(el).setName("형광펜 (분류)").addDropdown((d) => {
      d.addOption("", "없음");
      for (const c of this.p.categories) d.addOption(String(c.id), c.name);
      d.setValue(r.cat == null ? "" : String(r.cat)).onChange((v) => { r.cat = v === "" ? null : Number(v); });
    });

    new Setting(el).setName("반복").addDropdown((d) => {
      for (const [k, v] of Object.entries(FREQ)) d.addOption(k, v);
      d.setValue(r.freq).onChange((v) => {
        r.freq = v as RepeatFreq;
        if (r.freq === "weekdays" && !r.weekdays.length) r.weekdays = [weekdayIndex(r.start)];
        this.render();
      });
    });
    new Setting(el).setName("간격").setDesc(`${r.interval === 1 ? "1" : r.interval} ${UNIT[r.freq]}`)
      .addText((t) => {
        t.inputEl.type = "number"; t.inputEl.min = "1"; t.inputEl.max = "99"; t.inputEl.style.width = "64px";
        t.setValue(String(r.interval)).onChange((v) => { r.interval = Math.max(1, Math.min(99, Math.floor(Number(v)) || 1)); this.preview(); });
      });

    if (r.freq === "weekdays") {
      const row = new Setting(el).setName("요일");
      WEEKDAY_KO.forEach((name, i) => {
        const b = row.controlEl.createEl("button", { text: name, cls: `tmp-wd-pick ${r.weekdays.includes(i) ? "is-active" : ""}` });
        b.onclick = () => {
          r.weekdays = r.weekdays.includes(i) ? r.weekdays.filter((x) => x !== i) : [...r.weekdays, i].sort();
          b.toggleClass("is-active", r.weekdays.includes(i));
          this.preview();
        };
      });
      row.addButton((b) => b.setButtonText("평일").onClick(() => { r.weekdays = [0, 1, 2, 3, 4]; this.render(); }));
      row.addButton((b) => b.setButtonText("주말").onClick(() => { r.weekdays = [5, 6]; this.render(); }));
    }
    if (r.freq === "monthly") {
      const s = r.start;
      const nth = Math.floor((s.getDate() - 1) / 7) + 1;
      const nthName = nth >= 5 ? "마지막" : ["첫째", "둘째", "셋째", "넷째"][nth - 1];
      new Setting(el).setName("달마다 언제").addDropdown((d) => d.addOptions({
        date: `${s.getDate()}일 (그달에 없으면 말일)`, nth: `${nthName} ${WEEKDAY_KO[weekdayIndex(s)]}요일`, last: "말일",
      }).setValue(r.monthly).onChange((v) => { r.monthly = v as MonthlyMode; this.preview(); }));
    }

    new Setting(el).setName("시작일").setDesc("이 날부터 반복해요. 주마다 · 달마다 · 연마다는 이 날을 기준으로 해요")
      .addText((t) => { t.inputEl.type = "date"; t.setValue(Dates.key(r.start)).onChange((v) => { const d = Dates.parseKey(v); if (d) { r.start = d; this.render(); } }); });

    const endRow = new Setting(el).setName("끝");
    endRow.addDropdown((d) => d.addOptions({ never: "계속", until: "날짜까지", count: "횟수만큼" }).setValue(r.end.type).onChange((v) => {
      r.end = v === "until" ? { type: "until", until: Dates.addDays(30, r.start) } : v === "count" ? { type: "count", count: 10 } : { type: "never" };
      this.render();
    }));
    if (r.end.type === "until") {
      const end = r.end;
      endRow.addText((t) => { t.inputEl.type = "date"; t.setValue(Dates.key(end.until)).onChange((v) => { const d = Dates.parseKey(v); if (d) { r.end = { type: "until", until: d } as RepeatEnd; this.preview(); } }); });
    } else if (r.end.type === "count") {
      const end = r.end;
      endRow.addText((t) => {
        t.inputEl.type = "number"; t.inputEl.min = "1"; t.inputEl.style.width = "64px";
        t.setValue(String(end.count)).onChange((v) => { r.end = { type: "count", count: Math.max(1, Math.floor(Number(v)) || 1) }; this.preview(); });
      });
      endRow.descEl.setText("번");
    }
    new Setting(el).setName("DAY OFF 인 날은 빼기").addToggle((t) => t.setValue(r.skipDayOff).onChange((v) => { r.skipDayOff = v; }));

    el.createEl("p", { cls: "tmp-repeat-preview" });
    this.preview();

    new Setting(el).addButton((b) => b.setButtonText("취소").onClick(() => this.close()))
      .addButton((b) => b.setButtonText(this.id ? "저장" : "반복 만들기").setCta().onClick(() => {
        r.text = r.text.trim();
        if (!r.text) { this.setPreview("할 일을 적어 주세요."); return; }
        if (r.freq === "weekdays" && !r.weekdays.length) { this.setPreview("요일을 하나 이상 골라 주세요."); return; }
        if (this.id) {
          const v = r;
          this.p.updateRepeat(this.id, (x) => Object.assign(x, { ...v, id: x.id, exceptions: x.exceptions }));
        } else {
          const { id: _id, exceptions: _e, ...rest } = r;
          const nid = this.p.addRepeat(rest);
          if (this.adopt) this.p.adoptAsRepeat(this.adopt.date, this.adopt.taskId, nid);
        }
        this.close();
        this.done();
      }));
  }

  private setPreview(t: string): void {
    const el = this.contentEl.querySelector(".tmp-repeat-preview");
    if (el) el.textContent = t;
  }

  private preview(): void {
    const next = nextOccurrences(this.r, Dates.day(new Date()), 5);
    this.setPreview(`${describeRule(this.r)}\n다음: ${next.length ? next.map(short).join(", ") : "생기는 날이 없어요"}`);
  }

  onClose(): void { this.contentEl.empty(); }
}
