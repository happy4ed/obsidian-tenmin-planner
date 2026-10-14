// 작은 편집 창: D-day (원본 DDayEditor), 새 플래너, 형광펜 이름 · 색
import { App, Modal, Notice, Setting } from "obsidian";
import * as Dates from "../model/dates";
import { ddayCount, Planner } from "../model/planner";
import { Category, MAX_DDAYS } from "../model/types";
import { concepts } from "./theme";

const dateInput = (d: Date) => Dates.key(d);
const fromInput = (v: string): Date | null => Dates.parseKey(v);

/** 이 날의 D-day: 붙인 것 고치기 · 떼기, 어제와 같게, 저장한 것 붙이기, 새로 만들어 붙이기 */
export class DDayModal extends Modal {
  constructor(app: App, private p: Planner, private date: Date) { super(app); }

  onOpen(): void { this.render(); }

  private render(): void {
    const { contentEl: el } = this;
    el.empty();
    const today = Dates.isToday(this.date);
    this.titleEl.setText(`이 날의 D-day · ${today ? "오늘 · " : ""}${Dates.key(this.date)}`);
    const attached = this.p.day(this.date).ddays;
    const full = attached.length >= MAX_DDAYS;

    el.createEl("h4", { text: `붙인 D-day (${attached.length} / ${MAX_DDAYS})` });
    if (!attached.length) el.createEl("p", { text: "아직 없어요.", cls: "setting-item-description" });
    for (const d of attached) {
      new Setting(el)
        .setName(ddayCount(d, this.date))
        .addText((t) => t.setPlaceholder("무엇까지?").setValue(d.title).onChange((v) => this.p.editDDay(d.id, this.date, (x) => { x.title = v; })))
        .addText((t) => {
          t.inputEl.type = "date";
          t.setValue(dateInput(d.date)).onChange((v) => {
            const nd = fromInput(v);
            if (nd) { this.p.editDDay(d.id, this.date, (x) => { x.date = nd; }); this.render(); }
          });
        })
        .addExtraButton((b) => b.setIcon("minus-circle").setTooltip("이 날에서만 떼기 (다른 날과 저장한 목록은 그대로)")
          .onClick(() => { this.p.removeDDay(d.id, this.date); this.render(); }));
    }

    const prev = this.p.day(Dates.addDays(-1, this.date)).ddays;
    if (!attached.length && prev.length) {
      new Setting(el).setName(`어제와 같게 · ${prev.map((x) => x.title || "D-day").join(", ")}`)
        .addButton((b) => b.setButtonText("붙이기").onClick(() => { this.p.copyPreviousDDays(this.date); this.render(); }));
    }

    const lib = this.p.ddayLibrary.filter((x) => !attached.some((a) => a.source === x.id));
    if (lib.length) {
      el.createEl("h4", { text: "저장한 D-day 에서 고르기" });
      const upcoming = lib.filter((x) => Dates.daysBetween(this.date, x.date) >= 0).sort((a, b) => +a.date - +b.date);
      const past = lib.filter((x) => Dates.daysBetween(this.date, x.date) < 0);
      for (const x of upcoming) this.libRow(el, x.id, x.title, x.date, full);
      if (past.length) {
        const det = el.createEl("details");
        det.createEl("summary", { text: `지난 D-day ${past.length}개` });
        for (const x of past) this.libRow(det, x.id, x.title, x.date, full);
      }
    }

    el.createEl("h4", { text: "새로 만들기" });
    let title = "", date = Dates.addDays(30, this.date), save = true;
    new Setting(el).setName("제목").addText((t) => t.setPlaceholder("무엇까지? (예: 시험)").onChange((v) => { title = v; }));
    new Setting(el).setName("날짜").addText((t) => { t.inputEl.type = "date"; t.setValue(dateInput(date)).onChange((v) => { date = fromInput(v) ?? date; }); });
    new Setting(el).setName("목록에도 저장").addToggle((t) => t.setValue(true).onChange((v) => { save = v; }));
    new Setting(el).addButton((b) => b.setButtonText("붙이기").setCta().setDisabled(full).onClick(() => {
      if (this.p.addDDay(title.trim(), date, this.date, save) == null) new Notice("하루에 D-day 는 두 개까지예요");
      this.render();
    }));
  }

  private libRow(el: HTMLElement, id: string, title: string, date: Date, full: boolean): void {
    new Setting(el).setName(title || "D-day").setDesc(`${Dates.key(date)} · ${ddayCount({ id, title, date, source: null }, this.date)}`)
      .addButton((b) => b.setButtonText("붙이기").setDisabled(full).onClick(() => { this.p.applyDDay(id, this.date); this.render(); }));
  }

  onClose(): void { this.contentEl.empty(); }
}

export interface BookForm { name: string; start: Date; end: Date | null; cover: number; }

/** 플래너 만들기 · 고치기: 이름 · 표지 색 · 시작일(필수) · 종료일(선택, 빠르게 정하기) */
export class BookModal extends Modal {
  constructor(app: App, private init: BookForm & { title: string; ok: string; warn?: (f: BookForm) => string | null },
    private onDone: (f: BookForm) => void) { super(app); }

