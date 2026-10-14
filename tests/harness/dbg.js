(async () => {
  const P = window.__plugin, out = {}, wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const q = (s) => document.querySelector(s), qa = (s) => [...document.querySelectorAll(s)];
  qa('.tmp-kinds button').find((b) => b.textContent === '주간').click(); await wait(60);
  const col = qa('.tmp-wk-col').find((c) => !c.querySelector('.tmp-wk-locked') && c.querySelector('.tmp-hit'));
  col.querySelector('.tmp-hit').click(); await wait(60);
  let inp = q('input.tmp-editor'); out.a = !!inp;
  inp.value = '주간에서 쓴 일'; inp.dispatchEvent(new Event('input', { bubbles: true })); await wait(60);
  inp = q('input.tmp-editor'); out.b = !!inp; out.val = inp && inp.value;
  inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await wait(60);
  inp = q('input.tmp-editor'); out.c = !!inp;
  out.err = window.__err;
  window.__out = out;
})().catch((e) => { window.__out = { error: String(e) }; });
