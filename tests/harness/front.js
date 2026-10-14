(async () => {
  const P = window.__plugin, out = {}, wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const q = (s) => document.querySelector(s), qa = (s) => [...document.querySelectorAll(s)];
  const root = q('.tmp-root'); const key = (k) => root.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
  // 책 시작일(10-01)로 → ← 두 번: 첫 장 → 표지
  for (let i = 0; i < 20; i++) key('ArrowLeft');
  await wait(80); out.first = q('.tmp-nav-date').textContent;
  key('ArrowLeft'); await wait(80); out.motto = q('.tmp-nav-date').textContent + ' ' + !!q('.tmp-motto-view');
  key('ArrowLeft'); await wait(80); out.cover = q('.tmp-nav-date').textContent + ' ' + (q('.tmp-cover-name')?.textContent ?? '');
  key('ArrowLeft'); await wait(80); out.stillCover = q('.tmp-nav-date').textContent;
  out.ddayDisabled = qa('.tmp-nav button').find((b) => b.textContent === 'D-day').disabled;
  out.colorsDisabled = q('.tmp-colors').classList.contains('is-disabled');
  // 주간으로 바꿔도 표지 유지
  qa('.tmp-kinds button').find((b) => b.textContent === '주간').click(); await wait(80);
  out.weeklyCover = q('.tmp-nav-date').textContent + ' ' + !!q('.tmp-cover-name');
  key('ArrowRight'); await wait(80);
  // 첫 장에 말 쓰기
  q('.tmp-motto-view').click(); await wait(80);
  const ta = q('textarea.tmp-motto'); ta.value = '하루 10분이라도 기록하기'; ta.dispatchEvent(new Event('input', { bubbles: true })); await wait(60);
  q('textarea.tmp-motto').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await wait(60);
  out.mottoSaved = P.planner.data.prefs.motto;
  key('ArrowRight'); await wait(80); out.firstWeek = q('.tmp-nav-date').textContent;
  key('t'); await wait(80); out.today = q('.tmp-nav-date').textContent;
  window.__out = out;
})().catch((e) => { (window.__out = window.__out || {}).error = String(e.stack || e); });
