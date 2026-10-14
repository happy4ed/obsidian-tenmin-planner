(async () => {
  const P = window.__plugin, out = {}, wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const q = (s) => document.querySelector(s), qa = (s) => [...document.querySelectorAll(s)];
  const today = new Date();
  q('.tmp-hit').click(); await wait(80);
  let ta = q('textarea'); ta.value = '주간 보고'; ta.dispatchEvent(new Event('input', { bubbles: true })); await wait(60);
  q('textarea').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(80);
  qa('.tmp-entry').find((e) => e.textContent.includes('주간 보고')).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 200, clientY: 300 })); await wait(60);
  out.taskMenu = qa('.stub-menu button').map((b) => b.textContent).filter((t) => t.includes('반복'));
  qa('.stub-menu button').find((b) => b.textContent.startsWith('매주')).click(); await wait(120);
  out.rule1 = P.planner.repeats.map((r) => [r.freq, r.text]);
  out.todayCount = P.planner.day(today).tasks.filter((t) => t.text === '주간 보고').length;
  // 칠한 막대 → 매월
  const tt = q('.tmp-timetable'), r = tt.getBoundingClientRect(), cw = r.width / 6, rh = r.height / 24;
  const pe = (type, col, row) => tt.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, button: 0, clientX: r.left + (col + 0.5) * cw, clientY: r.top + (row + 0.5) * rh }));
  pe('pointerdown', 0, 8); pe('pointermove', 2, 8); pe('pointerup', 2, 8); await wait(100);
  q('.tmp-bar').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 600, clientY: 400 })); await wait(60);
  out.barMenu = qa('.stub-menu button').map((b) => b.textContent);
  qa('.stub-menu button').find((b) => b.textContent.startsWith('매월')).click(); await wait(120);
  out.rule2 = P.planner.repeats.map((x) => [x.freq, x.monthly, x.paint]);
  out.notice = qa('.stub-notice').map((n) => n.textContent);
  window.__out = out;
})().catch((e) => { (window.__out = window.__out || {}).error = String(e.stack || e); });
