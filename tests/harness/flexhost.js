// Obsidian 처럼 뷰를 flex 줄 안에 넣었을 때 배율이 폰 폭을 따르는지
(async () => {
  const app = document.getElementById('app');
  app.style.display = 'flex';
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  window.dispatchEvent(new Event('resize'));
  await wait(300);
  const sheet = document.querySelector('.tmp-sheet');
  window.__out = { viewport: innerWidth, sheetWidth: sheet.getBoundingClientRect().width, scrollerWidth: document.querySelector('.tmp-scroller').clientWidth };
})();
