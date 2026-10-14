// 일정 팝업: 제목 · 내용 · 장소 · 시간 (시작 · 끝) · 형광펜 · 지우기 · 반복으로
import { App, Menu, Modal, Setting } from "obsidian";
import { Planner } from "../model/planner";
import { slotTime } from "../model/repeat";
import { UUID } from "../model/uuid";
import * as Dates from "../model/dates";
import { addQuickRepeatItems } from "./quickRepeat";

export class EventModal extends Modal {
  constructor(app: App, private p: Planner, private date: Date, private id: UUID) { super(app); }

  private get ev() { return this.p.day(this.date).events.find((e) => e.id === this.id); }

  onOpen(): void { this.render(); }

  private render(): void {
    const el = this.contentEl;
    el.empty();
    const ev = this.ev;
    if (!ev) { this.close(); return; }
    this.titleEl.setText(`일정 · ${Dates.key(this.date)}`);
    const upd = (f: (e: NonNullable<typeof ev>) => void) => this.p.updateEvent(this.date, this.id, f);

    new Setting(el).setName("제목").addText((t) => {
      t.setPlaceholder("예: 주간 회의").setValue(ev.title).onChange((v) => upd((e) => { e.title = v; }));
      window.setTimeout(() => t.inputEl.focus(), 0);
    });
    new Setting(el).setName("장소").addText((t) => t.setPlaceholder("예: 3층 회의실").setValue(ev.place).onChange((v) => upd((e) => { e.place = v; })));
    const note = new Setting(el).setName("내용");
    const ta = note.controlEl.createEl("textarea", { cls: "tmp-event-note" });
    ta.value = ev.note;
    ta.placeholder = "메모 · 안건 · 준비물";
    ta.rows = 4;
    ta.oninput = () => upd((e) => { e.note = ta.value; });

    const times = Array.from({ length: 144 }, (_, i) => i);
    new Setting(el).setName("시간")
      .addDropdown((d) => {
        for (const i of times) d.addOption(String(i), slotTime(i));
        d.setValue(String(ev.from)).onChange((v) => { upd((e) => { e.from = Number(v); if (e.to < e.from) e.to = e.from; }); this.render(); });
      })
      .addDropdown((d) => {
        for (const i of times) if (i >= ev.from) d.addOption(String(i), `~ ${slotTime(i, true)}`);
        d.setValue(String(ev.to)).onChange((v) => upd((e) => { e.to = Number(v); }));
      });
    new Setting(el).setName("형광펜").addDropdown((d) => {
      for (const c of this.p.categories) d.addOption(String(c.id), c.name);
      d.setValue(String(ev.cat ?? this.p.categories[0]?.id ?? 0)).onChange((v) => upd((e) => { e.cat = Number(v); }));
    });

    new Setting(el)
      .addButton((b) => b.setButtonText("지우기").setWarning().onClick(() => { this.p.removeEvent(this.date, this.id); this.close(); }))
      .addButton((b) => b.setButtonText("반복으로…").onClick((e) => {
        const cur = this.ev;
        if (!cur) return;
        const m = new Menu();
        addQuickRepeatItems(m, this.app, this.p, this.date, { text: cur.title, cat: cur.cat, paint: { from: cur.from, to: cur.to } });
        m.showAtMouseEvent(e);
      }))
      .addButton((b) => b.setButtonText("닫기").setCta().onClick(() => this.close()));
  }

  onClose(): void { this.contentEl.empty(); }
}
