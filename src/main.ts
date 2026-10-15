import { App, Editor, Notice, Plugin, PluginSettingTab, Setting, TAbstractFile, TFile, TFolder, WorkspaceLeaf, normalizePath } from "obsidian";
import { LINK_EXT, LINK_VIEW, Links, PlannerLinkView } from "./links";
import { DayCard, parseCardArgs } from "./view/dayCard";
import { PdfModal } from "./pdf/PdfModal";
import { ImportModal } from "./storage/ImportModal";
import { backupFileName, backupText, firstRecordedDay, nameFromBackup, parseBackup, recordSummary } from "./storage/backup";
import { BookStore, FileAdapter } from "./storage/bookstore";
import { Planner } from "./model/planner";
import { Wrap } from "./model/ruled";
import { canvasWrap } from "./canvasWrap";
import { defaultZooms, PlannerView, VIEW_TYPE, Zooms } from "./view/PlannerView";
import { sameUUID, UUID } from "./model/uuid";
import { BookModal, ConfirmModal } from "./view/modals";
import { repeatRow, RepeatEditModal } from "./view/repeatModals";
import { newRule } from "./model/repeat";
import * as Dates from "./model/dates";
import { conceptOf } from "./view/theme";
import { concepts } from "./view/theme";

/** linked: 바로가기를 한 번 만든 책 id (지운 바로가기는 다시 만들지 않는다) */
interface Settings { folder: string; zooms: Zooms; zoomVersion: number; linked: string[]; }
/** 크기 설정 형식이 바뀌면 올린다 (0.2.1: "한 장" 기본값으로 다시 시작) */
const ZOOM_VERSION = 2;
const DEFAULTS: Settings = { folder: "Planner", zooms: defaultZooms(), zoomVersion: ZOOM_VERSION, linked: [] };
const SAVE_DELAY_MS = 600;
/** 쓰는 칸을 마지막으로 고친 뒤 이 시간 안이면 밖에서 바뀐 파일을 바로 넣지 않는다 (원본 editingGrace) */
const EDITING_GRACE_MS = 5000;

export default class TenMinPlanner extends Plugin {
  settings: Settings = { ...DEFAULTS };
  store!: BookStore;
  links!: Links;
  planner: Planner | null = null;
  /** 노트 카드에서 연 날 (플래너 화면이 그린 뒤 그 날로 간다) */
  pendingOpen: { date: Date; kind: "daily" | "weekly" } | null = null;
  loadError: string | null = null;
  wrap!: Wrap;
  saveTimer: number | null = null;
  private listeners = new Set<() => void>();
  private editing = false;
  private lastLocalEdit = 0;
  private pendingReload: number | null = null;

