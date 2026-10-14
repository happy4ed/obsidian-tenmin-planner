(async () => {
  const out = {}, wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const q = (s) => document.querySelector(s);
  document.querySelectorAll('.status-bar').forEach((e) => e.remove());
  window.dispatchEvent(new Event('resize')); await wait(150);
  out.noBar = q('.tmp-toolbar').style.paddingBottom || '(css)';
  // 폰처럼 아래에 떠 있는 내비게이션 바 (이름 있는 것)
  const nb = document.createElement('div');
  nb.className = 'mobile-navbar';
  Object.assign(nb.style, { position: 'fixed', left: '50px', right: '50px', bottom: '12px', height: '58px', background: '#fff', borderRadius: '29px', zIndex: 50, boxShadow: '0 2px 8px #0003' });
  document.body.appendChild(nb);
  window.dispatchEvent(new Event('resize')); await wait(150);
  const tb = q('.tmp-toolbar').getBoundingClientRect(), nr = nb.getBoundingClientRect();
  const lastBtn = [...q('.tmp-toolbar').querySelectorAll('button, .tmp-colors')].reduce((m, b) => Math.max(m, b.getBoundingClientRect().bottom), 0);
  out.named = { pad: q('.tmp-toolbar').style.paddingBottom, lastContentBottom: Math.round(lastBtn), navTop: Math.round(nr.top), clear: lastBtn <= nr.top };
  // 이름 모르는 떠 있는 바
  nb.className = 'some-floating-thing';
  window.dispatchEvent(new Event('resize')); await wait(150);
  const lastBtn2 = [...q('.tmp-toolbar').querySelectorAll('button, .tmp-colors')].reduce((m, b) => Math.max(m, b.getBoundingClientRect().bottom), 0);
  out.unnamed = { pad: q('.tmp-toolbar').style.paddingBottom, clear: lastBtn2 <= nr.top };
  // 화면 전체 모달 바탕은 바로 치지 않는다
  nb.remove();
  const bg = document.createElement('div');
  Object.assign(bg.style, { position: 'fixed', inset: '0', background: '#0004', zIndex: 60 });
  document.body.appendChild(bg);
  window.dispatchEvent(new Event('resize')); await wait(150);
  out.modalPad = q('.tmp-toolbar').style.paddingBottom || '(css)';
  bg.remove();
  window.__out = out;
})().catch((e) => { (window.__out = window.__out || {}).error = String(e.stack || e); });
