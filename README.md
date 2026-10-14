# 10분 플래너 (Obsidian 플러그인)

10분 단위 종이 플래너를 Obsidian 안에서 씁니다. 일간 · 주간 · 홈, 형광펜 타임테이블, ○ △ × → 체크와 다음 날로 미루기.

## 저장
저장소(vault) 안 `Planner/` 폴더에 `library.json` 과 `books/<ID>.json` 으로 저장합니다.
Spiralday 1.1.0 계열과 같은 JSON 형식이라 Obsidian Sync · iCloud 로 기기끼리 맞춰집니다.
쓰기는 임시 파일에 다 쓴 뒤 바꿔치기하고, 읽지 못한 파일은 원본을 두고 사본을 남깁니다.

## 진행
구현 체크리스트는 원본에서 뽑은 사용자 동작 목록 [docs/actions.md](docs/actions.md) (182개, ID 로 표기).

- [x] M0 데이터 계층 — 형식 읽기/쓰기, 할 일 줄 배치, → 미루기(UUIDv5 사본 id), D-day, TOTAL TIME, 끌어 칠하기, 1.0.2 파일 옮기기
- [x] M1 일간 화면 — 1차 필수 74개 중 아래를 구현
  - 일간: D-01~D-23, D-26 (D-24 글씨 메모 · D-25 밥시간은 원본 기록 표시만, 만들기는 2차)
  - 팔레트: P-01 책 메뉴 · 새 플래너, P-03 이전 · 다음, P-04 오늘, P-05 D-day, P-07 형광펜, P-08 이름 · 색 · TOTAL 포함, P-09 지우개, P-11 설정
  - 책: B-01, B-03, B-07 (기간 밖으로 안 넘어감) · D-day: DD-01~DD-08, DD-10, DD-11 · 형광펜: HL-01, HL-05, HL-08 · 컬러: C-01
  - 키: K-01 ← →, K-03 T/ㅅ, K-05 E/ㄷ · 1-7 (물리 키), K-06 Esc, K-07 쓰는 중 양보, K-12 모서리 클릭
  - 저장: DS-01~DS-05, DS-07 (단순판: 쓰는 중 5초 유예 뒤 다시 읽기), DS-08 · 명령: 플래너 열기 · 이전 · 다음 · 오늘
  - 남은 1차: P-02 · K-02 · K-04 · B-08 (주간 · 홈이 생기는 M2 에서), T-03 첫 플래너 양식 (지금은 "내 플래너" 를 오늘부터 자동 생성)
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
시험 저장소의 `.obsidian/plugins/tenmin-planner/` 에 `main.js` · `manifest.json` · `styles.css` 를 넣고 켭니다.

브라우저 확인: `npm run harness` 후 `tests/harness/index.html` 을 엽니다 (Obsidian API 대역 + 메모리 저장소).
`tests/harness/run.js` · `keys.js` 는 쓰기 · 체크 · 미루기 · 칠하기 · COMMENT · MEMO · DAY OFF · D-day · 단축키를 눌러 보는 스크립트입니다.
대역은 실제 Obsidian 동작을 보증하지 않습니다.

라이선스: MIT. 참고한 원본 고지는 [NOTICE.md](NOTICE.md).
