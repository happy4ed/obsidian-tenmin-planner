(async () => {
  const P = window.__plugin, out = {}, wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const q = (s) => document.querySelector(s), qa = (s) => [...document.querySelectorAll(s)];
  const today = new Date();
  // 오늘의 컬러: 민트
  qa('.tmp-color')[3].click(); await wait(80);
  out.dayTheme = P.planner.day(today).theme;
  out.totalColor = getComputedStyle(q('.tmp-total')).color;
  // 기본(체리)을 다시 누르면 따르기
  qa('.tmp-color')[0].click(); await wait(80);
  out.afterDefault = P.planner.day(today).theme;
  // 글씨 도구 → 9시 줄 둘째 칸 누르기 → 쓰기
  qa('.tmp-pen').find((b) => b.textContent.includes('글씨')).click(); await wait(80);
  const tt = q('.tmp-timetable'), r = tt.getBoundingClientRect(), cw = r.width / 6, rh = r.height / 24;
  const pe = (type, col, row) => tt.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, button: 0, clientX: r.left + (col + 0.5) * cw, clientY: r.top + (row + 0.5) * rh }));
  pe('pointerdown', 1, 3); pe('pointerup', 1, 3); await wait(100);
  let inp = q('input.tmp-note-edit'); out.noteEditor = !!inp;
  inp.value = '병원'; inp.dispatchEvent(new Event('input', { bubbles: true })); await wait(80);
  q('input.tmp-note-edit').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await wait(80);
  out.notes = P.planner.day(today).notes.map((n) => [n.kind, n.start, n.end, n.text]);
  // 빈 글씨 메모는 지워진다
  pe('pointerdown', 0, 10); pe('pointerup', 0, 10); await wait(100);
  q('input.tmp-note-edit').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(80);
  out.afterEmpty = P.planner.day(today).notes.length;
  // 밥: 12시 줄 누르기만 → 1시간
  qa('.tmp-pen').find((b) => b.textContent.includes('밥')).click(); await wait(80);
  pe('pointerdown', 0, 6); pe('pointerup', 0, 6); await wait(80);
  // 밥: 18시 줄 셋째 칸 → 19시 줄 둘째 칸 끌기
  pe('pointerdown', 2, 12); pe('pointermove', 1, 13); pe('pointerup', 1, 13); await wait(80);
  out.meals = P.planner.day(today).notes.filter((n) => n.kind === 'meal').map((n) => [n.start, n.end]);
  out.mealIcons = qa('.tmp-meal-icon').length;
  // 오른쪽 클릭 → 밥시간 지우기
  qa('.tmp-meal-icon')[0].dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 300, clientY: 300 })); await wait(60);
  qa('.stub-menu button').find((b) => b.textContent.includes('밥시간 지우기')).click(); await wait(80);
  out.mealsAfterDelete = P.planner.day(today).notes.filter((n) => n.kind === 'meal').length;
  // 주간에서도 기본 컬러 바꾸기
  qa('.tmp-kinds button').find((b) => b.textContent === '주간').click(); await wait(80);
  out.weekLabel = q('.tmp-colors-label').textContent;
  qa('.tmp-color')[4].click(); await wait(80);
  out.defaultTheme = P.planner.data.prefs.defaultTheme;
  qa('.tmp-kinds button').find((b) => b.textContent === '일간').click(); await wait(80);
  window.__out = out;
})().catch((e) => { (window.__out = window.__out || {}).error = String(e.stack || e); });
