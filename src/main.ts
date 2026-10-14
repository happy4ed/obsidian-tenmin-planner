import { App, Notice, Plugin, PluginSettingTab, Setting, normalizePath } from "obsidian";
import { BookStore, FileAdapter } from "./storage/bookstore";
import { Planner } from "./model/planner";
import { canvasWrap } from "./canvasWrap";
import * as Dates from "./model/dates";
import { emptyData } from "./model/types";

interface Settings { folder: string; }
const DEFAULTS: Settings = { folder: "Planner" };
const SAVE_DELAY_MS = 600;

export default class TenMinPlanner extends Plugin {
  settings: Settings = { ...DEFAULTS };
  store!: BookStore;
  planner: Planner | null = null;
  private saveTimer: number | null = null;

  async onload(): Promise<void> {
    this.settings = { ...DEFAULTS, ...(await this.loadData()) };
    this.addSettingTab(new TenMinSettingTab(this.app, this));
    this.app.workspace.onLayoutReady(() => void this.openStore());

    this.addCommand({
      id: "check-today",
      name: "오늘 기록 점검",
      callback: () => {
        const p = this.planner;
        if (!p) { new Notice("10분 플래너: 아직 책을 열지 못했습니다"); return; }
        const today = new Date();
        const [h, m] = Dates.formatHM(p.minutes(today));
        new Notice(`${p.book?.name ?? "플래너"} · ${Dates.key(today)} · 할 일 ${p.day(today).tasks.length}개 · TOTAL ${h}:${m}`);
      },
    });
  }

  async onunload(): Promise<void> {
    await this.flush();
  }

  async openStore(): Promise<void> {
    const a = this.app.vault.adapter;
    const fs: FileAdapter = {
      exists: (p) => a.exists(normalizePath(p)),
      read: (p) => a.read(normalizePath(p)),
      write: (p, d) => a.write(normalizePath(p), d),
      remove: (p) => a.remove(normalizePath(p)),
      rename: (f, t) => a.rename(normalizePath(f), normalizePath(t)),
      mkdir: (p) => a.mkdir(normalizePath(p)),
    };
    this.store = new BookStore(fs, normalizePath(this.settings.folder));
    const lib = await this.store.loadLibrary();
    if (this.store.libraryUnreadable) {
      new Notice(`10분 플래너: library.json 을 읽지 못했습니다. 원본은 그대로 두었습니다.\n${this.store.libraryUnreadable.reason}`, 0);
      return;
    }
    let book = this.store.activeBook ?? lib.books[0] ?? null;
    if (!book) book = await this.store.createBook("내 플래너", new Date(), null);
    const data = await this.store.loadBook(book.id);
    if (!data) {
      new Notice(`10분 플래너: "${book.name}" 책 파일을 읽지 못했습니다. 원본은 그대로 두었습니다.`, 0);
      return;
    }
    this.planner = new Planner(data ?? emptyData(), book, canvasWrap(), () => this.scheduleSave());
  }

  scheduleSave(): void {
    if (this.saveTimer != null) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => void this.flush(), SAVE_DELAY_MS);
  }

  async flush(): Promise<void> {
    if (this.saveTimer != null) { window.clearTimeout(this.saveTimer); this.saveTimer = null; }
    const p = this.planner;
    if (!p?.book) return;
    await this.store.saveBook(p.book.id, p.data);
    await this.store.saveLibrary();
  }
}

class TenMinSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: TenMinPlanner) { super(app, plugin); }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl)
      .setName("저장 폴더")
      .setDesc("library.json 과 books/ 를 둘 저장소 안 폴더. 바꾸면 다시 불러옵니다.")
      .addText((t) => t.setValue(this.plugin.settings.folder).onChange(async (v) => {
        this.plugin.settings.folder = v.trim() || DEFAULTS.folder;
        await this.plugin.saveData(this.plugin.settings);
      }))
      .addButton((b) => b.setButtonText("다시 불러오기").onClick(async () => {
        await this.plugin.flush();
        await this.plugin.openStore();
        new Notice("10분 플래너: 다시 불러왔습니다");
      }));
  }
}
