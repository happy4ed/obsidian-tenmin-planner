(async () => {
  const P = window.__plugin, today = new Date(); const out = {};
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const q = (s) => document.querySelector(s), qa = (s) => [...document.querySelectorAll(s)];
  // 할 일 2개
  q('.tmp-hit').click(); await wait(50);
  let ta = q('textarea'); ta.value = '기획서 초안'; ta.dispatchEvent(new Event('input', { bubbles: true })); await wait(30);
  ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await wait(50);
  ta = q('textarea'); ta.value = '팀 회의'; ta.dispatchEvent(new Event('input', { bubbles: true })); await wait(30);
  ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(50);
  // D-13 체크 순환: 첫 할 일 ○
  qa('.tmp-mark')[0].click(); await wait(30);
  // D-19 형광펜: 첫 할 일 → 기획(3)
  qa('.tmp-cat-cell')[0].dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 100, clientY: 300 })); await wait(30);
  qa('.stub-menu button').find((b) => b.textContent.includes('기획')).click(); await wait(30);
  out.highlight = !!qa('.tmp-line-text').find((s) => s.style.backgroundImage.includes('gradient'));
  out.tag = qa('.tmp-cat-tag').map((e) => e.textContent);
  // D-14 미룸: 둘째 할 일 → 4번 눌러 →
  for (let i = 0; i < 4; i++) { qa('.tmp-mark')[1].click(); await wait(20); }
  const next = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  out.carried = P.planner.day(next).tasks.map((t) => [t.text, t.mark]);
  // D-22 칠하기: 집중 업무(0) 로 6시 첫 칸 → 7시 셋째 칸
  const tt = q('.tmp-timetable'), r = tt.getBoundingClientRect(), cw = r.width / 6, rh = r.height / 24;
  const pe = (type, col, row) => tt.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, button: 0, clientX: r.left + (col + 0.5) * cw, clientY: r.top + (row + 0.5) * rh }));
  pe('pointerdown', 0, 0); await wait(10); pe('pointermove', 5, 0); await wait(10); pe('pointermove', 2, 1); await wait(10); pe('pointerup', 2, 1); await wait(30);
  out.painted = P.planner.day(today).slots.slice(0, 12).join(',');
  out.total = q('.tmp-total').textContent;
  // 같은 색에서 다시 시작하면 지우기
  pe('pointerdown', 1, 0); await wait(10); pe('pointermove', 1, 0); pe('pointerup', 1, 0); await wait(30);
  out.erasedOne = P.planner.day(today).slots.slice(0, 3).join(',');
  // D-04 COMMENT
  q('.tmp-comment-view').click(); await wait(30);
  ta = q('textarea.tmp-comment'); ta.value = '좋은 하루'; ta.dispatchEvent(new Event('input', { bubbles: true }));
  ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await wait(30);
  out.comment = P.planner.day(today).comment;
  // D-26 MEMO: 빈 메모 칸
  const memoHits = qa('.tmp-hit').filter((h) => parseFloat(h.style.top) > 1660 && parseFloat(h.style.left) > 190);
  memoHits[0].click(); await wait(30);
  ta = q('textarea'); ta.value = '내일 자료 챙기기'; ta.dispatchEvent(new Event('input', { bubbles: true }));
  ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(30);
  out.memos = P.planner.day(today).memos;
  // D-05 DAY OFF
  q('.tmp-comment-menu').dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 200, clientY: 200 })); await wait(20);
  qa('.stub-menu button').find((b) => b.textContent.includes('DAY OFF')).click(); await wait(30);
  out.dayoff = !!q('.tmp-dayoff') && P.planner.day(today).comment === '좋은 하루';
  // D-03 D-day
  q('.tmp-dday').click(); await wait(30);
  const inputs = qa('.stub-modal input'); const title = inputs.find((i) => i.placeholder.startsWith('무엇까지? (예'));
  title.value = '런칭'; title.dispatchEvent(new Event('input'));
  qa('.stub-modal button').find((b) => b.textContent === '붙이기').click(); await wait(30);
  q('.stub-close').click(); await wait(30);
  out.dday = q('.tmp-dday').textContent;
  window.__out = out;
})();
