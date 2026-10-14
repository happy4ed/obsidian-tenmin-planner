(async () => {
  const P = window.__plugin, out = {}, wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const q = (s) => document.querySelector(s), qa = (s) => [...document.querySelectorAll(s)];
  qa('.tmp-kinds button').find((b) => b.textContent === '주간').click(); await wait(80);
  const col = qa('.tmp-wk-col').find((c) => !c.querySelector('.tmp-wk-locked') && c.querySelector('.tmp-hit'));
  const idx = qa('.tmp-wk-col').indexOf(col);
  col.querySelector('.tmp-hit').click(); await wait(80);
  let inp = q('input.tmp-editor');
  inp.value = 'A'; inp.dispatchEvent(new Event('input', { bubbles: true })); await wait(80);
  inp = q('input.tmp-editor');
  inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await wait(80);
  const ws = new Date(); const mon = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() - ((ws.getDay() + 6) % 7) + idx);
  out.idx = idx; out.tasks = P.planner.day(mon).tasks.map((t) => [t.text, t.row]);
  out.inputs = qa('input.tmp-editor').length; out.active = document.activeElement.tagName;
  window.__out = out;
})().catch((e) => { window.__out = { error: String(e.stack || e) }; });
