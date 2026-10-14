(async () => {
  const P = window.__plugin, out = {}, wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const q = (s) => document.querySelector(s), qa = (s) => [...document.querySelectorAll(s)];
  const today = new Date();
  const sc = () => q('.tmp-scroller');
  const pct = () => q('.tmp-zoom-pct')?.textContent;
  const T = (id, x, y) => new Touch({ identifier: id, target: sc(), clientX: x, clientY: y });
  const te = (type, list, target) => (target || sc()).dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: list, changedTouches: list }));
  // 두 손가락을 cx,cy 둘레에서 d0 → d1 로 벌린다
  const pinch = async (cx, cy, d0, d1, target) => {
    te('touchstart', [T(1, cx - d0 / 2, cy), T(2, cx + d0 / 2, cy)], target);
    for (let k = 1; k <= 5; k++) { const d = d0 + (d1 - d0) * k / 5; te('touchmove', [T(1, cx - d / 2, cy), T(2, cx + d / 2, cy)], target); await wait(16); }
    out.midTransform = (sc().firstElementChild.style.transform || '').slice(0, 60);
    te('touchend', [], target); await wait(120);
  };
  const r = sc().getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  out.daily0 = pct();
  const sheet0 = q('.tmp-sheet').getBoundingClientRect();
  // 손가락 밑 종이 위치 (비율)
  const fx0 = (cx - sheet0.left) / sheet0.width, fy0 = (cy - sheet0.top) / sheet0.height;
  await pinch(cx, cy, 100, 200);
  out.daily1 = pct();
  const sheet1 = q('.tmp-sheet').getBoundingClientRect();
  out.anchorDrift = [((cx - sheet1.left) / sheet1.width - fx0).toFixed(3), ((cy - sheet1.top) / sheet1.height - fy0).toFixed(3)];
  out.transformCleared = q('.tmp-sheet').style.transform === '';
  await pinch(cx, cy, 200, 100);
  out.daily2 = pct();
  // 타임테이블 위에서 한 손가락 끌다가 두 번째 손가락 → 일정이 생기지 않는다
  const tt = q('.tmp-timetable'); tt.scrollIntoView();
  await wait(60);
  const tr = tt.getBoundingClientRect();
  const before = P.planner.day(today).events.length;
  const pe = (type, x, y, prim = true, id = 1) => tt.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: id, isPrimary: prim, button: 0, clientX: x, clientY: y, pointerType: 'touch' }));
  const x0 = tr.left + tr.width * 0.1, y0 = tr.top + tr.height * 0.2;
  pe('pointerdown', x0, y0); pe('pointermove', x0 + 30, y0);
  pe('pointerdown', x0 + 80, y0, false, 2);
  te('touchstart', [new Touch({ identifier: 1, target: tt, clientX: x0 + 30, clientY: y0 }), new Touch({ identifier: 2, target: tt, clientX: x0 + 80, clientY: y0 })], tt);
  te('touchmove', [new Touch({ identifier: 1, target: tt, clientX: x0, clientY: y0 }), new Touch({ identifier: 2, target: tt, clientX: x0 + 140, clientY: y0 })], tt);
  pe('pointermove', x0 + 140, y0, false, 2); pe('pointerup', x0 + 140, y0, false, 2);
  te('touchend', [], tt);
  pe('pointerup', x0, y0); await wait(120);
  out.eventsAdded = P.planner.day(today).events.length - before;
  out.dailyAfterTT = pct();
  // 홈
  qa('.tmp-kinds button, .tmp-nav button').find((b) => b.textContent.trim() === '홈')?.click(); await wait(150);
  out.home0 = pct();
  const r2 = sc().getBoundingClientRect();
  await pinch(r2.left + r2.width / 2, r2.top + 200, 100, 150);
  out.home1 = pct();
  out.homeZoom = q('.tmp-home-zoom').style.zoom;
  await pinch(r2.left + r2.width / 2, r2.top + 200, 150, 10);
  out.homeMin = pct();
  window.__out = out;
})().catch((e) => { (window.__out = window.__out || {}).error = String(e.stack || e); });
