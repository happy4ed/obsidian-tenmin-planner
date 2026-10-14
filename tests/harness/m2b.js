(async () => {
  const out = window.__out, wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const q = (s) => document.querySelector(s), qa = (s) => [...document.querySelectorAll(s)];
  // W-04 날짜 머리 → 일간
  const col = qa('.tmp-wk-col').find((c) => !c.querySelector('.tmp-wk-locked'));
  col.querySelector('.tmp-wk-date').click(); await wait(80);
  out.toDaily = qa('.tmp-kinds button.is-active')[0].textContent + ' ' + q('.tmp-nav-date').textContent;
  // H 홈
  q('.tmp-root').dispatchEvent(new KeyboardEvent('keydown', { key: 'ㅗ', bubbles: true })); await wait(60);
  out.homeCards = qa('.tmp-card h4').map((h) => h.textContent);
  out.summary = qa('.tmp-sum b').map((b) => b.textContent);
  out.lastKind = window.__plugin.planner.data.prefs.lastKind;
})().catch((e) => { (window.__out = window.__out || {}).error = String(e.stack || e); });
