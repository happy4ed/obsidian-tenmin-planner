// 경합 재현: 뷰를 먼저 열고 (플래너 없음 → "여는 중"), 그린 직후 같은 틱에 플래너를 채우고 알린다.
// 구독이 알림보다 늦게 걸리면 화면이 "여는 중" 에 멈춘다.
import { BookStore, FileAdapter } from "../../src/storage/bookstore";
import { Planner } from "../../src/model/planner";
import { canvasWrap } from "../../src/canvasWrap";
import { PlannerView } from "../../src/view/PlannerView";

const files = new Map<string, string>();
const fs: FileAdapter = {
  exists: async (p) => files.has(p) || p === "Planner" || p === "Planner/books",
  read: async (p) => files.get(p)!, write: async (p, d) => { files.set(p, d); }, remove: async (p) => { files.delete(p); },
  rename: async (a, b) => { files.set(b, files.get(a)!); files.delete(a); }, mkdir: async () => {},
};
(async () => {
  const store = new BookStore(fs, "Planner");
  await store.loadLibrary();
  const book = await store.createBook("내 플래너", new Date(2026, 9, 1), null);
  const data = (await store.loadBook(book.id))!;
  const listeners = new Set<() => void>();
  const plugin: any = {
    app: {}, store, loadError: null, planner: null, wrap: canvasWrap(), settings: { zooms: { daily: { mode: "page", factor: 1 }, weekly: { mode: "page", factor: 1 } } },
    saveSettings: async () => {}, subscribe: (f: () => void) => { listeners.add(f); return () => listeners.delete(f); },
    setEditing: () => {}, flush: async () => {}, openStore: async () => {},
  };
  const v = new PlannerView({}, plugin);
  await v.onOpen();
  plugin.planner = new Planner(data, book, plugin.wrap, () => listeners.forEach((f) => f()));
  listeners.forEach((f) => f());
})();
