import { App, Notice, Plugin, PluginSettingTab, Setting, TAbstractFile, normalizePath } from "obsidian";
import { BookStore, FileAdapter } from "./storage/bookstore";
import { Planner } from "./model/planner";
import { Wrap } from "./model/ruled";
import { canvasWrap } from "./canvasWrap";
import { defaultZooms, PlannerView, VIEW_TYPE, Zooms } from "./view/PlannerView";
import { UUID } from "./model/uuid";

interface Settings { folder: string; zooms: Zooms; zoomVersion: number; }
/** 크기 설정 형식이 바뀌면 올린다 (0.2.1: "한 장" 기본값으로 다시 시작) */
const ZOOM_VERSION = 2;
const DEFAULTS: Settings = { folder: "Planner", zooms: defaultZooms(), zoomVersion: ZOOM_VERSION };
const SAVE_DELAY_MS = 600;
/** 쓰는 칸을 마지막으로 고친 뒤 이 시간 안이면 밖에서 바뀐 파일을 바로 넣지 않는다 (원본 editingGrace) */
const EDITING_GRACE_MS = 5000;

export default class TenMinPlanner extends Plugin {
  settings: Settings = { ...DEFAULTS };
  store!: BookStore;
  planner: Planner | null = null;
  loadError: string | null = null;
  wrap!: Wrap;
  private saveTimer: number | null = null;
  private listeners = new Set<() => void>();
  private editing = false;
  private lastLocalEdit = 0;
  private pendingReload: number | null = null;

  async onload(): Promise<void> {
    const saved = (await this.loadData()) ?? {};
    // 예전 크기 설정은 버리고 "한 장" 으로 시작한다 (폰에서 종이가 화면을 넘던 판)
    const zooms: Zooms = saved.zoomVersion === ZOOM_VERSION ? { ...defaultZooms(), ...(saved.zooms ?? {}) } : defaultZooms();
    this.settings = { folder: saved.folder ?? DEFAULTS.folder, zooms, zoomVersion: ZOOM_VERSION };
    this.addSettingTab(new TenMinSettingTab(this.app, this));
    this.registerView(VIEW_TYPE, (leaf) => new PlannerView(leaf, this));
    this.addRibbonIcon("calendar-clock", "10분 플래너 열기", () => void this.openView());
    this.app.workspace.onLayoutReady(() => {
      this.wrap = canvasWrap();
      void this.openStore();
    });

    this.addCommand({ id: "open", name: "플래너 열기", callback: () => void this.openView() });
    for (const [id, name, cmd] of [["prev", "이전 장", "prev"], ["next", "다음 장", "next"], ["today", "오늘", "today"],
      ["daily", "일간 보기", "daily"], ["weekly", "주간 보기", "weekly"], ["home", "홈 (통계)", "home"]] as const) {
      this.addCommand({
        id, name,
        checkCallback: (checking) => {
          const v = this.app.workspace.getActiveViewOfType(PlannerView);
          if (!v?.command) return false;
          if (!checking) v.command(cmd);
          return true;
        },
      });
    }

    // 밖(동기화 · 다른 기기)에서 책 파일이 바뀌면 다시 읽는다
    const onFile = (f: TAbstractFile) => { if (this.planner?.book && f.path === this.store?.bookPath(this.planner.book.id)) this.externalChanged(); };
    this.registerEvent(this.app.vault.on("modify", onFile));
    this.registerEvent(this.app.vault.on("create", onFile));
    this.registerEvent(this.app.vault.on("rename", onFile));
  }

  async onunload(): Promise<void> {
    await this.flush();
  }

  async saveSettings(): Promise<void> { await this.saveData(this.settings); }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void { for (const fn of this.listeners) fn(); }

  setEditing(on: boolean): void {
    this.editing = on;
    if (!on && this.pendingReload != null) this.externalChanged();
  }

  async openView(): Promise<void> {
    const ws = this.app.workspace;
    const existing = ws.getLeavesOfType(VIEW_TYPE)[0];
    const leaf = existing ?? ws.getLeaf("tab");
    if (!existing) await leaf.setViewState({ type: VIEW_TYPE, active: true });
    ws.revealLeaf(leaf);
  }

