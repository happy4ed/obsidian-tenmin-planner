// 브라우저 확인용 Obsidian 대역. 플러그인이 쓰는 API 만 흉내 낸다 (실제 Obsidian 동작 보증 아님).
type Fn = (...a: any[]) => any;

const proto = HTMLElement.prototype as any;
proto.createEl = function (tag: string, o?: { text?: string; cls?: string }) {
  const el = document.createElement(tag);
  if (o?.text) el.textContent = o.text;
  if (o?.cls) el.className = o.cls;
  this.appendChild(el);
  return el;
};
proto.empty = function () { this.innerHTML = ""; };
proto.setText = function (t: string) { this.textContent = t; };
proto.addClass = function (c: string) { this.classList.add(c); };
proto.toggleClass = function (c: string, on: boolean) { this.classList.toggle(c, on); };
proto.createDiv = function (o?: { text?: string; cls?: string }) { return this.createEl("div", o); };
proto.createSpan = function (o?: { text?: string; cls?: string }) { return this.createEl("span", o); };
proto.getText = function () { return this.textContent ?? ""; };

export class Notice {
  constructor(msg: string) {
    const d = document.createElement("div");
    d.className = "stub-notice";
    d.textContent = msg;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 4000);
  }
}

class MenuItem {
  title = ""; checked = false; disabled = false; cb: Fn | null = null;
  setTitle(t: string) { this.title = t; return this; }
  setChecked(c: boolean) { this.checked = c; return this; }
  setIcon() { return this; }
  setDisabled(d: boolean) { this.disabled = d; return this; }
  onClick(cb: Fn) { this.cb = cb; return this; }
}

export class Menu {
  items: (MenuItem | "sep")[] = [];
  addItem(f: (it: MenuItem) => void) { const it = new MenuItem(); f(it); this.items.push(it); return this; }
  addSeparator() { this.items.push("sep"); return this; }
  showAtMouseEvent(e: MouseEvent) {
    document.querySelectorAll(".stub-menu").forEach((m) => m.remove());
    const m = document.createElement("div");
    m.className = "stub-menu";
    m.style.left = `${e.clientX}px`; m.style.top = `${e.clientY}px`;
    for (const it of this.items) {
      if (it === "sep") { m.appendChild(document.createElement("hr")); continue; }
      const b = document.createElement("button");
      b.textContent = (it.checked ? "✓ " : "") + it.title;
      b.disabled = it.disabled;
      b.onclick = () => { m.remove(); it.cb?.(new MouseEvent("click")); };
      m.appendChild(b);
    }
    document.body.appendChild(m);
    setTimeout(() => document.addEventListener("pointerdown", function off(ev) {
      if (!m.contains(ev.target as Node)) { m.remove(); document.removeEventListener("pointerdown", off); }
    }), 0);
  }
}

export class Modal {
  app: any; modalEl = document.createElement("div"); titleEl = document.createElement("h3"); contentEl = document.createElement("div");
  constructor(app: any) {
    this.app = app;
    this.modalEl.className = "stub-modal";
    const x = document.createElement("button"); x.textContent = "닫기"; x.className = "stub-close"; x.onclick = () => this.close();
    this.modalEl.append(x, this.titleEl, this.contentEl);
  }
  open() { document.body.appendChild(this.modalEl); (this as any).onOpen?.(); }
  close() { (this as any).onClose?.(); this.modalEl.remove(); }
}

class Comp { constructor(public el: HTMLElement) {} }
class TextC extends Comp {
  inputEl = document.createElement("input");
  constructor(p: HTMLElement) { super(p); p.appendChild(this.inputEl); }
  setPlaceholder(v: string) { this.inputEl.placeholder = v; return this; }
  setValue(v: string) { this.inputEl.value = v; return this; }
  onChange(f: Fn) { this.inputEl.oninput = () => f(this.inputEl.value); return this; }
}
class DropdownC extends Comp {
  selectEl = document.createElement("select");
  constructor(p: HTMLElement) { super(p); p.appendChild(this.selectEl); }
  addOption(v: string, t: string) { const o = document.createElement("option"); o.value = v; o.textContent = t; this.selectEl.appendChild(o); return this; }
  addOptions(m: Record<string, string>) { for (const [k, v] of Object.entries(m)) this.addOption(k, v); return this; }
  setValue(v: string) { this.selectEl.value = v; return this; }
  onChange(f: Fn) { this.selectEl.onchange = () => f(this.selectEl.value); return this; }
}
class ToggleC extends Comp {
  inputEl = document.createElement("input");
  constructor(p: HTMLElement) { super(p); this.inputEl.type = "checkbox"; p.appendChild(this.inputEl); }
  setValue(v: boolean) { this.inputEl.checked = v; return this; }
  setTooltip(t: string) { this.inputEl.title = t; return this; }
  onChange(f: Fn) { this.inputEl.onchange = () => f(this.inputEl.checked); return this; }
}
class ButtonC extends Comp {
  buttonEl = document.createElement("button");
  constructor(p: HTMLElement) { super(p); p.appendChild(this.buttonEl); }
  setButtonText(t: string) { this.buttonEl.textContent = t; return this; }
  setCta() { return this; }
  setWarning() { return this; }
  setIcon(i: string) { this.buttonEl.textContent = i === "minus-circle" ? "−" : i; return this; }
  setTooltip(t: string) { this.buttonEl.title = t; return this; }
  setDisabled(d: boolean) { this.buttonEl.disabled = d; return this; }
  onClick(f: Fn) { this.buttonEl.onclick = () => f(); return this; }
}
class ColorC extends TextC { constructor(p: HTMLElement) { super(p); this.inputEl.type = "color"; } }

export class Setting {
  settingEl = document.createElement("div"); nameEl = document.createElement("span"); descEl = document.createElement("small");
  controlEl = document.createElement("span");
  constructor(parent: HTMLElement) {
    this.settingEl.className = "stub-setting";
    this.settingEl.append(this.nameEl, this.descEl, this.controlEl);
    parent.appendChild(this.settingEl);
  }
  setName(n: string) { this.nameEl.textContent = n; return this; }
  setDesc(d: string) { this.descEl.textContent = d; return this; }
  addText(f: Fn) { f(new TextC(this.controlEl)); return this; }
  addToggle(f: Fn) { f(new ToggleC(this.controlEl)); return this; }
  addButton(f: Fn) { f(new ButtonC(this.controlEl)); return this; }
  addExtraButton(f: Fn) { f(new ButtonC(this.controlEl)); return this; }
  addColorPicker(f: Fn) { f(new ColorC(this.controlEl)); return this; }
  addDropdown(f: Fn) { f(new DropdownC(this.controlEl)); return this; }
  setHeading() { this.settingEl.classList.add("stub-heading"); return this; }
}

export class ItemView {
  contentEl = document.createElement("div");
  constructor(public leaf: any) { document.getElementById("app")!.appendChild(this.contentEl); }
}

export class Plugin {}
export class TFile {}
export class PluginSettingTab {}
export const normalizePath = (p: string) => p;
export type App = any;
export type WorkspaceLeaf = any;
export type TAbstractFile = any;
