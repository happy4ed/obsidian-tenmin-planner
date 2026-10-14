# 10분 플래너 (Obsidian 플러그인)

10분 단위 종이 플래너를 Obsidian 안에서 씁니다. 일간 · 주간 · 홈, 형광펜 타임테이블, ○ △ × → 체크와 다음 날로 미루기.

## 저장
저장소(vault) 안 `Planner/` 폴더에 `library.json` 과 `books/<ID>.json` 으로 저장합니다.
Spiralday 1.1.0 계열과 같은 JSON 형식이라 Obsidian Sync · iCloud 로 기기끼리 맞춰집니다.
쓰기는 임시 파일에 다 쓴 뒤 바꿔치기하고, 읽지 못한 파일은 원본을 두고 사본을 남깁니다.

## 진행
- [x] M0 데이터 계층 — 형식 읽기/쓰기, 할 일 줄 배치, → 미루기(UUIDv5 사본 id), D-day, TOTAL TIME, 끌어 칠하기, 1.0.2 파일 옮기기
- [ ] M1 일간 화면 — 양식 · 체크 · 형광펜 칠하기
- [ ] M2 주간 · 홈
- [ ] M3 손글씨 메모 · 밥시간 · 컬러 · 표지
- [ ] M4 PDF
- 보류: 페이지 말림, 별도 동기화

## 개발
```bash
npm install
npm test          # vitest
npm run build     # main.js
```
시험 저장소의 `.obsidian/plugins/tenmin-planner/` 에 `main.js` · `manifest.json` 을 넣고 켭니다.

라이선스: MIT. 참고한 원본 고지는 [NOTICE.md](NOTICE.md).