  openSettings(): void {
    const s = (this.app as unknown as { setting?: { open(): void; openTabById(id: string): void } }).setting;
    s?.open();
    s?.openTabById(this.manifest.id);
  }

  private fs(): FileAdapter {
    const a = this.app.vault.adapter;
    return {
      exists: (p) => a.exists(normalizePath(p)),
      read: (p) => a.read(normalizePath(p)),
      write: (p, d) => a.write(normalizePath(p), d),
      remove: (p) => a.remove(normalizePath(p)),
      rename: (f, t) => a.rename(normalizePath(f), normalizePath(t)),
      mkdir: (p) => a.mkdir(normalizePath(p)),
    };
  }

  async openStore(): Promise<void> {
    this.planner = null;
    this.loadError = null;
    this.store = new BookStore(this.fs(), normalizePath(this.settings.folder));
    const lib = await this.store.loadLibrary();
    if (this.store.libraryUnreadable) {
      this.loadError = `library.json 을 읽지 못했습니다. 원본은 그대로 두고 사본을 남겼습니다.\n${this.store.libraryUnreadable.reason}`;
      new Notice(`10분 플래너: ${this.loadError}`, 0);
      this.notify();
      return;
    }
    // 펼친 책 → 못 읽으면 읽을 수 있는 다른 책 → 없으면 새 책
    const order = [this.store.activeBook, ...lib.books.filter((b) => b.id !== lib.activeID)].filter(Boolean);
    for (const book of order) {
      const data = await this.store.loadBook(book!.id);
      if (data) { this.useBook(book!.id, data); return; }
      new Notice(`10분 플래너: "${book!.name}" 책 파일을 읽지 못했습니다. 원본은 그대로 두었습니다.`, 0);
    }
    const book = await this.store.createBook("내 플래너", new Date(), null);
    this.useBook(book.id, (await this.store.loadBook(book.id))!);
  }

  private useBook(id: UUID, data: NonNullable<Awaited<ReturnType<BookStore["loadBook"]>>>): void {
    const book = this.store.library.books.find((b) => b.id === id) ?? null;
    if (this.store.library.activeID !== id) { this.store.library.activeID = id; void this.store.saveLibrary(); }
    this.planner = new Planner(data, book, this.wrap, () => this.changed());
    this.notify();
  }

  private changed(): void {
    this.lastLocalEdit = Date.now();
    this.scheduleSave();
    this.notify();
  }

  async switchBook(id: UUID): Promise<void> {
    if (this.planner?.book?.id === id) return;
    await this.flush();
    const data = await this.store.loadBook(id);
    if (!data) { new Notice("10분 플래너: 그 책 파일을 읽지 못했습니다. 원본은 그대로 두었습니다."); return; }
    this.useBook(id, data);
  }

  async createBook(name: string, start: Date, end: Date | null): Promise<void> {
    await this.flush();
    const book = await this.store.createBook(name, start, end, 0, this.planner?.data.prefs);
    this.useBook(book.id, (await this.store.loadBook(book.id))!);
  }

  private externalChanged(): void {
    if (this.pendingReload != null) window.clearTimeout(this.pendingReload);
    const wait = this.editing ? Math.max(0, EDITING_GRACE_MS - (Date.now() - this.lastLocalEdit)) : 0;
    this.pendingReload = window.setTimeout(async () => {
      this.pendingReload = null;
      const p = this.planner;
      if (!p?.book) return;
      if (this.editing && Date.now() - this.lastLocalEdit < EDITING_GRACE_MS) { this.externalChanged(); return; }
      const data = await this.store.readChangedBook(p.book.id);
      if (!data) return;
      if (this.saveTimer != null) { window.clearTimeout(this.saveTimer); this.saveTimer = null; }
      p.data = data;
      this.notify();
      new Notice("10분 플래너: 다른 곳에서 바뀐 기록을 불러왔습니다");
    }, wait);
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
      .setDesc("library.json 과 books/ 를 둘 저장소 안 폴더. 바꾸면 다시 불러오기를 누르세요.")
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