  async onload(): Promise<void> {
    const saved = (await this.loadData()) ?? {};
    // 예전 크기 설정은 버리고 "한 장" 으로 시작한다 (폰에서 종이가 화면을 넘던 판)
    const zooms: Zooms = saved.zoomVersion === ZOOM_VERSION ? { ...defaultZooms(), ...(saved.zooms ?? {}) } : defaultZooms();
    this.settings = { folder: saved.folder ?? DEFAULTS.folder, zooms, zoomVersion: ZOOM_VERSION,
      linked: Array.isArray(saved.linked) ? saved.linked.filter((x: unknown) => typeof x === "string") : [] };
    this.links = new Links(this.app, this);
    this.addSettingTab(new TenMinSettingTab(this.app, this));
    this.registerView(VIEW_TYPE, (leaf) => new PlannerView(leaf, this));
    this.registerView(LINK_VIEW, (leaf) => new PlannerLinkView(leaf, this));
    this.registerExtensions([LINK_EXT], LINK_VIEW);
    this.addRibbonIcon("calendar-clock", "10분 플래너 열기", () => void this.openView());
    this.app.workspace.onLayoutReady(() => { if (!this.store && !this.opening) void this.openStore(); });

    // 노트 안 ```tenmin``` → 그날 카드
    this.registerMarkdownCodeBlockProcessor("tenmin", (src, el, ctx) => {
      ctx.addChild(new DayCard(el, this, parseCardArgs(src, ctx.sourcePath, new Date())));
    });
    // 카드 넣기: 폰 자판에 ` 가 없어도 (명령 · 모바일 툴바 · 편집기 메뉴)
    const insertCard = (editor: Editor) => editor.replaceSelection("```tenmin\n```\n");
    this.addCommand({ id: "insert-card", name: "노트에 카드 넣기", icon: "calendar-clock", editorCallback: insertCard });
    this.registerEvent(this.app.workspace.on("editor-menu", (menu, editor) => {
      menu.addItem((i) => i.setTitle("10분 플래너 카드 넣기").setIcon("calendar-clock").onClick(() => insertCard(editor)));
    }));
    // 폴더 오른쪽 클릭 → 새 10분 플래너 (그 폴더에 바로가기)
    this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => {
      if (!(file instanceof TFolder)) return;
      menu.addItem((i) => i.setTitle("새 10분 플래너").setIcon("calendar-clock")
        .onClick(async () => { await this.ready(); this.newBookDialog(() => void this.openView(), file.path); }));
    }));
    this.registerEvent(this.app.vault.on("rename", (f, old) => void this.links.onRename(f, old)));
    this.registerEvent(this.app.vault.on("delete", (f) => this.links.onDelete(f)));

    this.addCommand({ id: "open", name: "플래너 열기", callback: () => void this.openView() });
    this.addCommand({ id: "pdf", name: "PDF로 내보내기…", callback: () => this.openPdfDialog() });
    this.addCommand({ id: "backup-export", name: "백업 내보내기", callback: () => void this.exportBackup() });
    this.addCommand({ id: "backup-import", name: "백업 가져오기…", callback: () => this.importBackupDialog() });
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

  notify(): void { for (const fn of this.listeners) fn(); }

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

  private opening: Promise<void> | null = null;

  /** 책장과 펼친 책을 연다. 실패하면 화면에 까닭과 다시 시도를 보여 준다 (예외로 "여는 중" 에 멈추지 않게) */
  openStore(): Promise<void> {
    if (this.opening) return this.opening;
    this.opening = this.openStoreInner()
      .then(() => this.links.sync().catch((e: unknown) => console.warn("10분 플래너: 바로가기", e)))
      .catch((e: unknown) => {
        console.error("10분 플래너: 불러오기 실패", e);
        this.planner = null;
        this.loadError = `플래너를 불러오지 못했습니다.\n${e instanceof Error ? e.message : String(e)}`;
        this.notify();
      })
      .finally(() => { this.opening = null; });
    return this.opening;
  }

  /** 책장을 다 연 뒤 (화면 준비 → 불러오기). 이미 열었으면 바로 */
  async ready(): Promise<void> {
    await new Promise<void>((r) => this.app.workspace.onLayoutReady(() => r()));
    if (this.opening) await this.opening;
    else if (!this.store) await this.openStore();
  }

  /** 바로가기를 연 탭을 그 플래너 화면으로 바꾼다 (플래너 화면은 하나만 둔다) */
  async openBookIn(leaf: WorkspaceLeaf, id: UUID): Promise<void> {
    await this.switchBook(id);
    const others = this.app.workspace.getLeavesOfType(VIEW_TYPE).filter((l) => l !== leaf);
    await leaf.setViewState({ type: VIEW_TYPE, active: true });
    for (const l of others) l.detach();
    this.app.workspace.revealLeaf(leaf);
  }

  /** 노트 카드에서: 그 플래너의 그 날 (일간 · 주간) 을 연다 */
  async openAt(id: UUID, date: Date, kind: "daily" | "weekly"): Promise<void> {
    await this.ready();
    this.pendingOpen = { date, kind };
    await this.switchBook(id);
    if (!this.planner?.book || !sameUUID(this.planner.book.id, id)) { this.pendingOpen = null; return; }
    await this.openView();
    this.notify();
  }

  private async openStoreInner(): Promise<void> {
    this.planner = null;
    this.loadError = null;
    this.notify();
    if (!this.wrap) this.wrap = canvasWrap();
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

  async createBook(name: string, start: Date, end: Date | null, cover = 0, folder?: string): Promise<void> {
    await this.flush();
    const book = await this.store.createBook(name, start, end, cover, this.planner?.data.prefs);
    this.useBook(book.id, (await this.store.loadBook(book.id))!);
    await this.links.create(book, folder).catch((e: unknown) => console.warn("10분 플래너: 바로가기", e));
  }

  /** 새 플래너 창 (제안 이름 "새 플래너" / "새 플래너 n") */
  newBookDialog(after?: () => void, folder?: string): void {
    const names = this.store.library.books.map((b) => b.name);
    let name = "새 플래너";
    for (let n = 2; names.includes(name); n++) name = `새 플래너 ${n}`;
    if (names.includes(name)) name = "새 플래너";
    new BookModal(this.app, { title: "새 플래너", ok: "플래너 만들기", name, start: new Date(), end: null, cover: 0,
      warn: (f) => (this.store.library.books.some((b) => b.name === f.name) ? "같은 이름의 플래너가 이미 있어요." : null) },
    async (f) => { await this.createBook(f.name, f.start, f.end, f.cover, folder); after?.(); }).open();
  }

  /** 플래너 고치기: 펼친 책이면 새 기간 밖에 기록한 날이 있을 때 먼저 알린다 (기록은 지워지지 않는다) */
  editBookDialog(id: UUID, after?: () => void): void {
    const b = this.store.library.books.find((x) => x.id === id);
    if (!b) return;
    const active = this.planner?.book?.id === id ? this.planner : null;
    new BookModal(this.app, { title: "플래너 고치기", ok: "저장", name: b.name, start: b.start, end: b.end, cover: b.cover,
      warn: (f) => {
        const n = active?.recordedOutside(f.start, f.end) ?? 0;
        return n ? `새 기간 밖에 기록한 날이 ${n}일 있어요. 기록은 지워지지 않지만, 기간을 넓히기 전에는 그 장을 펼칠 수 없어요.` : null;
      } },
    async (f) => {
      const nb = await this.store.updateBook(id, f);
      this.notify();
      if (nb) await this.links.renamed(nb).catch((e: unknown) => console.warn("10분 플래너: 바로가기 이름", e));
      after?.();
    }).open();
  }

  /** 저장소 폴더 안에 바이너리 파일을 쓰고 (같은 이름이면 덮어쓰기) 그 파일을 돌려준다 */
  private async writeVaultFile(dir: string, name: string, data: ArrayBuffer | string): Promise<TFile> {
    const folder = normalizePath(`${this.settings.folder}/${dir}`);
    if (!this.app.vault.getAbstractFileByPath(folder)) { try { await this.app.vault.createFolder(folder); } catch { /* 이미 있음 */ } }
    const path = normalizePath(`${folder}/${name}`);
    const old = this.app.vault.getAbstractFileByPath(path);
    if (old instanceof TFile) {
      if (typeof data === "string") await this.app.vault.modify(old, data); else await this.app.vault.modifyBinary(old, data);
      return old;
    }
    return typeof data === "string" ? this.app.vault.create(path, data) : this.app.vault.createBinary(path, data);
  }

  /** PDF 창: 지금 보는 쪽 종류 · 날로 채운다 */
  openPdfDialog(): void {
    const p = this.planner;
    if (!p) return;
    const v = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view as PlannerView | undefined;
    const now = v?.current ?? { kind: "daily" as const, date: new Date() };
    new PdfModal(this.app, p, this.wrap, now, async (name, data) => {
      const f = await this.writeVaultFile("PDF", name, data);
      new Notice(`10분 플래너: ${f.path} 저장됨`);
      await this.app.workspace.getLeaf("tab").openFile(f);
    }).open();
  }

  /** 백업 내보내기: 펼친 책 한 권을 JSON 하나로 (저장소의 백업 폴더) */
  async exportBackup(): Promise<void> {
    const p = this.planner;
    if (!p?.book) return;
    await this.flush();
    const f = await this.writeVaultFile("백업", backupFileName(p.book.name), backupText(p.data));
    new Notice(`10분 플래너: ${f.path} 저장됨`);
  }

  /** 백업 가져오기: 새 플래너로 되살려 펼친다 (기존 책은 그대로) */
  importBackupDialog(after?: () => void): void {
    new ImportModal(this.app, this.settings.folder, async (fileName, text) => {
      try {
        const data = parseBackup(text);
        const names = this.store.library.books.map((b) => b.name);
        let name = nameFromBackup(fileName);
        if (names.includes(name)) name = `${name} (백업)`;
        const used = new Set(this.store.library.books.map((b) => b.cover));
        const cover = concepts.find((c) => !used.has(c.id))?.id ?? 0;
        await this.flush();
        const book = await this.store.createBookFromData(name, firstRecordedDay(data) ?? new Date(), cover, data);
        this.useBook(book.id, (await this.store.loadBook(book.id))!);
        await this.links.create(book).catch((e: unknown) => console.warn("10분 플래너: 바로가기", e));
        new Notice(`10분 플래너: "${name}" 로 가져왔어요`);
        after?.();
      } catch (e) {
        new Notice(`10분 플래너: ${e instanceof Error ? e.message : String(e)}`);
      }
    }).open();
  }

  /** 플래너 지우기 (확인 후). 펼친 책이면 다음 책을 펼친다 */
  async deleteBook(id: UUID): Promise<void> {
    const wasActive = this.planner?.book?.id === id;
    if (!wasActive) await this.flush();
    if (wasActive && this.saveTimer != null) { window.clearTimeout(this.saveTimer); this.saveTimer = null; }
    const next = await this.store.deleteBook(id);
    if (!next) { new Notice("10분 플래너: 마지막 한 권은 지울 수 없어요"); return; }
    await this.links.deleted(id).catch((e: unknown) => console.warn("10분 플래너: 바로가기 지우기", e));
    if (wasActive) {
      const data = await this.store.loadBook(next.id);
      if (data) this.useBook(next.id, data);
    } else this.notify();
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
        this.display();
      }));

    const p = this.plugin.planner;
    if (!p) return;
    const book = p.book?.name ?? "이 플래너";

    // ── 형광펜 ──
    new Setting(containerEl).setName("형광펜").setHeading().setDesc(`"${book}" 에만 적용돼요. 순서 = 팔레트 순서 = 숫자 키 1–7.`);
    p.categories.forEach((c, i) => {
      const row = new Setting(containerEl).setName(i < 7 ? `${i + 1}` : " ");
      row.addColorPicker((cp) => cp.setValue(`#${c.hex}`).onChange((v) => p.updateCategory(c.id, (x) => { x.hex = v.replace("#", "").toUpperCase(); })));
      row.addText((t) => {
        t.setValue(c.name).onChange((v) => p.updateCategory(c.id, (x) => { x.name = v; }));
        // 비운 채 나가면 "형광펜 n"
        t.inputEl.addEventListener("blur", () => {
          if (t.getValue().trim() === "") { p.updateCategory(c.id, (x) => { x.name = `형광펜 ${i + 1}`; }); this.display(); }
        });
      });
      row.addToggle((t) => t.setTooltip("TOTAL TIME 에 포함").setValue(c.counts).onChange((v) => p.updateCategory(c.id, (x) => { x.counts = v; })));
      row.addExtraButton((b) => b.setIcon("arrow-up").setTooltip("위로 옮기기").setDisabled(i === 0)
        .onClick(() => { p.moveCategory(c.id, -1); this.display(); }));
      row.addExtraButton((b) => b.setIcon("arrow-down").setTooltip("아래로 옮기기").setDisabled(i === p.categories.length - 1)
        .onClick(() => { p.moveCategory(c.id, 1); this.display(); }));
      row.addExtraButton((b) => b.setIcon("trash").setTooltip(p.categories.length <= 1 ? "형광펜은 하나는 남겨야 해요" : "지우기…")
        .setDisabled(p.categories.length <= 1).onClick(() => {
          const u = p.categoryUsage(c.id);
          const [h, m] = [Math.floor(u.minutes / 60), u.minutes % 60];
          new ConfirmModal(this.app, `"${c.name}" 형광펜 지우기`,
            `이 펜으로 칠한 ${h}시간 ${m}분은 빈 칸이 되고, 이 색으로 분류한 할 일 ${u.tasks}개는 분류 없음이 돼요. 되돌릴 수 없어요.`,
            "지우기", () => { p.removeCategory(c.id); this.display(); }).open();
        }));
    });
    new Setting(containerEl).addButton((b) => b.setButtonText("형광펜 추가")
      .setTooltip(p.categories.length >= 12 ? "형광펜은 12개까지 만들 수 있어요" : "")
      .setDisabled(p.categories.length >= 12)
      .onClick(() => { p.addCategory(); this.display(); }));

    // ── 컬러 ──
    new Setting(containerEl).setName("컬러").setHeading()
      .setDesc(`"${book}" 에만 적용돼요. TOTAL TIME · 요일 · D-day · 체크 표시 색이 함께 바뀌어요. 일간 툴바에서 하루만 바꿀 수도 있어요.`);
    // 미리보기 카드: 고르면 기본 컬러 (따로 고르지 않은 모든 날이 따라감)
    const grid = containerEl.createDiv({ cls: "tmp-concept-grid" });
    const now = new Date();
    const md = `${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const wd = Dates.weekdayEN[now.getDay()].slice(0, 3);
    for (const cc of concepts) {
      const card = grid.createEl("button", { cls: `tmp-concept ${p.data.prefs.defaultTheme === cc.id ? "is-active" : ""}` });
      const date = card.createDiv({ cls: "tmp-concept-date" });
      date.createSpan({ text: md });
      date.createSpan({ text: ` ${wd}` }).style.color = cc.accent;
      date.style.backgroundImage = `linear-gradient(to top, transparent 6%, ${cc.tint} 6%, ${cc.tint} 38%, transparent 38%)`;
      const total = card.createDiv({ cls: "tmp-concept-total" });
      total.style.color = cc.accent;
      total.innerHTML = '<span class="d">8</span><span class="u">H</span><span class="d">36</span><span class="u">M</span>';
      card.createDiv({ cls: "tmp-concept-name", text: `${cc.name}${p.data.prefs.defaultTheme === cc.id ? " · 기본" : ""}` });
      card.onclick = () => { p.setDefaultTheme(cc.id); this.display(); };
    }
    const n = p.themedDayCount;
    new Setting(containerEl).setName("모두 기본 컬러로").setDesc(`따로 컬러를 고른 날 ${n}일`)
      .addButton((b) => b.setButtonText("되돌리기…").setDisabled(n === 0).onClick(() => {
        new ConfirmModal(this.app, "모두 기본 컬러로", `따로 컬러를 고른 ${n}일을 모두 기본 컬러로 되돌려요.`, "되돌리기",
          () => { p.resetAllThemes(); this.display(); }).open();
      }));

    // ── 반복 할 일 ──
    new Setting(containerEl).setName("반복 할 일").setHeading()
      .setDesc(`"${book}" 에만 적용돼요. 일정에서 지우면 그날 하나만 지워지고 반복은 그대로예요.`);
    if (!p.repeats.length) containerEl.createEl("p", { cls: "setting-item-description", text: "아직 없어요. 할 일을 오른쪽 클릭해서 \"반복으로 만들기\" 로도 만들 수 있어요." });
    for (const r of p.repeats) repeatRow(containerEl, this.app, p, r, Dates.day(new Date()), () => this.display());
    new Setting(containerEl).addButton((b) => b.setButtonText("새 반복").onClick(() => {
      new RepeatEditModal(this.app, p, newRule("", new Date()), null, () => this.display()).open();
    }));

    // ── PDF · 백업 · 데이터 ──
    new Setting(containerEl).setName("PDF 로 뽑기").setHeading();
    new Setting(containerEl).setDesc("일간 (A4 반쪽 · A4 세로) · 주간 · 홈을 PDF 로. 저장소의 PDF 폴더에 저장하고 바로 열어요.")
      .addButton((b) => b.setButtonText("PDF 로 뽑기…").onClick(() => this.plugin.openPdfDialog()));

    new Setting(containerEl).setName("노트에서 쓰기").setHeading();
    new Setting(containerEl).setName("바로가기")
      .setDesc(`노트 목록의 "${book}.tenmin" 을 누르면 이 플래너가 열려요. 지워도 기록은 그대로예요. 폴더를 오른쪽 클릭해 "새 10분 플래너" 로도 만들 수 있어요.`)
      .addButton((b) => b.setButtonText("바로가기 만들기").onClick(async () => {
        if (!p.book) return;
        const f = await this.plugin.links.create(p.book);
        new Notice(`10분 플래너: ${f.path} 만듦`);
      }));
    new Setting(containerEl).setName("노트 안 카드")
      .setDesc("편집 중 길게 누르기(오른쪽 클릭) → \"10분 플래너 카드 넣기\", 또는 명령 \"노트에 카드 넣기\" 로 넣어요 (모바일 툴바에 이 명령을 올려 두면 편해요). 넣으면 그날 기록이 보여요. 줄마다 \"날짜: 2026-10-15\" · \"플래너: 이름\" 을 적을 수 있고, 날짜가 없으면 노트 이름의 날짜(데일리 노트) 또는 오늘이에요.")
      .addButton((b) => b.setButtonText("블록 복사").onClick(async () => {
        await navigator.clipboard.writeText("```tenmin\n```\n");
        new Notice("10분 플래너: 블록을 복사했어요. 노트에 붙여 넣으세요.");
      }));

    new Setting(containerEl).setName("데이터").setHeading();
    const sum = recordSummary(p.data);
    const [sh, sm] = Dates.formatHM(sum.minutes);
    new Setting(containerEl).setName("저장 위치")
      .setDesc(`${this.plugin.settings.folder}/library.json · ${this.plugin.settings.folder}/books (한 권당 파일 하나 · ${this.plugin.store.library.books.length}권)`);
    new Setting(containerEl).setName("기록 요약").setDesc(`"${book}" · 기록한 날 ${sum.days}일 · 적은 할 일 ${sum.tasks}개 · 칠한 시간 ${sh}시간 ${sm}분`);
    new Setting(containerEl).setName("백업").setDesc(`펼친 플래너 한 권을 JSON 하나로 저장소의 ${this.plugin.settings.folder}/백업 폴더에 저장해요. 가져오면 새 플래너로 되살아나요.`)
      .addButton((b) => b.setButtonText("백업 내보내기").onClick(() => void this.plugin.exportBackup()))
      .addButton((b) => b.setButtonText("백업 가져오기…").onClick(() => this.plugin.importBackupDialog(() => this.display())));

    // ── 단축키 · 정보 ──
    new Setting(containerEl).setName("단축키").setHeading().setDesc("글을 쓰는 중에는 쉬어요. 한글 입력 상태에서도 같은 자리의 키가 돼요.");
    const keys: [string, string][] = [
      ["← →", "이전 · 다음 장 (주간 · 홈은 ↑ ↓ · PageUp PageDown 도)"], ["T", "오늘"], ["D · W · H", "일간 · 주간 · 홈"],
      ["1 – 7", "형광펜 (툴바 순서)"], ["E", "지우개"], ["Esc", "쓰기 마치기"], ["Return", "할 일: 아랫줄로 · 메모: 다음 메모로"],
      ["↑ ↓ (쓰는 중)", "윗줄 · 아랫줄 할 일로"],
    ];
    const ul = containerEl.createEl("ul", { cls: "tmp-keys" });
    for (const [k, v] of keys) { const li = ul.createEl("li"); li.createEl("kbd", { text: k }); li.createSpan({ text: `  ${v}` }); }

    new Setting(containerEl).setName("정보").setHeading();
    new Setting(containerEl).setName(`10분 플래너 ${this.plugin.manifest.version}`)
      .setDesc("MIT 라이선스. 데이터 형식과 편집 규칙은 Spiralday 의 MIT 공개 버전을 참고해 다시 작성했어요 (Spiralday · LeanAgileHungry Inc. 와 관계 없음). 반복 할 일 · PDF 는 이 플러그인에서 만든 기능이에요.")
      .addButton((b) => b.setButtonText("GitHub").onClick(() => window.open("https://github.com/happy4ed/obsidian-tenmin-planner")));
  }
}
