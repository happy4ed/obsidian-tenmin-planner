(async () => {
  const P = window.__plugin, out = {}, wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const q = (s) => document.querySelector(s), qa = (s) => [...document.querySelectorAll(s)];
  const today = new Date(); const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  // ↻ 반복 → 새 반복 → 요일마다 (오늘 요일 + 다음날 요일)
  qa('.tmp-nav button').find((b) => b.textContent.includes('반복')).click(); await wait(80);
  qa('.stub-modal button').find((b) => b.textContent === '새 반복').click(); await wait(80);
  let m = qa('.stub-modal').pop();
  const txt = [...m.querySelectorAll('input')].find((i) => i.placeholder.startsWith('예:')); txt.value = '운동 30분'; txt.dispatchEvent(new Event('input'));
  const freq = [...m.querySelectorAll('select')][1]; freq.value = 'weekdays'; freq.dispatchEvent(new Event('change')); await wait(80);
  m = qa('.stub-modal').pop();
  const wdIdx = (today.getDay() + 6) % 7, next = (wdIdx + 1) % 7;
  [...m.querySelectorAll('.tmp-wd-pick')][next].click(); await wait(30);
  out.preview = m.querySelector('.tmp-repeat-preview').textContent;
  [...m.querySelectorAll('button')].find((b) => b.textContent === '반복 만들기').click(); await wait(120);
  out.rules = P.planner.repeats.map((r) => [r.text, r.freq, r.weekdays]);
  qa('.stub-close').forEach((b) => b.click()); await wait(120);
  out.todayTasks = P.planner.day(today).tasks.map((t) => t.text);
  // 주간: 7일 중 두 요일에 생긴다
  qa('.tmp-kinds button').find((b) => b.textContent === '주간').click(); await wait(200);
  const ws = new Date(today.getFullYear(), today.getMonth(), today.getDate() - wdIdx);
  out.weekHits = Array.from({ length: 7 }, (_, i) => new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + i))
    .filter((d) => P.planner.day(d).tasks.some((t) => t.text === '운동 30분')).length;
  // 그날 하나 지우기 → 반복은 그대로, 다시 안 생김
  const id = P.planner.day(today).tasks.find((t) => t.text === '운동 30분').id;
  P.planner.deleteTask(today, id); await wait(80);
  qa('.tmp-kinds button').find((b) => b.textContent === '일간').click(); await wait(200);
  out.afterDelete = { today: P.planner.day(today).tasks.length, rules: P.planner.repeats.length, ex: P.planner.repeats[0].exceptions };
  // 오른쪽 클릭 → 반복으로 만들기 (매일)
  q('.tmp-hit').click(); await wait(80);
  let ta = q('textarea'); ta.value = '물 마시기'; ta.dispatchEvent(new Event('input', { bubbles: true })); await wait(60);
  q('textarea').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(80);
  const line = qa('.tmp-entry').find((e) => e.textContent.includes('물 마시기'));
  line.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 200, clientY: 300 })); await wait(60);
  qa('.stub-menu button').find((b) => b.textContent.includes('반복으로 만들기')).click(); await wait(80);
  m = qa('.stub-modal').pop();
  [...m.querySelectorAll('button')].find((b) => b.textContent === '반복 만들기').click(); await wait(150);
  out.adopt = { todayWater: P.planner.day(today).tasks.filter((t) => t.text === '물 마시기').length, rules: P.planner.repeats.length };
  // PDF: 일간 반쪽 3일
  const t0 = performance.now();
  const buf = await window.__buildPdf(P.planner, P.wrap, { kind: 'daily', paper: 'half', from: today, to: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2), front: true, cutLine: true }, () => {});
  out.pdf = { bytes: buf.byteLength, head: String.fromCharCode(...new Uint8Array(buf.slice(0, 5))), ms: Math.round(performance.now() - t0) };
  window.__out = out;
  const u8 = new Uint8Array(buf); let bin = ''; for (let i = 0; i < u8.length; i += 8192) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
  window.__pdfB64 = btoa(bin);
})().catch((e) => { (window.__out = window.__out || {}).error = String(e.stack || e); });
