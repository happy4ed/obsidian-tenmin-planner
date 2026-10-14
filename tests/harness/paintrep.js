(async () => {
  const P = window.__plugin, out = {}, wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const q = (s) => document.querySelector(s), qa = (s) => [...document.querySelectorAll(s)];
  const today = new Date();
  // 9:00~10:30 칠하기 (집중 업무)
  const tt = q('.tmp-timetable'), r = tt.getBoundingClientRect(), cw = r.width / 6, rh = r.height / 24;
  const pe = (type, col, row) => tt.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, button: 0, clientX: r.left + (col + 0.5) * cw, clientY: r.top + (row + 0.5) * rh }));
  pe('pointerdown', 0, 3); pe('pointermove', 2, 4); pe('pointerup', 2, 4); await wait(100);
  // 막대 우클릭 → 이 시간을 반복으로
  q('.tmp-bar').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 600, clientY: 400 })); await wait(80);
  const item = qa('.stub-menu button').find((b) => b.textContent.includes('이 시간을 반복으로'));
  out.menu = item.textContent;
  item.click(); await wait(100);
  let m = qa('.stub-modal').pop();
  out.prefill = [...m.querySelectorAll('select')].map((s) => s.options[s.selectedIndex]?.textContent);
  const freq = [...m.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === 'weekdays'));
  freq.value = 'weekly'; freq.dispatchEvent(new Event('change')); await wait(80);
  m = qa('.stub-modal').pop();
  out.preview = m.querySelector('.tmp-repeat-preview').textContent;
  [...m.querySelectorAll('button')].find((b) => b.textContent === '반복 만들기').click(); await wait(120);
  out.rule = P.planner.repeats.map((x) => [x.freq, x.paint, x.cat, x.text]);
  // 다음 주 같은 요일로 넘기면 칠해져 있다
  const root = q('.tmp-root');
  for (let i = 0; i < 7; i++) root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await wait(200);
  const nd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7);
  out.nextWeek = P.planner.day(nd).slots.slice(18, 27).join(',');
  window.__out = out;
})().catch((e) => { (window.__out = window.__out || {}).error = String(e.stack || e); });
