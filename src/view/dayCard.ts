// 노트 안 ```tenmin``` 블록: 그날 기록 카드 (읽기만) + 일간 · 주간 열기.
//   날짜: 2026-10-15 | 오늘   (없으면 노트 이름의 yyyy-MM-dd, 그것도 없으면 오늘)
//   플래너: 내 플래너          (없으면 펼친 플래너)

import { MarkdownRenderChild } from "obsidian";
import type TenMinPlanner from "../main";
import * as Dates from "../model/dates";
import { bookContains, Planner } from "../model/planner";
import { BookInfo, Mark } from "../model/types";
import { sameUUID } from "../model/uuid";
import { CardArgs } from "../model/linkFile";

export { parseCardArgs } from "../model/linkFile";

const MARK: Record<Mark, string> = { [Mark.none]: "·", [Mark.done]: "○", [Mark.partial]: "△", [Mark.missed]: "×", [Mark.moved]: "→" };
const WEEK_KO = ["일", "월", "화", "수", "목", "금", "토"];

const hm = (min: number) => { const [h, m] = Dates.formatHM(min); return `${h}H ${m}M`; };

export class DayCard extends MarkdownRenderChild {
  private off: (() => void) | null = null;
  private timer: number | null = null;
  private other: { id: string; planner: Planner } | null = null;

  constructor(el: HTMLElement, private plugin: TenMinPlanner, private args: CardArgs) { super(el); }

  onload(): void {
    // 펼친 플래너를 고치면 다시 그린다 (쓰는 동안 너무 자주 그리지 않게 잠깐 모아서)
    this.off = this.plugin.subscribe(() => {
      if (this.timer != null) window.clearTimeout(this.timer);
      this.timer = window.setTimeout(() => { this.timer = null; void this.draw(); }, 250);
    });
    void this.draw();
  }

  onunload(): void {
    this.off?.();
    if (this.timer != null) window.clearTimeout(this.timer);
  }

  private findBook(): BookInfo | null {
    const books = this.plugin.store?.library.books ?? [];
    const want = this.args.book;
    if (!want) return this.plugin.planner?.book ?? books[0] ?? null;
    return books.find((b) => b.name === want) ?? books.find((b) => b.name.trim().toLowerCase() === want.toLowerCase()) ?? null;
  }

  private async plannerOf(book: BookInfo): Promise<Planner | null> {
    const active = this.plugin.planner;
    if (active?.book && sameUUID(active.book.id, book.id)) { this.other = null; return active; }
    if (this.other && sameUUID(this.other.id, book.id)) return this.other.planner;
    const data = await this.plugin.store.loadBook(book.id);
    if (!data) return null;
    this.other = { id: book.id, planner: new Planner(data, book, this.plugin.wrap) };
    return this.other.planner;
  }

  async draw(): Promise<void> {
    await this.plugin.ready();
    const el = this.containerEl;
    const book = this.findBook();
    const p = book ? await this.plannerOf(book) : null;
    el.empty();
    const card = el.createDiv({ cls: "tmp-card" });
    if (!book || !p) {
      const names = (this.plugin.store?.library.books ?? []).map((b) => `"${b.name}"`).join(", ");
      card.createDiv({ cls: "tmp-card-empty", text: book ? `"${book.name}" 기록을 읽지 못했어요.` : `"${this.args.book}" 플래너가 없어요. 책장: ${names || "비어 있음"}` });
      return;
    }
    const d = this.args.date;
    const r = p.day(d);

    const head = card.createDiv({ cls: "tmp-card-head" });
    head.createSpan({ cls: "tmp-card-date", text: `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK_KO[d.getDay()]})` });
    head.createSpan({ cls: "tmp-card-book", text: book.name });
    head.createSpan({ cls: "tmp-card-total", text: hm(p.minutes(d)) });
    if (!bookContains(book, d)) card.createDiv({ cls: "tmp-card-note", text: "이 날은 플래너 기간 밖이에요." });

    const cats = p.categories.map((c) => ({ c, min: p.minutes(d, c.id) })).filter((x) => x.min > 0);
    if (cats.length) {
      const row = card.createDiv({ cls: "tmp-card-cats" });
      for (const { c, min } of cats) {
        const chip = row.createSpan({ cls: "tmp-card-cat" });
        chip.createSpan({ cls: "tmp-card-dot" }).style.backgroundColor = `#${c.hex}`;
        chip.createSpan({ text: `${c.name} ${hm(min)}` });
      }
    }

    const tasks = r.tasks.filter((t) => t.text.trim() !== "");
    if (tasks.length) {
      const ul = card.createEl("ul", { cls: "tmp-card-tasks" });
      for (const t of tasks) {
        const li = ul.createEl("li", { cls: `tmp-card-task mark-${t.mark}` });
        li.createSpan({ cls: "tmp-card-mark", text: MARK[t.mark] });
        const dot = li.createSpan({ cls: "tmp-card-dot" });
        const c = p.category(t.cat);
        if (c) dot.style.backgroundColor = `#${c.hex}`; else dot.addClass("is-none");
        li.createSpan({ text: t.text });
      }
    } else card.createDiv({ cls: "tmp-card-note", text: "적은 할 일이 없어요." });
    if (r.comment.trim()) card.createDiv({ cls: "tmp-card-comment", text: r.comment });

    const actions = card.createDiv({ cls: "tmp-card-actions" });
    for (const [label, kind] of [["일간 열기", "daily"], ["주간 열기", "weekly"]] as const) {
      const b = actions.createEl("button", { text: label });
      b.onclick = () => void this.plugin.openAt(book.id, d, kind);
    }
  }
}
