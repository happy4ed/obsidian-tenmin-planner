(async () => {
  const P = window.__plugin, out = {}, wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const q = (s) => document.querySelector(s), qa = (s) => [...document.querySelectorAll(s)];
  const today = new Date();
  const tt = () => q('.tmp-timetable');
  const at = (col, row) => { const r = tt().getBoundingClientRect(), cw = r.width / 6, rh = r.height / 24; return { clientX: r.left + (col + 0.5) * cw, clientY: r.top + (row + 0.5) * rh }; };
  const pe = (type, col, row, target) => (target || tt()).dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, button: 0, ...at(col, row) }));
  // 미팅 펜(1) 로 9:00–9:30, 9:30–10:00 두 번 끌기
  qa('.tmp-pen')[1].click(); await wait(60);
  pe('pointerdown', 0, 3); pe('pointermove', 2, 3); pe('pointerup', 2, 3); await wait(80);
  pe('pointerdown', 3, 3); pe('pointermove', 5, 3); pe('pointerup', 5, 3); await wait(80);
  out.events = P.planner.day(today).events.map((e) => [e.from, e.to, e.cat]);
  out.firstMarks = qa('.tmp-ev.is-first').length;
  out.total = q('.tmp-total').textContent;
  // 첫 일정 누르기 → 선택 · 핸들 · 말풍선
  const ev0 = qa('.tmp-ev')[0];
  pe('pointerdown', 1, 3, ev0); pe('pointerup', 1, 3, ev0); await wait(80);
  out.handles = qa('.tmp-handle').length;
  out.bubble = q('.tmp-bubble')?.textContent;
  out.bubbleFont = q('.tmp-bubble') && getComputedStyle(q('.tmp-bubble')).fontSize;
  // 끝 핸들 끌어 9:50 까지 (겹치게)
  const h = qa('.tmp-handle')[1];
  pe('pointerdown', 2, 3, h); pe('pointermove', 4, 3); pe('pointerup', 4, 3); await wait(80);
  out.afterHandle = P.planner.day(today).events.map((e) => [e.from, e.to]);
  // 편집 팝업: 제목 · 장소
  const ev0b = qa('.tmp-ev')[0];
  pe('pointerdown', 1, 3, ev0b); pe('pointerup', 1, 3, ev0b); await wait(80);
  if (!q('.tmp-bubble button')) { pe('pointerdown', 1, 3, qa('.tmp-ev')[0]); pe('pointerup', 1, 3, qa('.tmp-ev')[0]); await wait(80); }
  q('.tmp-bubble button').click(); await wait(80);
  const m = qa('.stub-modal').pop();
  const inputs = [...m.querySelectorAll('input')];
  inputs[0].value = 'A 미팅'; inputs[0].dispatchEvent(new Event('input'));
  inputs[1].value = '3층 회의실'; inputs[1].dispatchEvent(new Event('input'));
  m.querySelector('textarea').value = '안건: 일정 정리'; m.querySelector('textarea').dispatchEvent(new Event('input'));
  q('.stub-close').click(); await wait(80);
  out.saved = P.planner.day(today).events.map((e) => [e.title, e.place, e.note]);
  out.titleOnBar = q('.tmp-ev-title')?.textContent;
  // 지우개로 9:10 지우기 → A 미팅 둘로
  qa('.tmp-pen').find((b) => b.textContent.includes('지우개')).click(); await wait(60);
  pe('pointerdown', 1, 3); pe('pointerup', 1, 3); await wait(80);
  out.afterErase = P.planner.day(today).events.map((e) => [e.from, e.to, e.title]);
  out.total2 = q('.tmp-total').textContent;
  window.__out = out;
})().catch((e) => { (window.__out = window.__out || {}).error = String(e.stack || e); });
