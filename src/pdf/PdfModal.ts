// PDF 로 뽑기 창 (원본 PDF-01 ~ PDF-07): 종류 · 용지 · 기간 · 표지 · 자르는 선 → 만들기 (진행률) → 저장소에 저장하고 열기
import { App, Modal, Notice, Setting } from "obsidian";
import * as Dates from "../model/dates";
import { Planner } from "../model/planner";
import { Wrap } from "../model/ruled";
import { PageKind } from "../model/types";
import { buildPdf, clampRange, fileName, Paper, PdfKind, PdfOptions, recordedRange, summary } from "./exportPdf";

export class PdfModal extends Modal {
  private o: PdfOptions;
  private busy = false;

  constructor(app: App, private p: Planner, private wrap: Wrap, now: { kind: PageKind; date: Date },
    private save: (name: string, data: ArrayBuffer) => Promise<void>) {
    super(app);
    const d = Dates.day(now.date);
    // 열 때 지금 보는 쪽 종류 · 지금 페이지로 기간을 채운다
    this.o = { kind: now.kind, paper: "half", from: d, to: now.kind === "weekly" ? Dates.addDays(6, Dates.weekStart(d)) : d, front: true, cutLine: true };
  }

  onOpen(): void { this.render(); }

  private render(): void {
    const el = this.contentEl;
    el.empty();
    this.titleEl.setText("PDF 로 뽑기");
    const o = this.o, p = this.p;

    new Setting(el).setName("종류").addDropdown((d) => d.addOptions({ daily: "일간", weekly: "주간", home: "홈 (통계)" }).setValue(o.kind)
      .onChange((v) => { o.kind = v as PdfKind; this.render(); }));
    if (o.kind === "daily") {
      new Setting(el).setName("용지")
        .setDesc(o.paper === "half" ? "A4 가로 한 장에 이틀. 가운데를 자르면 실물 플래너 크기예요." : "A4 세로 한 장에 하루.")
        .addDropdown((d) => d.addOptions({ half: "A4 반쪽 · 두 장씩", a4: "A4 세로 · 하루 한 장" }).setValue(o.paper)
          .onChange((v) => { o.paper = v as Paper; this.render(); }));
    } else {
      new Setting(el).setDesc(o.kind === "weekly" ? "A4 가로 한 장에 한 주." : "A4 가로 1장, 오늘 기준.");
    }

    if (o.kind !== "home") {
      const [a, b] = clampRange(p, o.from, o.to);
      const range = new Setting(el).setName(o.kind === "weekly" ? "기간 (주 단위)" : "기간");
      range.addText((t) => { t.inputEl.type = "date"; t.setValue(Dates.key(a)).onChange((v) => { const d = Dates.parseKey(v); if (d) { o.from = d; this.refreshSummary(); } }); });
      range.addText((t) => { t.inputEl.type = "date"; t.setValue(Dates.key(b)).onChange((v) => { const d = Dates.parseKey(v); if (d) { o.to = d; this.refreshSummary(); } }); });
      const quick = new Setting(el).setName("빠르게");
      const today = Dates.day(new Date());
      if (o.kind === "daily") {
        quick.addButton((x) => x.setButtonText("이번 주").onClick(() => { o.from = Dates.weekStart(today); o.to = Dates.addDays(6, o.from); this.render(); }));
      } else {
        quick.addButton((x) => x.setButtonText("이번 달").onClick(() => {
          o.from = new Date(today.getFullYear(), today.getMonth(), 1); o.to = new Date(today.getFullYear(), today.getMonth() + 1, 0); this.render();
        }));
      }
      quick.addButton((x) => x.setButtonText("기록한 날 전체").onClick(() => {
        const r = recordedRange(p);
        if (!r) { new Notice("아직 기록한 날이 없어요"); return; }
        [o.from, o.to] = r; this.render();
      }));
      if (p.book) new Setting(el).setName("표지와 첫 장 넣기").addToggle((t) => t.setValue(o.front).onChange((v) => { o.front = v; this.refreshSummary(); }));
      if (o.kind === "daily" && o.paper === "half") {
        new Setting(el).setName("가운데 자르는 선 넣기").addToggle((t) => t.setValue(o.cutLine).onChange((v) => { o.cutLine = v; }));
      }
    }

    el.createEl("p", { cls: "tmp-pdf-summary", text: summary(p, o) });
    el.createEl("p", { cls: "setting-item-description", text: "기록이 없는 날은 빈 양식으로 나와요. 인쇄해서 종이로도 쓸 수 있어요." });
    const status = el.createEl("p", { cls: "tmp-pdf-status" });
    new Setting(el).addButton((b) => b.setButtonText("PDF 만들기").setCta().onClick(async () => {
      if (this.busy) return;
      this.busy = true;
      b.setDisabled(true);
      try {
        const data = await buildPdf(p, this.wrap, o, (done, total) => status.setText(`만드는 중 ${done} / ${total}`));
        const name = fileName(p, o);
        status.setText("저장하는 중…");
        await this.save(name, data);
        this.close();
      } catch (e) {
        console.error("10분 플래너: PDF", e);
        status.setText(`PDF를 만들지 못했어요: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        this.busy = false;
        b.setDisabled(false);
      }
    }));
  }

  private refreshSummary(): void {
    const s = this.contentEl.querySelector(".tmp-pdf-summary");
    if (s) s.textContent = summary(this.p, this.o);
  }

  onClose(): void { this.contentEl.empty(); }
}
