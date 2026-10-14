(async () => {
  const P = window.__plugin, out = {}, wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const q = (s) => document.querySelector(s), qa = (s) => [...document.querySelectorAll(s)];
  const btn = (t) => qa('.tmp-kinds button').find((b) => b.textContent === t);
  // 지난 날 기록 몇 개 (통계용)
  const t0 = new Date(); const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  for (let i = 1; i <= 9; i++) { const d = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() - i); if (d < P.planner.book.start) continue; P.planner.editDay(d, (r) => { for (let k = 18; k < 18 + 6 + i * 2; k++) r.slots[k] = i % 3; }); }
  btn('주간').click(); await wait(60);
  out.weekly = !!q('.tmp-wk-col') && qa('.tmp-wk-col').length === 7;
  out.label = q('.tmp-nav-date').textContent;
  // W-05 빈 줄 → 할 일, W-07 Return → 다음 할 일
  const col = qa('.tmp-wk-col').find((c) => !c.querySelector('.tmp-wk-locked') && c.querySelector('.tmp-hit'));
  col.querySelector('.tmp-hit').click(); await wait(80);
  let inp = q('input.tmp-editor'); inp.value = '주간에서 쓴 일'; inp.dispatchEvent(new Event('input', { bubbles: true })); await wait(80);
  q('input.tmp-editor').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await wait(80);
  inp = q('input.tmp-editor'); out.secondEditor = !!inp;
  inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(80);
  out.tasksInCol = col.querySelectorAll('.tmp-wk-task').length;
  // W-08 체크
  col.querySelector('.tmp-mark').click(); await wait(80);
  // W-03 별 3개, 다시 3 → 0
  qa('.tmp-wk-stars button')[2].click(); await wait(60); out.stars = qa('.tmp-wk-stars button.is-on').length;
  // W-02 목표
  q('.tmp-wk-goal-view').click(); await wait(80); inp = q('input.tmp-wk-goal'); inp.value = '기획서 마감'; inp.dispatchEvent(new Event('input', { bubbles: true }));
  inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await wait(80);
  // W-11 주간 칠하기
  const tt = col.querySelector('.tmp-timetable'), r = tt.getBoundingClientRect();
  const pe = (type, cx, cy) => tt.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, button: 0, clientX: r.left + cx * r.width, clientY: r.top + cy * r.height }));
  pe('pointerdown', 0.05, 0.5); pe('pointermove', 0.95, 0.5); pe('pointerup', 0.95, 0.5); await wait(80);
  out.weekSum = col.querySelector('.tmp-wk-sum')?.textContent;
  // ← 지난주
  const root = q('.tmp-root'); root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })); await wait(80);
  out.prevWeek = q('.tmp-nav-date').textContent;
  root.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true })); await wait(80);
  window.__shotWeekly = true;
  window.__out = out;
})().catch((e) => { (window.__out = window.__out || {}).error = String(e.stack || e); });
