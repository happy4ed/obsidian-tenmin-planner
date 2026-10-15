// 노트 목록에 보이는 플래너 바로가기 (<이름>.tenmin).
// - 기록은 그대로 책장(library.json · books/) 에 둔다. 바로가기에는 책 id 만 적는다 → 지워도 기록은 남는다.
// - 책마다 한 번만 저절로 만든다 (linked). 지운 바로가기는 다시 만들지 않는다.
// - 이름: 바로가기 이름을 바꾸면 플래너 이름도, 플래너 이름을 바꾸면 바로가기 이름도 따라간다.

import { App, FileView, Notice, TAbstractFile, TFile, TFolder, WorkspaceLeaf, normalizePath } from "obsidian";
import type TenMinPlanner from "./main";
import { BookInfo } from "./model/types";
import { LINK_EXT, linkText, parseLink, safeName } from "./model/linkFile";
import { sameUUID, UUID } from "./model/uuid";

export { LINK_EXT };

export const LINK_VIEW = "tenmin-planner-link";

export class Links {
  /** 내가 지우거나 이름을 바꾸는 중인 경로 (그 이벤트에는 반응하지 않는다) */
  private mine = new Set<string>();
  private ids = new Map<string, UUID>();

  constructor(private app: App, private plugin: TenMinPlanner) {}

  files(): TFile[] { return this.app.vault.getFiles().filter((f) => f.extension === LINK_EXT); }

  async idOf(f: TFile): Promise<UUID | null> {
    const id = parseLink(await this.app.vault.cachedRead(f));
    if (id) this.ids.set(f.path, id); else this.ids.delete(f.path);
    return id;
  }

  async filesOf(id: UUID): Promise<TFile[]> {
    const out: TFile[] = [];
    for (const f of this.files()) if (sameUUID(await this.idOf(f), id)) out.push(f);
    return out;
  }

  private freePath(folder: string, name: string): string {
    const base = normalizePath(`${folder}/${safeName(name)}`);
    let p = `${base}.${LINK_EXT}`;
    for (let n = 2; this.app.vault.getAbstractFileByPath(p); n++) p = `${base} ${n}.${LINK_EXT}`;
    return p;
  }

  private async ensureFolder(folder: string): Promise<void> {
    if (folder && !this.app.vault.getAbstractFileByPath(folder)) { try { await this.app.vault.createFolder(folder); } catch { /* 이미 있음 */ } }
  }

  /** 책 하나의 바로가기를 만든다 (folder 를 안 주면 저장 폴더) */
  async create(book: BookInfo, folder = this.plugin.settings.folder): Promise<TFile> {
    const dir = normalizePath(folder || "/");
    await this.ensureFolder(dir === "/" ? "" : dir);
    const f = await this.app.vault.create(this.freePath(dir === "/" ? "" : dir, book.name), linkText(book.id));
    this.ids.set(f.path, book.id.toUpperCase());
    this.markLinked(book.id);
    return f;
  }

  private markLinked(id: UUID): void {
    const s = this.plugin.settings;
    if (!s.linked.some((x) => sameUUID(x, id))) { s.linked.push(id.toUpperCase()); void this.plugin.saveSettings(); }
  }

  /** 아직 한 번도 바로가기가 없던 책에만 만든다 (예시 책은 빼고) */
  async sync(): Promise<void> {
    const books = this.plugin.store?.library.books ?? [];
    const have = new Set<string>();
    for (const f of this.files()) { const id = await this.idOf(f); if (id) have.add(id); }
    for (const b of books) {
      const id = b.id.toUpperCase();
      if (have.has(id)) { this.markLinked(id); continue; }
      if (b.isSample || this.plugin.settings.linked.some((x) => sameUUID(x, id))) continue;
      try { await this.create(b); } catch (e) { console.warn("10분 플래너: 바로가기 만들기", b.name, e); }
    }
  }

