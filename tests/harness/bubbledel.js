(async () => {
  const P = window.__plugin, out = {}, wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const q = (s) => document.querySelector(s), qa = (s) => [...document.querySelectorAll(s)];
  const today = new Date();
  const tt = () => q('.tmp-timetable');
  const at = (col, row) => { const r = tt().getBoundingClientRect(), cw = r.width / 6, rh = r.height / 24; return { clientX: r.left + (col + 0.5) * cw, clientY: r.top + (row + 0.5) * rh }; };
  const pe = (type, col, row, target) => (target || tt()).dispatchEvent(new PointerEvent(type, { bubbles: true, isPrimary: true, pointerId: 1, button: 0, ...at(col, row) }));
  pe('pointerdown', 0, 8); pe('pointermove', 3, 8); pe('pointerup', 3, 8); await wait(80);
  out.before = P.planner.day(today).events.length;
  out.buttons = qa('.tmp-bubble-actions button').map((b) => [b.textContent, Math.round(b.getBoundingClientRect().width)]);
  qa('.tmp-bubble-actions button').find((b) => b.textContent === '삭제').click(); await wait(80);
  out.after = P.planner.day(today).events.length;
  out.bubbleGone = !q('.tmp-bubble');
  window.__out = out;
})().catch((e) => { (window.__out = window.__out || {}).error = String(e.stack || e); });
