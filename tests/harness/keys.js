(async () => {
  const P = window.__plugin, out = {}, wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const root = document.querySelector('.tmp-root'); root.focus();
  const key = (k, code) => root.dispatchEvent(new KeyboardEvent('keydown', { key: k, code: code || '', bubbles: true }));
  key('ArrowRight'); await wait(30); out.afterRight = document.querySelector('.tmp-nav-date').textContent;
  key('ArrowLeft'); key('ArrowLeft'); await wait(30); out.afterLeft2 = document.querySelector('.tmp-nav-date').textContent;
  key('t'); await wait(30); out.today = document.querySelector('.tmp-nav-date').textContent;
  key('ㄷ'); await wait(30); out.eraser = document.querySelector('.tmp-pen.is-active').textContent;
  key('3', 'Digit3'); await wait(30); out.pen3 = document.querySelector('.tmp-pen.is-active').textContent;
  // 책 시작일(10-01) 앞으로는 못 간다
  for (let i = 0; i < 40; i++) key('ArrowLeft');
  await wait(30); out.clampStart = document.querySelector('.tmp-nav-date').textContent;
  await P.flush();
  out.files = [...P.files.keys()];
  window.__out = out;
})();