  /** 플래너 이름이 바뀌면 바로가기 이름도 */
  async renamed(book: BookInfo): Promise<void> {
    for (const f of await this.filesOf(book.id)) {
      if (f.basename === safeName(book.name)) continue;
      const to = this.freePath(f.parent?.path ?? "", book.name);
      this.mine.add(f.path); this.mine.add(to);
      try { await this.app.fileManager.renameFile(f, to); } finally { this.mine.delete(f.path); this.mine.delete(to); }
    }
  }

  /** 플래너를 지우면 바로가기도 휴지통으로 */
  async deleted(id: UUID): Promise<void> {
    for (const f of await this.filesOf(id)) {
      this.mine.add(f.path);
      try {
        const fm = this.app.fileManager as unknown as { trashFile?: (f: TFile) => Promise<void> };
        if (fm.trashFile) await fm.trashFile(f); else await this.app.vault.trash(f, true);
      } finally { this.mine.delete(f.path); }
    }
  }

  /** 바로가기 이름을 바꾸면 플래너 이름도 */
  async onRename(f: TAbstractFile, oldPath: string): Promise<void> {
    if (!(f instanceof TFile) || f.extension !== LINK_EXT) return;
    const id = this.ids.get(oldPath) ?? (await this.idOf(f));
    this.ids.delete(oldPath);
    if (id) this.ids.set(f.path, id);
    if (!id || this.mine.has(f.path) || this.mine.has(oldPath)) return;
    const b = this.plugin.store?.library.books.find((x) => sameUUID(x.id, id));
    if (b && safeName(b.name) !== f.basename) {
      await this.plugin.store.updateBook(b.id, { name: f.basename });
      this.plugin.notify();
    }
  }

  /** 바로가기를 지워도 기록은 남는다고 알린다 */
  onDelete(f: TAbstractFile): void {
    if (!(f instanceof TFile) || f.extension !== LINK_EXT) return;
    const id = this.ids.get(f.path);
    this.ids.delete(f.path);
    if (!id || this.mine.has(f.path)) return;
    const b = this.plugin.store?.library.books.find((x) => sameUUID(x.id, id));
    if (b) new Notice(`10분 플래너: "${b.name}" 바로가기를 지웠어요. 기록은 책장에 그대로 있어요.`);
  }

  /** 폴더 오른쪽 클릭 → 새 10분 플래너 (그 폴더에 바로가기) */
  folderOf(f: TAbstractFile): string { return f instanceof TFolder ? f.path : f.parent?.path ?? ""; }
}

/** 바로가기를 열면 그 플래너를 펼친 플래너 화면으로 바뀐다 */
export class PlannerLinkView extends FileView {
  constructor(leaf: WorkspaceLeaf, private plugin: TenMinPlanner) { super(leaf); }

  getViewType(): string { return LINK_VIEW; }
  getDisplayText(): string { return this.file?.basename ?? "10분 플래너"; }
  getIcon(): string { return "calendar-clock"; }
  canAcceptExtension(ext: string): boolean { return ext === LINK_EXT; }

  async onLoadFile(file: TFile): Promise<void> {
    this.contentEl.empty();
    this.contentEl.addClass("tmp-empty");
    this.contentEl.createDiv({ text: "플래너를 여는 중…" });
    const id = await this.plugin.links.idOf(file);
    await this.plugin.ready();
    const book = id ? this.plugin.store?.library.books.find((b) => sameUUID(b.id, id)) : undefined;
    if (!book) {
      this.contentEl.empty();
      this.contentEl.createDiv({ text: "이 바로가기의 플래너가 책장에 없어요. 지웠거나 다른 저장소의 바로가기예요." });
      const btn = this.contentEl.createEl("button", { cls: "mod-cta", text: "책장 열기" });
      btn.onclick = () => void this.plugin.openView();
      return;
    }
    // 이 탭을 플래너 화면으로 바꾼다 (onLoadFile 이 끝난 뒤)
    window.setTimeout(() => void this.plugin.openBookIn(this.leaf, book.id));
  }

  async onUnloadFile(): Promise<void> { this.contentEl.empty(); }
}