  onOpen(): void {
    const el = this.contentEl;
    this.titleEl.setText(this.init.title);
    const f: BookForm = { name: this.init.name, start: Dates.day(this.init.start), end: this.init.end ? Dates.day(this.init.end) : null, cover: this.init.cover };
    new Setting(el).setName("이름").addText((t) => { t.setPlaceholder("새 플래너").setValue(f.name).onChange((v) => { f.name = v.slice(0, 30); }); t.inputEl.maxLength = 30; });
    const coverRow = new Setting(el).setName("표지 색");
    const swatches: HTMLButtonElement[] = [];
    for (const cc of concepts) {
      const b = coverRow.controlEl.createEl("button", { cls: "tmp-cover-swatch" });
      b.style.background = cc.accent;
      b.title = cc.name;
      b.onclick = () => { f.cover = cc.id; swatches.forEach((x, i) => x.toggleClass("is-active", i === cc.id)); };
      swatches.push(b);
    }
    swatches.forEach((x, i) => x.toggleClass("is-active", i === f.cover));
    new Setting(el).setName("시작일").setDesc("이 날이 첫 장이에요")
      .addText((t) => { t.inputEl.type = "date"; t.setValue(Dates.key(f.start)).onChange((v) => { f.start = Dates.parseKey(v) ?? f.start; }); });
    let endInput: HTMLInputElement | null = null;
    const endRow = new Setting(el).setName("종료일").setDesc("정하면 그날에서 멈추고, 비워 두면 계속 넘어가요")
      .addText((t) => { t.inputEl.type = "date"; endInput = t.inputEl; t.setValue(f.end ? Dates.key(f.end) : "").onChange((v) => { f.end = v ? Dates.parseKey(v) : null; }); });
    const setEnd = (e: Date | null) => { f.end = e; if (endInput) endInput.value = e ? Dates.key(e) : ""; };
    const quick: [string, (s: Date) => Date | null][] = [
      ["없음", () => null],
      ["1개월", (s) => new Date(s.getFullYear(), s.getMonth() + 1, s.getDate() - 1)],
      ["3개월", (s) => new Date(s.getFullYear(), s.getMonth() + 3, s.getDate() - 1)],
      ["6개월", (s) => new Date(s.getFullYear(), s.getMonth() + 6, s.getDate() - 1)],
      ["1년", (s) => new Date(s.getFullYear() + 1, s.getMonth(), s.getDate() - 1)],
      ["올해 말", (s) => new Date(s.getFullYear(), 11, 31)],
    ];
    for (const [label, fn] of quick) endRow.addButton((b) => b.setButtonText(label).onClick(() => setEnd(fn(f.start))));
    const warnEl = el.createEl("p", { cls: "setting-item-description mod-warning" });
    new Setting(el).addButton((b) => b.setButtonText(this.init.ok).setCta().onClick(() => {
      f.name = f.name.trim();
      if (!f.name) { new Notice("이름을 적어 주세요"); return; }
      if (f.end && f.end < f.start) { new Notice("종료일은 시작일과 같거나 그 뒤여야 해요"); return; }
      const w = this.init.warn?.(f);
      if (w && warnEl.getText() !== w) { warnEl.setText(`${w} 한 번 더 누르면 저장해요.`); return; }
      this.close();
      this.onDone(f);
    }));
  }

  onClose(): void { this.contentEl.empty(); }
}

/** 형광펜 이름 · 색 · TOTAL TIME 포함 (이미 칠한 칸 · 할 일에 바로 반영) */
export class PenModal extends Modal {
  constructor(app: App, private p: Planner, private cat: Category) { super(app); }

  onOpen(): void {
    const el = this.contentEl;
    this.titleEl.setText("형광펜");
    new Setting(el).setName("이름").addText((t) => t.setValue(this.cat.name).onChange((v) => this.p.updateCategory(this.cat.id, (c) => { c.name = v; })));
    new Setting(el).setName("색").addColorPicker((cp) => cp.setValue(`#${this.cat.hex}`)
      .onChange((v) => this.p.updateCategory(this.cat.id, (c) => { c.hex = v.replace("#", "").toUpperCase(); })));
    new Setting(el).setName("TOTAL TIME 에 포함").addToggle((t) => t.setValue(this.cat.counts)
      .onChange((v) => this.p.updateCategory(this.cat.id, (c) => { c.counts = v; })));
  }

  onClose(): void { this.contentEl.empty(); }
}

/** 확인 창: 되돌릴 수 없는 일 전에 */
export class ConfirmModal extends Modal {
  constructor(app: App, private title: string, private body: string, private ok: string, private onOk: () => void) { super(app); }

  onOpen(): void {
    this.titleEl.setText(this.title);
    this.contentEl.createEl("p", { text: this.body });
    new Setting(this.contentEl)
      .addButton((b) => b.setButtonText("취소").onClick(() => this.close()))
      .addButton((b) => b.setButtonText(this.ok).setWarning().onClick(() => { this.close(); this.onOk(); }));
  }

  onClose(): void { this.contentEl.empty(); }
}
