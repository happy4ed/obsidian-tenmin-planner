// 브라우저에서 일간 화면을 실제로 눌러 보기 위한 대역 플러그인 (메모리 저장소)
import { BookStore, FileAdapter } from "../../src/storage/bookstore";
import { Planner } from "../../src/model/planner";
import { canvasWrap } from "../../src/canvasWrap";
import { PlannerView } from "../../src/view/PlannerView";

const files = new Map<string, string>();
const fs: FileAdapter = {
  exists: async (p) => files.has(p) || [...files.keys()].some((k) => k.startsWith(p + "/")) || p === "Planner" || p === "Planner/books",
  read: async (p) => files.get(p)!,
  write: async (p, d) => { files.set(p, d); },
  remove: async (p) => { files.delete(p); },
  rename: async (a, b) => { files.set(b, files.get(a)!); files.delete(a); },
  mkdir: async () => {},
};

(async () => {
  const store = new BookStore(fs, "Planner");
  await store.loadLibrary();
  const book = await store.createBook("내 플래너", new Date(2026, 9, 1), null);
  const listeners = new Set<() => void>();
  const plugin: any = {
    app: {}, store, loadError: null, wrap: canvasWrap(), files,
    subscribe: (f: () => void) => { listeners.add(f); return () => listeners.delete(f); },
    setEditing: () => {}, flush: async () => { await store.saveBook(plugin.planner.book.id, plugin.planner.data); },
    switchBook: async () => {}, createBook: async () => {}, openSettings: () => {},
  };
  plugin.planner = new Planner((await store.loadBook(book.id))!, book, plugin.wrap, () => listeners.forEach((f) => f()));
  (window as any).__plugin = plugin;
  const v = new PlannerView({}, plugin);
  await v.onOpen();
})();
