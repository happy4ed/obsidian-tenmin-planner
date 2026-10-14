// 백업 가져오기: 저장소 안 JSON 고르기 또는 기기에서 파일 고르기
import { App, Modal, Setting, TFile } from "obsidian";

export class ImportModal extends Modal {
  constructor(app: App, private folder: string, private onPick: (name: string, text: string) => void) { super(app); }

  onOpen(): void {
    const el = this.contentEl;
    this.titleEl.setText("백업 가져오기");
    el.createEl("p", { cls: "setting-item-description", text: "백업은 새 플래너로 되살아나요. 지금 있는 플래너는 그대로예요." });
    new Setting(el).setName("기기에서 고르기").addButton((b) => b.setButtonText("파일 고르기…").onClick(() => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json,application/json";
      input.onchange = async () => {
        const f = input.files?.[0];
        if (!f) return;
        this.close();
        this.onPick(f.name, await f.text());
      };
      input.click();
    }));
    const inner = `${this.folder}/books/`;
    const files = this.app.vault.getFiles()
      .filter((f) => f.extension === "json" && !f.path.startsWith(inner) && f.path !== `${this.folder}/library.json`)
      .sort((a, b) => b.stat.mtime - a.stat.mtime)
      .slice(0, 30);
    el.createEl("h4", { text: "저장소에 있는 JSON" });
    if (!files.length) el.createEl("p", { cls: "setting-item-description", text: "저장소에 JSON 파일이 없어요." });
    for (const f of files) {
      new Setting(el).setName(f.name).setDesc(f.parent?.path ?? "").addButton((b) => b.setButtonText("가져오기").onClick(async () => {
        this.close();
        this.onPick(f.name, await this.app.vault.read(f as TFile));
      }));
    }
  }

  onClose(): void { this.contentEl.empty(); }
}
