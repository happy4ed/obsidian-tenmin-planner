(async () => {
  const P = window.__plugin, out = {}, wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const q = (s) => document.querySelector(s), qa = (s) => [...document.querySelectorAll(s)];
  const today = new Date();
  const tt = () => q('.tmp-timetable');
  const at = (col, row) => { const r = tt().getBoundingClientRect(), cw = r.width / 6, rh = r.height / 24; return { clientX: r.left + (col + 0.5) * cw, clientY: r.top + (row + 0.5) * rh }; };
  const pe = (type, col, row, target) => (target || tt()).dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, button: 0, ...at(col, row) }));
  pe('pointerdown', 0, 3); pe('pointermove', 2, 3); pe('pointerup', 2, 3); await wait(80);
  out.before = P.planner.day(today).events.length;
  // 선택돼 있다 (방금 만든 일정) → Delete
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true })); await wait(80);
  out.afterDelete = P.planner.day(today).events.length;
  // 다시 만들고 클릭 선택 → Backspace
  pe('pointerdown', 0, 5); pe('pointermove', 1, 5); pe('pointerup', 1, 5); await wait(80);
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  const e = q('.tmp-ev'); pe('pointerdown', 0, 5, e); pe('pointerup', 0, 5, e); await wait(60);
  if (!q('.tmp-handle')) { pe('pointerdown', 0, 5, q('.tmp-ev')); pe('pointerup', 0, 5, q('.tmp-ev')); await wait(60); }
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true })); await wait(80);
  out.afterBackspace = P.planner.day(today).events.length;
  // 밥: 12시 누르기 → 아이콘 오른쪽 클릭 → 평일 반복
  qa('.tmp-pen').find((b) => b.textContent.includes('밥')).click(); await wait(60);
  pe('pointerdown', 0, 6); pe('pointerup', 0, 6); await wait(80);
  q('.tmp-meal-icon').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 500, clientY: 400 })); await wait(60);
  out.mealMenu = qa('.stub-menu button').map((b) => b.textContent);
  qa('.stub-menu button').find((b) => b.textContent.startsWith('평일')).click(); await wait(100);
  out.rule = P.planner.repeats.map((r) => [r.freq, r.weekdays, r.meal]);
  // 자세히 창: 주마다 요일 고르기 · 적용 · 밥시간 칸이 있다
  qa('.tmp-nav button').find((b) => b.textContent.includes('반복')).click(); await wait(80);
  qa('.stub-modal button').find((b) => b.textContent === '새 반복').click(); await wait(80);
  const m = qa('.stub-modal').pop();
  out.modalNames = [...m.querySelectorAll('.stub-setting > span:first-child')].map((s) => s.textContent).filter(Boolean);
  out.freqOptions = [...[...m.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === 'weekdays')).options].map((o) => o.textContent);
  window.__out = out;
})().catch((e) => { (window.__out = window.__out || {}).error = String(e.stack || e); });
