# Spiralday 사용자 동작 목록 — Obsidian 플러그인 이식 체크리스트

- 작성일: 2026-10-14
- 기준 소스: Spiralday MIT 공개 버전 커밋 `e40dd8e` (LICENSE: MIT, © 2026 LeanAgileHungry Inc.)
- 읽은 범위: `Sources/SpiraldayKit` 의 DailyPage · WeeklyPage · HomePage · HomeStats · Components · AppState · DesktopInput · FrontMatter · PDFExport · PageView · Models · ExternalChanges · DailyTemplate · RuledText · DataSafetyText · TaskIDs 는 정독, Theme · Platform · Rings · SharedReader · SampleBook · Curl/CurlController 는 동작과 관련된 부분만 확인 (렌더링 수식 · 셰이더는 읽지 않음), 앱 계층 `Sources/Spiralday` (App · WindowController · RootView · Palette · Settings · PDFExportWindow · Onboarding · FirstRunFlow · Tour · DataSafety · StarPrompt · Telemetry), 동기화는 `Sources/Spiralday/Sync` 의 사용자 동작 (버튼 · 메뉴) 과 README 만 확인. 동기화 내부 프로토콜 (`Sources/SpiraldaySync`) 은 읽지 않음.
- 목적: 화면 모양 · 좌표 · 색이 아니라 사용자가 할 수 있는 동작 전체를 한 줄씩 뽑아 구현 체크리스트로 쓴다. 이 문서가 다루지 않는 것 = 픽셀 단위 레이아웃 (DailyTemplate · WK · HM 상수), 동기화 암호 프로토콜, Metal 셰이더 수식.
- 규모: 동작 182개, 절 16개.

## 0. 읽는 법

### 0.1 표 열

| 열 | 뜻 |
|---|---|
| ID | 절 약어 + 번호 (일간 D · 주간 W · 홈 H · 표지 F · 팔레트 P · 책 B · D-day DD · 형광펜 HL · 컬러 C · PDF PDF · 설정 S · 앱 셸 A · 키 K · 데이터 안전 DS · 동기화 SY · 첫 실행 T). 맨 끝 분류 요약이 이 ID 를 씀 |
| 동작 | 사용자가 할 수 있는 일 한 가지. `(자동)` `(읽기 전용)` 은 사용자가 누르지 않아도 지켜야 하는 규칙 · 표시 |
| 하는 법 | 클릭 · 드래그 · 키 · 메뉴 중 원본이 제공하는 방법 |
| 결과 · 규칙 | 동작의 결과와 숫자 · 제한. 숫자는 소스 값 그대로 (예: 하루 D-day 2개, 형광펜 12개, 할 일 15줄, 슬롯 144칸). 큰따옴표 안 문장은 원본 UI 문구 · 주석의 원문 인용 |
| 원본 위치 | `파일:함수 (줄)`. 파일 이름만 적음 (SpiraldayKit 과 앱 계층에 같은 이름이 없음). 동기화 파일만 `Sync/` 접두 |
| Obsidian 이식 난이도 | `쉬움 / 보통 / 어려움 / 불가` + 데이터 태그 + 한 줄 이유 |

### 0.2 난이도 기준

Obsidian 플러그인은 탭 안의 커스텀 뷰 (DOM / Canvas) 이고 모바일에서도 동작해야 한다. 창 크기 · 창 밖 요소 · 네이티브 메뉴바 · Metal 은 쓸 수 없다.

| 난이도 | 기준 |
|---|---|
| 쉬움 | DOM 클릭 · 입력 · 메뉴 · 표시로 끝나거나, 이미 옮긴 TS 데이터 규칙 위에 얹는 얇은 UI |
| 보통 | Canvas / 포인터 드래그 · 다중 줄 격자 입력 · IME · 모달 · 상태 전이 · 순수 계산 포팅 등 구현량이 있으나 기술적 장벽은 없음 |
| 어려움 | 병합 규칙 · 파일 입출력 UX · PDF 생성처럼 설계 비용이 크거나 플랫폼 (데스크톱 / 모바일) 별로 갈라지는 것 |
| 불가 | 창 밖 요소 · 창 크기 제어 · 네이티브 메뉴바 · Metal 물리 · OS 서비스 (키체인 · 업데이트 · 햅틱 · 파일 관리자) · 외부 서버 의존. 대체안이 있으면 이유 칸에 적음 |

### 0.3 데이터 태그 (`obsidian-tenmin-planner` 현재 구현 대비)

M0 (커밋 `5291687`) 에서 TypeScript 로 옮긴 데이터 계층: `src/model/{types,dates,day,ruled,planner,uuid}.ts`, `src/storage/bookstore.ts`, `src/main.ts` (0.6초 저장 예약), `src/canvasWrap.ts`.

| 태그 | 뜻 |
|---|---|
| 데이터 완료 | 규칙 · 함수가 이미 TS 에 있음 (괄호 안 = TS 함수 이름). 남은 일은 UI 뿐 |
| 데이터 일부 | 일부만 옮김 (괄호 안에 빠진 부분) |
| 데이터 미포팅 | TS 에 아직 없음 (HomeStats · 책 전환 · 삭제 · 외부 변경 반영 등) |

### 0.4 분류 (맨 끝 요약의 기준)

README 의 M0-M4 로드맵과 맞춤: M1 = 일간 화면 완결 (양식 · 체크 · 형광펜 칠하기 + 책 한 권 만들기 · 전환 + 저장 안전), 2차 = 주간 · 홈 · 손글씨 메모 · 밥시간 · 컬러 · 표지 · PDF · 설정 UI · 둘러보기, 보류 = 불가이거나 이식 가치가 낮은 것 (페이지 말림 · 동기화 · 통계 전송 · 업데이트 · 상표 링크).

### 0.5 표기

- `(추정)` = 소스에서 직접 확인하지 못한 판단 (Obsidian 쪽 제약 · 성능 · 문구의 해석 등). 그 외 서술은 위 소스에서 확인한 것.
- 원본 UI 문구는 큰따옴표로 인용했고 출처는 같은 줄의 `원본 위치` 열.
- 줄 번호는 커밋 `e40dd8e` 기준 (앱 계층은 `git show e40dd8e:Sources/Spiralday/<파일>`).

## 1. 일간 페이지

> 일간 = 1277×2000 디자인 단위의 세로 한 장 (창 폭 ÷ 1277 = u 로 스케일). 쓰는 칸은 한 번에 하나이며 편집 키는 "t|날짜|할일id" (할 일), "c|날짜" (COMMENT), "m|날짜|n" · "mt|날짜|n" (메모 · 꼬리표), "tn|날짜|메모id" (타임테이블 글씨) 형식 (Components.swift:taskKey, DailyPage.swift:memoKey).

| ID | 동작 | 하는 법 | 결과 · 규칙 | 원본 위치 | Obsidian 이식 난이도 |
|---|---|---|---|---|---|
| D-01 | 일간 양식 보기 | 일간 페이지 열기 | DATE · D-DAY · COMMENT · TOTAL TIME 머리 칸, TASKS 15줄 (줄 높이 76.12), MEMO 머리선 + 3줄, TIMETABLE 24행 (06시 → 익일 05시) × 6칸 (10분). 기록 없는 날은 빈 양식 | DailyTemplate.swift:DailyForm (16-140), DailyPage.swift:body (27-73) | 보통 — 인쇄 양식을 Canvas/SVG 로 재현, 좌표는 상수 이식 |
| D-02 | 날짜 보기 | (읽기 전용) | "yyyyMMdd EEE" 손글씨, 요일은 그날 컬러, 아래에 컨셉 tint 형광 바. 누를 수 없음 (allowsHitTesting false) | DailyPage.swift:dateField (78-95) | 쉬움 — 텍스트 표시 |
| D-03 | D-DAY 칸 열기 | D-DAY 칸 클릭 | D-day 편집 패널 (7절) 열림. 빈 칸은 "+ D-day" 안내 (PDF 에는 안 찍음), 1개면 가운데, 2개면 위아래로 나눠 표시, 숫자는 이 날 기준 | DailyPage.swift:ddayField (98-127) | 쉬움 — 클릭 → 패널/모달 열기 |
| D-04 | COMMENT 쓰기 | COMMENT 칸 클릭 후 입력 | 최대 8줄, 가운데 정렬. 글이 길면 상자에 맞게 글자 자동 축소 (기준 50, 최소 0.4배). Return = 편집 종료 (줄 바꿈은 ⌥↩ — 첫 장 안내 문구 근거, 추정). DAY OFF 일 때는 칸이 스탬프로 바뀌어 누를 수 없음 | DailyPage.swift:comment (140-147), Components.swift:InlineField (15-130), RuledText.swift:fitScale (156-165) | 보통 · 데이터 일부 (ruled.fitScale — 높이 조건 없음) — 자동 축소에 높이 조건 추가 필요 |
| D-05 | DAY OFF 켜기·끄기 | COMMENT 라벨 옆 ▾ 클릭 → "작성하기" / "DAY OFF" 선택 | DAY OFF 면 COMMENT 칸에 "DAY OFF" 스탬프 (컬러). 적어 둔 COMMENT 는 지우지 않고 보존, 전환 시 쓰던 편집을 먼저 종료. 쉬는 날은 홈 연속 기록을 끊지 않음. 화면 전용 (PDF 에는 ▾ 없음) | DailyPage.swift:CommentModeMenu (484-541), DayOffStamp (557-574), Models.swift:setDayOff (1602-1605) | 쉬움 · 데이터 완료 (planner.setDayOff) — 메뉴 1개 |
| D-06 | TOTAL TIME 보기 | (읽기 전용) | 칠한 10분 칸 중 TOTAL TIME 포함 형광펜만 합산해 "8H36M" 표시. 0분이면 옅게 (투명도 0.12). 분 = 칸 수 × 10 | DailyPage.swift:TotalTime (579-602), Models.swift:minutes (1447-1457) | 쉬움 · 데이터 완료 (planner.minutes, dates.formatHM) |
| D-07 | 할 일 새로 쓰기 | TASKS 의 빈 줄 클릭 | 그 줄에 빈 할 일을 만들고 바로 입력 (형광펜 분류는 나중에). 그 줄이 이미 쓰이고 있으면 아래 첫 빈 줄 → 없으면 위에서부터 첫 빈 줄 → 없으면 맨 끝에 한 줄 추가 | DailyPage.swift:startTask (156-158), Models.swift:addTask (1475-1479), DayRecord.insertTask (223-231), freeTaskRow (215-219) | 쉬움 · 데이터 완료 (planner.addTask, day.insertTask, day.freeTaskRow) |
| D-08 | 할 일 글 고치기 | 쓴 줄 클릭 후 입력 | 인쇄된 줄 폭 (taskWrapWidth) 에 맞춰 아래 빈 줄로 이어 쓰기. 다음 할 일에 막히면 글자 축소 (최소 0.4배), 그래도 넘치면 끝에 "…" (글은 보존). 15줄보다 아래에 쓰면 칸 수를 늘리고 줄 간격 · 글자를 15 ÷ 칸수 비율로 축소. 입력 즉시 저장 예약 | RuledText.swift:rowLayout (126-153), DailyTemplate.swift:taskLayout (137-140), DailyPage.swift:RuledEntry (363-429) | 보통 · 데이터 완료 (ruled.rowLayout, day.taskLayout) — 줄 격자에 맞춘 다중 줄 입력칸 UI 필요, 줄바꿈이 CoreText 가 아닌 canvas 측정이라 위치 차이 가능 (추정) |
| D-09 | Return 으로 다음 줄 | 편집 중 Return | 글이 비었으면 편집 종료. 이 할 일이 쓰는 줄 바로 아래가 비었으면 거기에 새 할 일 (같은 형광펜 승계), 다른 할 일이 있으면 그 할 일 편집으로 이동. 맨 아랫줄에서도 글이 있으면 한 줄 더 추가 (칸 늘림), 글이 없으면 종료 | DailyPage.swift:submitTask (230-242), Components.swift:InlineField onSubmit (85-87) | 보통 · 데이터 완료 (planner.addTask cat 승계, day.taskLayout) — 상태 전이 UI |
| D-10 | ↑ ↓ 로 줄 이동 | 편집 중 ↑ / ↓ (수정키 없이) | 윗줄 / 아랫줄 할 일 편집으로 이동. 여러 줄 할 일 안에서는 캐럿이 첫 줄 (↑) / 마지막 줄 (↓) 일 때만. 대상 줄이 비었으면 그 줄에 새 할 일 (형광펜 없이). 맨 윗줄 ↑ · 맨 아랫줄 ↓ 는 글상자에 맡김. 한글 조합 중이면 조합을 끝낸 뒤 이동 | DailyPage.swift:moveLine (267-279), caretAtEdge (246-263), LineKeyMonitor (434-476) | 보통 · 데이터 완료 — 캐럿 줄 판정 + IME 조합 처리 필요 |
| D-11 | 비운 할 일 자동 삭제 | 글을 모두 지우고 편집 종료 | 공백뿐인 할 일 삭제 (쓰는 중인 것 제외). 남은 할 일은 제 줄 유지 (당기지 않음) | DailyPage.swift:taskEntry onEnd (206), Models.swift:cleanup (1524-1527) | 쉬움 · 데이터 완료 (planner.cleanup) |
| D-12 | 편집 끝내기 | Esc / 종이 빈 곳 클릭 / 다른 칸으로 이동 | 편집 상태 해제와 포커스 해제 | PageView.swift:PageView (25-27), AppState.swift:endEditing (234-242), DesktopInput.swift:escEndsEditing (92-94) | 쉬움 |
| D-13 | 체크 표시 순환 | 할 일 오른쪽 점선 박스 클릭 | 없음 → ○ 완료 → △ 일부 → × 못함 → → 미룸 → 없음. 마우스를 올리면 점선 ○ 자리표시와 1.12배 확대, 컬러 색의 펜 선. 박스 크기 = min(43, 줄 높이 × 0.57). 툴팁 "클릭: ○ 완료 → △ 일부 → × 못함 → → 미룸 (다음 날로 넘어가요)" | Components.swift:MarkButton (190-232), MarkShape (155-187), Models.swift:cycleMark (1530-1533), Mark.next (14) | 쉬움 · 데이터 완료 (planner.cycleMark, types.nextMark) — SVG 5종 |
| D-14 | → 미룸 = 다음 날로 넘기기 | 체크를 → 로 지정 | 다음 날 (책 기간 안) 에 같은 글 · 같은 형광펜 · 표시 없음 사본 생성 (carriedFrom 기록, id = UUIDv5(이름공간 = 원래 id, 이름 = "carry") — 다음 날에 그 id 가 이미 있을 때만 새 id). 빈 글 · 이미 넘김 · 기간 밖이면 안 함. 사본은 다음 날 같은 형광펜 묶음 바로 아래 → 없으면 첫 빈 줄 → 없으면 칸 추가. → 를 떼면 사본이 손대지 않은 상태 (표시 없음 · 글 · 형광펜 동일) 일 때만 삭제 | Models.swift:setMark (1537-1549), carryForward (1560-1568), withdrawCarry (1572-1576), DayRecord.insertCarried (239-247), TaskIDs.swift:carryTaskId (31-33) | 쉬움 · 데이터 완료 (planner.setMark/carryForward/withdrawCarry, uuid.carryTaskId) |
| D-15 | 내일로 미루기 (메뉴) | 할 일 오른쪽 클릭 → "내일로 미루기" | → 표시와 같음 (다음 날로 한 번만). 책의 마지막 날이면 표시만 함. 다음 날 할 일을 쓰는 중이면 먼저 편집 종료 | Components.swift:TaskMenu (265), AppState.endEditingTasks (287-289), Models.swift:postpone (1595) | 쉬움 · 데이터 완료 (planner.postpone) |
| D-16 | 체크 표시 지정 (메뉴) | 할 일 오른쪽 클릭 → "체크 표시" → 5개 중 선택 | 라벨 "표시 없음 / 완료 ○ / 일부 △ / 못함 × / 미룸 →" | Components.swift:TaskMenu (258-262), Mark.label (16-24) | 쉬움 · 데이터 완료 (planner.setMark, types.markLabel) |
| D-17 | 할 일 삭제 (메뉴) | 할 일 오른쪽 클릭 → "삭제" | 할 일 제거. 이미 다음 날로 넘긴 사본은 그날의 할 일이라 그대로 둠 | Components.swift:TaskMenu (267), Models.swift:delete (1590-1592) | 쉬움 · 데이터 완료 (planner.deleteTask) |
| D-18 | 할 일 메뉴 열기 | 할 일 오른쪽 클릭 (편집 중이면 글상자 기본 메뉴 유지) | 메뉴 3그룹: "형광펜 (분류)" 하위 메뉴, "체크 표시" 하위 메뉴, "내일로 미루기" / "삭제" | DailyPage.swift:taskEntry contextMenu (215-217), Components.swift:TaskMenu (236-272) | 쉬움 — Obsidian Menu API, 모바일은 길게 누르기로 대체 |
| D-19 | 할 일 분류 (형광펜) 고르기 | 할 일 왼쪽 칸 (카테고리 칸) 클릭 → 형광펜 메뉴 | 형광펜마다 색 견본 + 이름, 지금 것 체크, 맨 아래 "없음". 같은 형광펜을 쓰는 다른 할 일이 있고 그 묶음에 붙어 있지 않으면 묶음 마지막 줄 바로 아래로 이동 (아래 할 일은 빈 줄이 나올 때까지 한 줄씩 밀림), 처음 쓰는 형광펜이면 제 줄 유지. 마우스를 올리면 칸이 옅게 드러나고 분류가 없으면 "분류 ▾" 힌트. 화면 전용 (PDF · 넘김 스냅샷에는 없음) | Components.swift:TaskCategoryCell (408-460), TaskCategoryMenu (297-339), TaskCategoryPicker (359-382), Models.swift:setCategory (1580-1587), DayRecord.joinCategoryGroup (269-281) | 쉬움 · 데이터 완료 (planner.setCategory, day.joinCategoryGroup) |
| D-20 | 형광펜 이름 표시 | (읽기 전용) | 바로 윗줄 할 일과 형광펜이 다르거나 윗줄이 비었을 때만 묶음 첫 줄에 형광펜 이름 표시 | DailyPage.swift:taskEntry (187-191), CategoryTag (606-619) | 쉬움 |
| D-21 | 완료 할 일 형광 긋기 | (읽기 전용) | 표시가 ○ 완료일 때만 그 할 일의 형광펜 색으로 글 줄마다 형광 바. 형광펜이 없으면 긋지 않음 | DailyPage.swift:taskEntry highlight (202-203), RuledEntry (413-419) | 쉬움 — CSS 배경 |
| D-22 | 타임테이블 칠하기 | 팔레트에서 형광펜 선택 → 격자 드래그 | 시작 칸 ~ 현재 칸 사이 행 우선 (선형) 범위를 칠함 (사각형 아님). 시작 칸이 이미 같은 색이면 그 드래그 전체가 지우기 ("같은 색을 다시 칠하면 지워져요"). 범위가 줄면 줄어든 칸만 붓질 전 값으로 복구. 시작 시 편집 종료, 클릭만으로도 1칸. 칸 번호 0-143 (행 × 6 + 열). 이어진 같은 색은 한 막대로 곱하기 합성 (투명도 0.86) | Components.swift:SlotPainter.drag (698-718), slot(at:) (690-694), drawHighlights (559-575), Models.swift:DayRecord.repainted (142-154) | 보통 · 데이터 완료 (day.repainted, planner.setSlots) — 포인터 이벤트 + Canvas, 모바일은 스크롤과 충돌 처리 필요 |
| D-23 | 지우개 | 지우개 선택 (E) → 격자 드래그 | 범위 칸을 비우고 (-1), 놓을 때 범위와 겹치는 글씨 메모 · 밥시간을 모두 삭제 | Components.swift:SlotPainter.dragEnded eraser (732-733), Models.swift:removeNotes (1398-1401) | 쉬움 · 데이터 완료 (planner.removeNotes, setSlots) — D-22 와 같은 드래그 처리기 재사용 |
| D-24 | 타임테이블 글씨 메모 | "글씨" 선택 → 칸 클릭 또는 드래그 | 드래그 중 점선 밑줄 미리보기 → 놓으면 TimeNote (text) 생성 후 즉시 입력. 메모는 시작 칸에서 그 줄 끝까지 폭 (글자 높이 = 행 × 0.74). 누르면 재편집, 편집 종료 시 빈 메모 자동 삭제, 오른쪽 클릭 "메모 지우기" | Components.swift:SlotPainter.dragEnded (725-727), textNote (649-675), drawPending (629-641), Models.swift:cleanupNotes (1404-1407) | 보통 · 데이터 완료 (planner.addNote/updateNote/removeNote/cleanupNotes) |
| D-25 | 밥시간 | "밥" 선택 → 시작 칸에서 끝 칸까지 드래그 (클릭만 하면 1시간) | TimeNote (meal) 생성. 클릭만 하면 start … min(start + 5, 143). 포크 아이콘 스티커 + 끝 칸까지 컨셉 색 화살표, 줄이 바뀌면 줄 끝 갈고리로 다음 줄 처음에서 이어짐. 아이콘 오른쪽 클릭 "밥시간 지우기" | Components.swift:SlotPainter.dragEnded (728-731), drawMeal (584-626), mealHandle (678-686) | 보통 · 데이터 완료 (planner.addNote/removeNote) — 화살표 드로잉 이식 |
| D-26 | MEMO 쓰기 | MEMO 본문 칸 또는 왼쪽 작은 칸 (꼬리표) 클릭 후 입력 | 꼬리표 (memoTags) + 본문 (memos), 기본 3칸. 본문이 길면 다음 칸으로 이어 쓰고, 칸이 모자라면 칸을 늘리며 줄 간격 · 글자를 같은 비율로 축소 (최소 0.45). Return (본문) = 다음 메모 본문 편집. 빈 칸 클릭 = 새 메모. 끝에 붙은 빈 메모는 칸으로만 남김 | DailyPage.swift:memosView (308-335), memoLayout (299-304), memoCount (287-295), Models.swift:memo/memoTag (1502-1516), RuledText.swift:layout (78-94) | 보통 · 데이터 일부 (ruled.flowLayout 완료, memo 읽기·쓰기 API 미포팅) |
| D-27 | 워드마크 링크 | 오른쪽 아래 "spiralday" 클릭 | spiralday.com 열기. 이식 때는 이름 · 로고를 쓰지 않는다는 NOTICE.md 방침으로 제외 | DailyPage.swift:WordmarkLink (339-357) | 쉬움 — 이식 제외 대상 |
| D-28 | 도구별 마우스 커서 | 타임테이블 위에서 마우스 이동 | 칠하기 도구 = 십자, 글씨 도구 = I-빔, 누를 수 있는 곳 = 손가락 | Components.swift:SlotPainter (548), Platform.swift:PointerCursor (158-186) | 쉬움 — CSS cursor, 모바일 없음 |

## 2. 주간 페이지

> 주간 = 2000×1277 가로 한 장, 월요일 시작 (Dates.cal firstWeekday = 2). 요일 칸의 할 일 · 표시 · 타임테이블은 일간과 같은 기록 (어느 쪽에서 적어도 함께 바뀜).

| ID | 동작 | 하는 법 | 결과 · 규칙 | 원본 위치 | Obsidian 이식 난이도 |
|---|---|---|---|---|---|
| W-01 | 주간 양식 보기 | 주간 페이지 열기 | 머리줄 (MY GOAL 월-금 위 / REVIEW OF THE WEEK 토-일 위), 월-일 7칸 (칸 폭 260): 날짜 · 요일 / 할 일 10줄 (줄 35) / 타임테이블 24행 (행 26) × 6칸 (칸 35) / 하루 합계 H · M. 오늘 날짜에 형광 밑줄, 요일 색 = 토 파랑 · 일 빨강 | WeeklyPage.swift:WK (24-92), WeeklyForm (381-514), WeekDayColumn.header (234-273) | 보통 — 7칸 반복 양식을 Canvas/SVG 로 |
| W-02 | 이번 주 목표 쓰기 | MY GOAL 칸 클릭 후 입력 | 안내 글 "이번 주 목표". 글이 있으면 글 폭에 맞춰 ┌ ┘ 꺾쇠 펜 강조. 같은 값이 홈 OVERVIEW 에 표시됨 | WeeklyPage.swift:GoalField (161-196), Models.swift:weekField (1518-1520), editWeek (1287-1292) | 쉬움 · 데이터 완료 (planner.editWeek) |
| W-03 | 주간 별점 | REVIEW OF THE WEEK 옆 별 5개 클릭 | 누른 별 개수로 설정, 현재 값과 같은 별을 다시 누르면 0. 값 0-5. WeekRecord.review (글) 는 데이터에 있으나 입력 UI 는 소스에 없음 (WeeklyPage · HomePage 에서 쓰는 곳 없음 확인) | Components.swift:Stars (464-488), WeeklyPage.swift:body (146) | 쉬움 · 데이터 완료 (planner.editWeek stars) |
| W-04 | 날짜 머리 → 그날 일간 | 요일 칸 머리 "M/D" 클릭 | 일간으로 전환하며 그날 열기 (책 범위 안으로 보정). 마우스를 올리면 옅은 배경 + ↗ 화살표 | WeeklyPage.swift:header (234-273), AppState.swift:openDay (273-277) | 쉬움 |
| W-05 | 주간에서 할 일 쓰기 | 칸의 빈 줄 클릭 | addTaskAfterLast = 일간에서 마지막으로 쓴 줄 다음 첫 빈 줄 (아래에 없으면 위에서부터, 그래도 없으면 끝에 추가) 후 바로 입력. 한 줄만 쓰고 줄바꿈 없음, 폭을 넘으면 글자 축소 (기준 28, 최소 0.45배) | WeeklyPage.swift:taskLine (277-347), Models.swift:addTaskAfterLast (1484-1488), RuledText.swift:oneLineScale (52-55) | 보통 · 데이터 완료 (planner.addTaskAfterLast) |
| W-06 | 10개 초과 할 일 표시 | 10번째 줄의 "+N" 알약 클릭 | 한 날의 할 일이 10개를 넘으면 10번째 줄에 초과 개수 "+N" 표시 (글 폭 42 줄임), 클릭하면 그날 일간. 툴팁 "할 일 N개 더 — 일간 페이지에서 보기" | WeeklyPage.swift:taskLine (279-334) | 쉬움 |
| W-07 | 주간 Return | 편집 중 Return | 아래 칸 할 일이 있으면 그 할 일 편집, 없으면 새 할 일 (같은 형광펜 승계), 10번째 칸이면 편집 종료 | WeeklyPage.swift:submit (351-359) | 보통 · 데이터 완료 (planner.addTaskAfterLast cat) |
| W-08 | 주간 체크 표시 순환 | 점선 박스 클릭 | 일간과 같은 순환 (박스 크기 = 줄 높이 × 0.57). 다음 날 칸이 편집 중이면 먼저 종료한 뒤 변경 | WeeklyPage.swift:taskLine (336-346), Components.swift:endEditingTasks (287-289) | 쉬움 · 데이터 완료 (planner.cycleMark) |
| W-09 | 주간 분류 고르기 | 할 일 왼쪽 색 막대 자리 클릭 | 일간과 같은 형광펜 메뉴. 형광펜이 있으면 4×17 색 막대 표시 | WeeklyPage.swift:taskLine (284-294) | 쉬움 · 데이터 완료 (planner.setCategory) |
| W-10 | 주간 할 일 메뉴 | 할 일 오른쪽 클릭 | D-15 ~ D-17 과 같은 메뉴 (형광펜 · 체크 표시 · 내일로 미루기 · 삭제) | WeeklyPage.swift:taskLine (309-312) | 쉬움 · 데이터 완료 |
| W-11 | 주간 타임테이블 칠하기 | 요일 칸의 격자 드래그 | 일간과 같은 SlotPainter (칸 35 × 행 26). 글씨 · 밥 · 지우개 동일, 곱하기 합성이라 인쇄 선이 비침 | WeeklyPage.swift:WeekDayColumn (217-219), Components.swift:SlotPainter (499-738) | 보통 · 데이터 완료 — 7칸 동시 Canvas 성능 확인 필요 (추정) |
| W-12 | 하루 합계 보기 | (읽기 전용) | 칸 아래 "H" · "M" 앞 빈칸에 손글씨 숫자 (총 0분이면 안 씀) | WeeklyPage.swift:footer (362-375) | 쉬움 · 데이터 완료 (planner.minutes) |
| W-13 | 책 기간 밖 날 잠금 | (읽기 전용) | 책 기간 밖의 날 칸은 종이색 0.78 덮개로 흐리게, 눌러도 반응 없음. 툴팁 "이 플래너의 기간이 아닌 날이에요" | WeeklyPage.swift:WeekDayColumn (221-228), BookInfo.contains (507-512) | 쉬움 · 데이터 완료 (planner.bookContains) |
| W-14 | 쉬는 날 꼬리표 | (읽기 전용) | DAY OFF 인 날은 요일 위에 컬러 테두리 "DAY OFF" 꼬리표 | WeeklyPage.swift:DayOffTag (95-113), header (261-264) | 쉬움 |

## 3. 홈 (통계)

> 홈 = 2000×1277 한 장짜리 (PageKind.flips == false, 넘기지 않음). 숫자는 열 때마다 오늘 기준으로 계산 (HomeStats.make 는 PlannerData 를 받는 순수 함수). 이식 시 TS 쪽 HomeStats 는 아직 없음.

| ID | 동작 | 하는 법 | 결과 · 규칙 | 원본 위치 | Obsidian 이식 난이도 |
|---|---|---|---|---|---|
| H-01 | 홈 보기 | 홈 열기 (H / ⌘0 / 팔레트) | 칸 8개: OVERVIEW · D-DAY · 요약 6칸 · LAST 12 WEEKS · HIGHLIGHTERS · TIME OF DAY · LAST 35 DAYS · WEEKDAYS · TASK MARKS. 데이터가 없으면 칸마다 손글씨 안내 ("타임테이블을 칠하면 여기에 통계가 쌓여요" 등) | HomePage.swift:HomePage (105-192), HomeForm (311-376), HomeInk (381-406) | 보통 — 차트 7종 Canvas/SVG |
| H-02 | 이번 주 목표 → 주간 | OVERVIEW 의 이번 주 목표 칸 클릭 | 오늘이 속한 주의 주간 페이지로 전환. 목표는 한 줄 맞춤 (0.92 · 0.85배 → 안 되면 끝을 "…"), 비어 있으면 "이번 주 목표". 툴팁 "이번 주 주간 페이지 열기" | HomePage.swift:body (131-137), openWeek (176-179), drawHeader (535-542) | 쉬움 |
| H-03 | 오늘의 D-day 편집 | 홈 D-DAY 칸 클릭 | 오늘 날짜의 D-day 편집 패널 열기. 2개면 칸을 반씩 나눠 표시 | HomePage.swift:body (139-145), drawHeader (544-562) | 쉬움 |
| H-04 | 요약 6칸 보기 | (읽기 전용) | THIS WEEK (이번 주 합계 + 지난주 캡션) · THIS MONTH · DAILY AVERAGE (이번 달 합계 ÷ 기록한 날) · RECORDED DAYS ("n / 말일") · STREAK · DONE RATE (이번 달 표시한 할 일 중 ○ 비율). 합계는 TOTAL TIME 포함 형광펜만 | HomePage.swift:drawKeyNumbers (567-609), HomeStats.swift:make (94-249) | 보통 · 데이터 미포팅 (HomeStats) — 순수 함수 포팅 |
| H-05 | 기록한 날 · STREAK 규칙 | (읽기 전용) | 홈의 "기록한 날" = 현재 존재하는 형광펜을 타임테이블에 한 칸이라도 칠한 날 (D-day · DAY OFF · 할 일만 있는 날 제외). STREAK = 오늘 (오늘이 비어 있고 DAY OFF 도 아니면 어제) 부터 거꾸로 세되 DAY OFF 날은 세지도 끊지도 않고 건너뜀. 설정 · PDF 의 "기록한 날" (hasRecord) 은 할 일 · COMMENT · 메모 · 컬러 · 글씨 메모까지 포함하는 별개 정의 | HomeStats.swift:make (147-154, 204-215), Models.swift:hasRecord (131-134) | 쉬움 · 데이터 일부 (day.hasRecord 완료, 홈용 painted 판정 미포팅) |
| H-06 | LAST 12 WEEKS | 막대 클릭 | 이번 주 포함 최근 12주 합계 막대, 형광펜 색을 팔레트 순서로 아래부터 쌓음. 눈금 후보 [1, 2, 5, 10, 15, 20, 25, 50, 100] 시간 (칸 4개 이하). 막대 클릭 → 그 주 주간 페이지 | HomePage.swift:drawWeeks (613-677), openWeek (176-179), HomeStats.swift (190-195) | 보통 · 데이터 미포팅 |
| H-07 | HIGHLIGHTERS (이번 달) | (읽기 전용) | 이번 달 형광펜별 시간 막대, 많은 순 (동률은 팔레트 순). TOTAL TIME 미포함 펜은 이름 뒤 " *" 와 흐린 막대 + 안내 "* 흐린 형광펜은 TOTAL TIME 에 넣지 않아요" | HomePage.swift:drawCategories (681-725), HomeStats.swift (197-202) | 보통 · 데이터 미포팅 |
| H-08 | TIME OF DAY (지난 4주) | (읽기 전용) | 지난 28일, 144칸마다 가장 자주 칠한 형광펜 색과 빈도 (가장 자주 칠한 칸 = 가장 진하게, 10단계). "가장 자주 칠한 시간  오전 9시 – 10시" | HomePage.swift:drawHeat (729-803), HomeStats.swift (225-240) | 보통 · 데이터 미포팅 |
| H-09 | WEEKDAYS (지난 8주) | (읽기 전용) | 요일별 하루 평균 (처음 기록한 날 이후의 그 요일 수로 나눔), 가장 긴 요일 강조 | HomePage.swift:drawWeekdays (807-843), HomeStats.swift (217-223) | 보통 · 데이터 미포팅 |
| H-10 | TASK MARKS (이번 달) | (읽기 전용) | 이번 달 ○ △ × → 개수 ("완료" "일부" "못함" "미룸") 와 비율 띠 (완료가 가장 진함) | HomePage.swift:drawMarks (847-885), HomeStats.swift (164-172) | 쉬움 · 데이터 미포팅 |
| H-11 | LAST 35 DAYS (잔디) | 날짜 칸 클릭 | 5주 × 7일, 월요일 시작. 하루 합계 분 → 레벨 0 / 120 미만 / 240 미만 / 360 미만 / 그 이상 (칠했지만 합계 제외 색뿐이면 1), 그날의 컬러로 색칠. 오늘은 펜 동그라미, DAY OFF 는 날짜 옆 점, 줄 앞에 월요일 날짜. 클릭 → 그날 일간 | HomePage.swift:drawCalendar (889-963), level (968-976), body (160-171), HomeStats.swift (242-247) | 보통 · 데이터 미포팅 |

## 4. 표지 · 첫 장

> 책 맨 앞의 두 장. 일간 · 주간 모두 [표지] → [첫 장] → 책의 첫날 (첫 주). 번호는 첫 장 바로 앞 두 칸을 쓴다 (첫날 -2 = 표지, -1 = 첫 장), 그래서 넘기기 · 스와이프 · 스냅샷이 번호 하나로 동작.

| ID | 동작 | 하는 법 | 결과 · 규칙 | 원본 위치 | Obsidian 이식 난이도 |
|---|---|---|---|---|---|
| F-01 | 앞 장 순서 · 이동 | 첫날 (첫 주) 에서 ← 두 번 (표지 앞으로는 못 넘김) | 표지 → 첫 장 → 첫날. 일간 · 주간에 모두 있고 홈에는 없음. 표지 · 첫 장에서 쪽 종류 (일간 ↔ 주간) 를 바꾸면 같은 앞 장 유지. 책이 펼쳐져 있을 때만 존재 (hasFront) | AppState.swift:frontIndex (111-114), frontPage (117-121), pageRange (127-133), switchKind (286-288) | 보통 — 페이지 인덱스 체계에 앞 장 2개 추가 |
| F-02 | 표지 보기 | 표지 열기 | 책 이름 (손글씨, 2줄까지, 자동 축소 기준 124 / 118), 기간 "yyyy. M. d.  —  yyyy. M. d." (종료일 없으면 "yyyy. M. d.  —"), 머리선 "PLANNER ──── 2026" (연도가 다르면 "2026 – 2027"), 표지 색 띠 + 이름표. 이름 · 표지 색은 표지에서 고칠 수 없고 설정에서만 | FrontMatter.swift:CoverPage (163-255), years (241-246), period (248-254) | 보통 — 시각 재현 |
| F-03 | 첫 장에 하고 싶은 말 쓰기 | 첫 장 가운데 클릭 후 입력 | 최대 14줄 가운데 정렬, 글이 길면 자동 축소 (기준 76). 빈 칸 안내 "여기에 적고 싶은 말을 적어 보세요" (PDF 제외). ⌥↩ 줄 바꿈, Return · Esc · 바깥 클릭으로 끝 (Return 은 onSubmit 이 없어 편집 종료로 처리됨, 코드 근거). 저장 위치 prefs.motto (파일 키 mottoText, 비면 키 생략) | FrontMatter.swift:MottoPage (285-341), Models.swift:Prefs.motto (327-331) | 쉬움 · 데이터 완료 (types.Prefs.motto) |
| F-04 | 앞 장에서 도구 제한 | 일간 표지 / 첫 장에서 팔레트 보기 | D-day 버튼과 컬러 고르기를 비활성 (투명도 0.4) — 첫날의 D-day · 컬러가 바뀌지 않게 | Palette.swift:ddayButton (925-944), concept (947-954) | 쉬움 |
| F-05 | 책 정보 변경 후 앞 장 유지 | 설정에서 기간 · 이름 · 표지 색 변경 | 보던 표지 / 첫 장에 그대로 머묾 (번호 재계산) | AppState.swift:bindStore frontWatch (178-186) | 쉬움 |

## 5. 도구 팔레트

> 팔레트 = 종이 창 옆에 붙는 별도 패널 (NSPanel, 창과 함께 움직임). 세로 배치 순서: 책 → 홈 · 주간 · 일간 → ‹ › · 오늘 · D-day → 컬러 → 형광펜들 · 지우개 · 글씨 · 밥 → 설정 톱니. 위 · 아래에 두면 같은 도구를 가로 한 줄로 배치. Obsidian 에서는 창 밖에 붙일 수 없어 뷰 안 오버레이로 대체해야 함.

| ID | 동작 | 하는 법 | 결과 · 규칙 | 원본 위치 | Obsidian 이식 난이도 |
|---|---|---|---|---|---|
| P-01 | 책 메뉴 열기 · 전환 | 팔레트 맨 위 책 표지 버튼 클릭 → 목록에서 선택 | 책 목록 (지금 펼친 권 체크, 예시 플래너는 이름에 "예시" 가 없으면 "· 예시" 덧붙임). 선택 → 그 책 펼침 (읽지 못하는 책이면 알림 후 그대로). 마지막 항목 "플래너 관리…" → 설정의 플래너 항목. 툴팁 "이름 · 기간" | Palette.swift:BookMenu (1120-1178) | 쉬움 · 데이터 미포팅 (activate) — Menu API |
| P-02 | 보기 전환 | 팔레트 "홈" "주간" "일간" 버튼 (힌트 H · W · D) | switchKind: 표지 / 첫 장이면 같은 앞 장 유지, 일간 → 주간은 그 날이 속한 주, 주간 → 일간은 보던 주에 오늘이 있으면 오늘 아니면 그 주 월요일 (모두 책 범위 안으로 보정), 홈에서 나가면 직전에 보던 날 / 주 그대로. 현재 쪽 강조. 쪽 종류는 prefs.lastKind 로 저장 | Palette.swift:kindButton (880-900), AppState.swift:switchKind (279-297), Models.swift:editPrefs (1294) | 쉬움 · 데이터 완료 (types.Prefs.lastKind) |
| P-03 | 이전 · 다음 장 | 팔레트 ‹ › 클릭 | flip(.backward / .forward). 범위 끝이면 못 넘김 (트랙패드 진동만) | Palette.swift:arrows (902-908), AppState.swift:flip (246-251) | 쉬움 |
| P-04 | 오늘로 | 팔레트 "오늘" 클릭 (T) | goToday: 홈이면 오늘 장 + 직전 쪽 종류로 복귀, 일간 · 주간이면 오늘 장 (책 범위 밖이면 가장 가까운 장). 이미 오늘이면 아무 일 없음. 멀리 건너뛸 때는 한 장 넘기는 모습으로 도착 표시 | Palette.swift:todayButton (910-921), AppState.swift:goToday (253-271) | 쉬움 |
| P-05 | 팔레트에서 D-day 붙이기 | 팔레트 "D-day" 클릭 | 일간 = 보고 있는 날, 주간 · 홈 = 오늘에 D-day 편집 패널 (7절). 일간 표지 / 첫 장에서는 비활성 | Palette.swift:ddayButton (923-945) | 보통 — 패널/모달 (7절 재사용) |
| P-06 | 컬러 고르기 | 팔레트 색 동그라미 9개 클릭 / 오른쪽 클릭 | 라벨 "오늘의 컬러" (일간) / "기본 컬러" (주간 · 홈). 일간: 그날 컬러 설정 (기본과 같은 색을 누르면 따르기 = nil). 주간 · 홈: 기본 컬러 설정. 오른쪽 클릭 메뉴 "기본 컬러로 정하기" / (일간) "이 날은 기본 컬러 따르기". 현재 선택은 링, 기본 컬러는 흰 점 | Palette.swift:ConceptPicker (1195-1241), Models.swift:setTheme (1412) | 쉬움 · 데이터 완료 (planner.setTheme, editPrefs.defaultTheme) |
| P-07 | 형광펜 선택 | 팔레트 펜 클릭 (또는 숫자 1-7) | 도구 = 그 펜의 id. 선택한 펜은 종이 쪽으로 4pt 나오고 이름이 굵어짐. 이 펜은 타임테이블 칠하기 전용 (할 일 분류는 D-19) | Palette.swift:pen (956-966), select (876-878) | 쉬움 |
| P-08 | 형광펜 이름 · 색 바꾸기 | 펜 더블클릭 → 팝오버 | 이름 입력, 색 선택 (투명도 없음), "TOTAL TIME 에 포함" 토글. 이미 칠한 칸 · 할 일에 즉시 반영 | Palette.swift:PenEditor (1453-1474), Models.swift:updateCategory (1423-1427) | 쉬움 · 데이터 완료 (planner.updateCategory) |
| P-09 | 지우개 선택 | 팔레트 "지우개" 클릭 (E) | 도구 = -1. 툴팁 "칠한 칸, 글씨, 밥시간을 지운다" | Palette.swift:eraser (968-973), AppState.swift:eraser (33) | 쉬움 |
| P-10 | 글씨 · 밥 도구 선택 | 팔레트 "글씨" / "밥" 클릭 | 도구 = -2 / -3. 툴팁 "타임테이블에 글씨 쓰기 — 칸을 누르거나 끌어서 쓰기 시작", "밥시간 — 시작 칸부터 끝 칸까지 끌기 (누르기만 하면 1시간)" | Palette.swift:textChip (975-980), mealChip (982-987), AppState.swift:textTool/mealTool (34-35) | 쉬움 |
| P-11 | 설정 열기 | 팔레트 톱니 클릭 (⌘,) | 설정 창 열기. 동기화에 손볼 것이 있으면 (오류 · 복구 코드 확인) 동기화 항목으로 바로. 둘러보는 중에는 막힘 | Palette.swift:settingsButton (989-1008), App.swift:commands (18-25) | 쉬움 — Obsidian 설정 탭 / 모달 연결 |
| P-12 | 팔레트 접기 · 펼치기 | ⌘\ / 접기 화살표 / 접힌 손잡이 클릭 | 접으면 가느다란 손잡이만 남고 지금 도구 배지 (펜 색 원 / 지우개 / 글씨 / 밥) 표시. 접혀 있어도 현재 도구로 칠할 수 있음. 손잡이 클릭 · ⌘\ = 펼친 채 고정. 접힘 상태는 저장 (palette.collapsed) | Palette.swift:PaletteModel (214-399), PaletteHandle (1034-1070), CollapseButton (1012-1031) | 보통 — 뷰 안 오버레이 + 상태 저장 |
| P-13 | 손잡이 호버 펼침 | 접힌 손잡이에 마우스 올림 | 0.12초 뒤 잠깐 펼침, 팔레트에서 벗어나 0.6초 뒤 접힘. 마우스 버튼을 누른 채 (칠하는 중) 지나가면 안 펼침. 메뉴 · 팝오버가 떠 있는 동안은 접지 않음. 도구 단축키로 도구를 바꾸면 1.2초 동안 펼쳐 보여 줌 | Palette.swift:hoverHandle (336-346), flash (349-352), hold (355-357), PaletteMetrics (93-117) | 보통 — 모바일은 hover 가 없어 탭으로 대체 (추정) |
| P-14 | 자동으로 접기 | 설정 → 팔레트의 "팔레트 자동으로 접기" 토글 | 켜면 항상 접힌 채 시작하고 켜는 순간 접힘, 끄면 펼쳐 고정. 앱 전체 설정 (모든 플래너 공통) | Palette.swift:autoCollapse (243-249), Settings.swift:SettingsPalettePane (1849-1869) | 쉬움 |
| P-15 | 팔레트 자리 고르기 | 설정 → 팔레트의 카드 4개: "오른쪽 · 기본" "왼쪽" "위" "아래" | 위 · 아래는 가로 한 줄. 고르면 즉시 옮겨 감 (페이드 0.12 / 0.22초). 스프링 쪽 (일간 왼쪽, 주간 · 홈 위) 이면 스프링만큼 더 띄움 | Palette.swift:PaletteEdge (21-91), PalettePositionPicker (1479-1497), Settings.swift:SettingsPalettePane (1835-1847) | 보통 — 뷰 안 가장자리 4방향 배치로 대체 |
| P-16 | 창 밖 부착 · 자리 계산 | (자동) | 팔레트가 종이 창 옆의 별도 패널로 붙고 창과 함께 움직임. 고른 쪽에 화면 자리가 없으면 반대쪽 → 그래도 없으면 화면 안으로 눌러 넣고, 설정에서 자리를 바꾸면 창을 옮기거나 (비율 유지) 줄여 자리를 만듦 | Palette.swift:PalettePlacement (130-208), PaletteController (405-651), WindowController.swift:makeRoomForPalette (323-366) | 불가 — 창 밖 요소 (NSPanel). 대체 = P-15 의 뷰 안 배치 |
| P-17 | 긴 팔레트 스크롤 | (자동) | 세로 팔레트가 화면보다 길면 형광펜 목록 (최소 92pt) 만, 그래도 길면 팔레트 전체를 그 높이 안에서 스크롤 (스크롤 막대 숨김). 형광펜 12개면 1086pt 로 13인치 화면 초과 | Palette.swift:fit (499-514), columnPens (775-796) | 보통 — 좁은 뷰 · 모바일에서 필요 |

## 6. 책 (플래너) 관리

> 플래너 한 권 = 책 한 권 = books/<ID>.json 한 파일. 기록 · 형광펜 · 기본 컬러 · 저장한 D-day · 날마다 붙인 D-day · 첫 장 말이 권마다 따로. 책장 목록은 library.json.

| ID | 동작 | 하는 법 | 결과 · 규칙 | 원본 위치 | Obsidian 이식 난이도 |
|---|---|---|---|---|---|
| B-01 | 새 플래너 만들기 | 설정 → 플래너의 "새 플래너 만들기" (또는 팔레트 책 메뉴 → "플래너 관리…") | 시트: 이름 (공백 제거, 비면 불가, 같은 이름이면 경고만), 표지 색 9종, 시작일 (필수), 종료일 토글 (정하지 않으면 끝없이) + 빠르게 정하기 "1개월" "3개월" "6개월" "1년" "올해 말", 종료 < 시작이면 오류. 만들면 바로 펼침. 형광펜 구성 · 기본 컬러 · lastKind 는 펼친 책 (예시면 내 첫 책, 없으면 기본값) 에서 이어받음. 예시 플래너는 책장 맨 끝 유지. 제안 이름 "새 플래너" / "새 플래너 n" (온보딩 양식은 "내 플래너" / "내 플래너 n", 30자 제한 — 설정 시트에는 길이 제한 코드를 찾지 못함), 표지는 안 쓴 첫 색 (모두 쓰였으면 개수 % 9) | Settings.swift:SettingsBookEditor (750-955), SettingsBookPreset (1079-1125), Models.swift:createBook (1047-1072) | 보통 · 데이터 일부 (bookstore.createBook 완료; 이름 · 기간 규칙 UI 미포팅) |
| B-02 | 플래너 편집 | 책 행의 연필 아이콘 / 오른쪽 클릭 "편집…" | 이름 · 시작일 · 종료일 · 표지 색 수정. 날짜는 날 단위로 정규화하고 종료 < 시작이면 종료 = 시작. 펼친 책이면 보던 장이 새 기간 밖일 때 가장 가까운 장으로 이동. 새 기간 밖에 기록한 날이 있으면 경고 (기록은 지워지지 않으나 기간을 넓히기 전에는 그 장을 펼칠 수 없음) | Settings.swift:SettingsBookEditor.save (936-954), outsideWarning (926-934), SettingsBookRange.settle (1129-1141), Models.swift:updateBook (1074-1081) | 보통 · 데이터 미포팅 (updateBook) |
| B-03 | 플래너 펼치기 (전환) | 책 행 "펼치기" 버튼 / 팔레트 책 메뉴 | activate: 지금 책 저장 → 새 책 읽기. 읽지 못하면 펼치지 않고 알림. 전환되면 편집을 끝내고 오늘 (범위 밖이면 가장 가까운 장) 부터 보임 | Models.swift:activate (1086-1103), AppState.swift:bindStore (162-175) | 보통 · 데이터 미포팅 (activate) |
| B-04 | 플래너 삭제 | 책 행 휴지통 / 오른쪽 클릭 "지우기…" → 확인 | 확인 문구에 "영구히 지워져요" (예시는 "지우기") + 기록한 날 수. 책 파일과 .before-per-day-dday.json 삭제 (읽지 못한 책의 .unreadable-… 복사본은 남김). 펼친 책이면 다음 책 (내가 만든 책 먼저, 없으면 예시) 펼침. 제한: 내 플래너는 한 권 더 있을 때만, 예시는 내 플래너가 있으면 언제든 | Settings.swift:SettingsBooksPane (233-378), Models.swift:deleteBook (1120-1138) | 보통 · 데이터 미포팅 (deleteBook) |
| B-05 | 책장 보기 | 설정 → 플래너 열기 | 책 행: 표지 그림 · 이름 · "예시" / "펼침" 배지 · 기간 · 기록한 날 수 (펼친 책만) · 상태 문구, 펼친 책 행으로 자동 스크롤. 규칙 안내 3개 ("시작일이 첫 장이에요" "종료일을 정하면 그날에서 멈춰요" "종료일이 없으면 계속 넘어가요") | Settings.swift:SettingsBookRow (404-478), SettingsBookRuleRow (584-609) | 쉬움 |
| B-06 | 예시 플래너 | (처음 한 번 자동) / 설정 "예시 플래너 다시 넣기" | 오늘까지 14일치 (오늘이 마지막 날, 표지 민트), 기본 형광펜 · 저장 D-day 3개 · 첫 장 말 · 주간 목표와 별점 포함. 한 번 꽂은 뒤 지워도 자동 재생성 없음 (library.sampleSeeded). 펼치지는 않음. 둘러보기가 이 책을 빌려 씀 | Models.swift:seedSampleBookIfNeeded (1154-1162), addSampleBook (1167-1182), SampleBook.swift:makeSampleBook (27-), Settings.swift:SettingsSampleBookRow (532-559) | 보통 — 이야기 3주 × 7일 문구 이식량 큼 (SampleBook.swift 574줄), 소량 데모 데이터로 대체 가능 |
| B-07 | 책 기간 규칙 | (자동) | 시작일 이전 · 종료일 이후로는 넘어가지 않음, 종료일이 없으면 끝없이. 일간 범위 = 책 기간, 주간 범위 = 시작일이 속한 주 ~ 종료일이 속한 주 | AppState.swift:dayRange (89-94), weekRange (96-101), Models.swift:BookInfo.contains (507-512) | 쉬움 · 데이터 완료 (planner.bookContains) |
| B-08 | 마지막 쪽 종류 기억 | (자동) | 쪽 종류를 바꿀 때마다 prefs.lastKind 저장, 다음 실행은 그 쪽으로 시작 | WindowController.swift:morph (273), App.swift:AppDelegate.init (140-141) | 쉬움 · 데이터 완료 (types.Prefs.lastKind) |

## 7. D-day

> D-day 는 "저장한 D-day 목록" (prefs.ddays, 개수 제한 없음) 과 "날에 붙인 복사본" (DayRecord.ddays, 하루 최대 Prefs.maxDDays = 2) 두 층. 붙인 것은 그날에만 남고 다음 날로 넘어가지 않으며, 목록을 고치거나 지워도 이미 붙인 날은 그대로.

| ID | 동작 | 하는 법 | 결과 · 규칙 | 원본 위치 | Obsidian 이식 난이도 |
|---|---|---|---|---|---|
| DD-01 | 하루 2개 제한 | (자동) | 하루에 붙일 수 있는 D-day 는 2개. 가득 차면 붙이기 버튼 비활성 + "하루에 2개까지 붙일 수 있어요. 하나를 떼면 더 붙일 수 있어요." | Models.swift:Prefs.maxDDays (334), Components.swift:DDayEditor (744-982) | 쉬움 · 데이터 완료 (types.MAX_DDAYS) |
| DD-02 | D-day 편집 패널 열기 | 일간 D-DAY 칸 / 홈 D-DAY 칸 / 팔레트 D-day 클릭 | 폭 340 패널: "이 날의 D-day" (날짜, 오늘이면 "오늘 · ") → 붙인 D-day (n / 2) → 저장한 D-day 에서 고르기 → 새로 만들기. | Components.swift:DDayEditor.body (776-879) | 보통 — Obsidian 에서는 모달 또는 인라인 패널 |
| DD-03 | 저장한 D-day 붙이기 | 목록 행 클릭 | applyDDay: 저장한 항목을 이 날에 복사 (source = 저장 id). 이미 붙인 것은 목록에서 빠지고, 가득 차면 비활성. 이 날 이후 날짜가 위, 지난 D-day 는 "지난 D-day n개" 접힘 안. 4개 넘으면 스크롤. 숫자는 이 날에서 센 값 | Components.swift:libraryRows (911-943), Models.swift:applyDDay (1311-1317) | 쉬움 · 데이터 완료 (planner.applyDDay) |
| DD-04 | 새로 만들어 붙이기 | 제목 입력 ("무엇까지? (예: 시험)") + 날짜 달력 (기본 +30일) + "목록에도 저장" 체크 (기본 켬) → "붙이기" / Return | 제목 공백 제거, 저장 체크 시 저장 목록에도 추가 (source 연결), 새 항목은 이 날에도 복사. 가득 차면 비활성 | Components.swift:attachNew (976-981), Models.swift:addDDay (1321-1329) | 쉬움 · 데이터 완료 (planner.addDDay) — 달력은 input type=date |
| DD-05 | 붙인 D-day 고치기 | 붙인 행의 제목 입력 / 날짜 버튼 → 달력 | 이 날에 붙인 복사본만 바뀜 (다른 날 · 저장 목록 그대로). 숫자 배지 "D-n" 즉시 갱신 | Components.swift:attachedRow (884-909), Models.swift:editDDay (1337-1343) | 쉬움 · 데이터 완료 (planner.editDDay) |
| DD-06 | 붙인 D-day 떼기 | 붙인 행 오른쪽 마이너스 버튼 | 이 날에서만 제거. 툴팁 "이 날에서만 떼기 (다른 날과 저장한 목록은 그대로)" | Components.swift:attachedRow (900-905), Models.swift:removeDDay (1332-1334) | 쉬움 · 데이터 완료 (planner.removeDDay) |
| DD-07 | 어제와 같게 | 이 날에 D-day 가 없고 전날에 있을 때 "어제와 같게 · 제목들" 클릭 | copyPreviousDDays: 전날 D-day 를 이 날에 복사 (이미 있는 것은 건너뜀, 최대 2개까지) | Components.swift:DDayEditor (805-813), Models.swift:copyPreviousDDays (1346-1355) | 쉬움 · 데이터 완료 (planner.copyPreviousDDays) |
| DD-08 | D-day 표시 형식 | (읽기 전용) | 기준 날에서 센 "D-3" / "D-DAY" / "D+2". 제목이 비면 "D-day" 로 표시 | Models.swift:DDay.count (404-407), DailyPage.swift:ddayField (110) | 쉬움 · 데이터 완료 (planner.ddayCount) |
| DD-09 | 저장한 D-day 목록 관리 | 설정 → D-day: "D-day 저장" 버튼, 행의 제목 입력 · 날짜 달력 · 휴지통 | 새 항목은 오늘 +30일로 만들고 이름 칸에 포커스. 제목 안내 "무엇까지? (예: 런칭)". 휴지통은 "목록에서만 지워요. 이미 붙인 N일에는 그대로 남아요". 행마다 "n일 남았어요 / 바로 오늘이에요 / n일 지났어요" + "N일에 붙어 있어요", 오늘 D-day 미리보기 | Settings.swift:SettingsDDayPane (1519-1592), SettingsDDayRow (1594-1659), Models.swift:addLibraryDDay/editLibraryDDay/removeLibraryDDay (1359-1377) | 쉬움 · 데이터 완료 (planner.addLibraryDDay/editLibraryDDay/removeLibraryDDay) |
| DD-10 | 1.0.2 파일의 D-day 옮기기 | (자동, 책을 열 때) | 예전 파일 (ddaysPerDay 가 false 로 읽힘) 은 원본을 .before-per-day-dday.json 으로 남긴 뒤, 기록 있는 날과 오늘에 저장 목록 앞 2개를 복사해 붙이고 ddaysPerDay = true. 남기지 못하면 옮기지 않음 | Models.swift:readBookFile (982-998), migrateDDaysPerDay (1004-1027) | 쉬움 · 데이터 완료 (bookstore.loadBook, planner.migrateDDaysPerDay) |
| DD-11 | 옛 단일 D-day 읽기 | (자동) | prefs.ddayTitle · ddayDate 하나짜리 옛 형식은 id = UUIDv5 (URL 이름공간, "https://spiralday.com/ns/legacy-dday/날짜/제목") 로 저장 목록에 편입 — 두 기기가 읽어도 같은 id | Models.swift:Prefs.init (359-363), DDay.legacyID (390-392) | 쉬움 · 데이터 완료 (types.legacyDDayId) |

## 8. 형광펜 (분류 · 타임테이블 펜)

> 형광펜 = 이름 · 색 (hex) · TOTAL TIME 포함 여부 (counts). 두 가지 용도: 타임테이블 칠하기 (팔레트에서 고름) 와 할 일 분류 (할 일 왼쪽 칸에서 고름). 권마다 따로 저장 (settings 항목 perBook).

| ID | 동작 | 하는 법 | 결과 · 규칙 | 원본 위치 | Obsidian 이식 난이도 |
|---|---|---|---|---|---|
| HL-01 | 기본 형광펜 7종 · 개수 제한 | (자동) | 기본: 집중 업무 8EDCD2 · 미팅 F8B38A · 소통·메일 A9CFF3 · 기획 F3DB78 · 학습 CDB6EF (이상 TOTAL 포함), 개인 F6AEC5 · 휴식·이동 CFCFD4 (이상 TOTAL 미포함). 최대 12개 (Prefs.maxCategories), 읽은 파일에 0개이거나 12개 초과면 기본값으로 대체 | Models.swift:Prefs.defaultCategories (339-347), maxCategories (335), init (353-354) | 쉬움 · 데이터 완료 (types.defaultCategories, MAX_CATEGORIES) |
| HL-02 | 형광펜 추가 | 설정 → 형광펜의 "형광펜 추가" | 12개면 비활성 (툴팁 "형광펜은 12개까지 만들 수 있어요"). 새 id = 최대 id + 1, 이름 "새 형광펜" / "새 형광펜 n", 색은 후보 14개 중 이미 쓰는 색과 가중 RGB 거리가 가장 먼 것, TOTAL 포함. 목록 끝에 추가하고 스크롤 + 이름 칸 포커스 | Settings.swift:SettingsPensPane.add (1191-1199), SettingsPenColors (1361-1396), Models.swift:addCategory (1430-1435) | 쉬움 · 데이터 완료 (planner.addCategory) — 색 · 이름 제안은 미포팅 |
| HL-03 | 이름 바꾸기 | 설정 형광펜 행의 이름 칸 클릭 후 입력 | 즉시 반영. 비운 채 나가거나 Return 하면 "형광펜 n" (n = 순서) 으로 채움 | Settings.swift:SettingsPenRow (1248-1272, 1306-1309) | 쉬움 · 데이터 완료 (planner.updateCategory) |
| HL-04 | 색 바꾸기 | 형광펜 행의 색 선택기 | hex 로 저장 (투명도 없음), 이미 칠한 칸 · 할 일 · 홈 통계에 즉시 반영 | Settings.swift:SettingsPenRow (1281-1285) | 쉬움 · 데이터 완료 (planner.updateCategory) |
| HL-05 | TOTAL TIME 포함 토글 | 형광펜 행의 "TOTAL TIME에 포함" 체크 | 켜면 이 펜으로 칠한 시간이 하루 TOTAL TIME · 주간 합계 · 홈 합계에 더해짐. 끈 펜 (처음에는 개인 · 휴식·이동) 은 칠해도 안 더하고 홈에서 흐리게 | Settings.swift:SettingsPenRow (1273-1280), Models.swift:minutes (1447-1457) | 쉬움 · 데이터 완료 (planner.minutes) |
| HL-06 | 순서 바꾸기 | 형광펜 행 끌기 / 오른쪽 클릭 "위로 옮기기" "아래로 옮기기" | 목록 순서 = 팔레트 순서 = 숫자 키 1-7 (위에서 일곱 개, 행마다 키캡 표시) = 홈 막대 쌓는 순서 | Settings.swift:SettingsPensPane.move (1201-1208), SettingsPenRow contextMenu (1294-1299), Models.swift:moveCategories (1443-1445) | 쉬움 · 데이터 미포팅 (moveCategories) — 위 · 아래 버튼이면 충분, 끌기는 선택 |
| HL-07 | 형광펜 삭제 | 형광펜 행 휴지통 / 오른쪽 클릭 "지우기…" → 확인 | 최소 1개는 남김 (1개면 비활성). 확인 문구에 칠한 칸 시간과 분류한 할 일 수 안내. 삭제하면 그 펜으로 칠한 칸은 빈 칸 (-1), 그 색 할 일은 분류 없음으로 모든 날에서 정리 (빈 날은 레코드 제거). 현재 도구가 그 펜이면 첫 펜으로 전환 | Settings.swift:SettingsPensPane.delete (1220-1223), SettingsPenUsage (1339-1358), deleteMessage (1210-1218), Models.swift:removeCategory (1438-1441) | 쉬움 · 데이터 일부 (planner.removeCategory 완료, 칸 · 할 일 일괄 정리 미포팅) |
| HL-08 | 지운 형광펜 흔적 | (자동) | 파일에 남은 옛 id 로 칠한 칸은 빈 칸처럼 보이고 통계에서도 제외. 지울 때 일괄 정리하는 이유 = 나중에 같은 id 가 다시 생겨도 되살아나지 않게 | Components.swift:SlotPainter (562-568), HomeStats.swift:slot (101), Settings.swift:SettingsPenUsage (1337) | 쉬움 |

## 9. 컬러 컨셉

> 컬러 컨셉 9종 = 강조색 (accent) + 옅은색 (tint). 영향 범위: TOTAL TIME · 일간 날짜의 요일 · D-day 숫자 · 체크 표시 선 · 밥시간 화살표 · 표지 색 띠 · 홈의 숫자와 잔디.

| ID | 동작 | 하는 법 | 결과 · 규칙 | 원본 위치 | Obsidian 이식 난이도 |
|---|---|---|---|---|---|
| C-01 | 컬러 9종 정의 | (자동) | id 0-8: 체리 E0474C / F7C3C5 · 코랄 EE6F4F / FAD0C2 · 머스타드 D39A12 / F5E2A0 · 민트 23A08A / BDE8DD · 스카이 3A86D4 / C6DCF5 · 네이비 2E3D7C / C9CFE8 · 라벤더 8466CC / DCD1F4 · 핑크 DE5C8A / F8CADB · 차콜 3A3940 / DAD8D2 (accent / tint). 범위 밖 id 는 가장 가까운 컬러로 보정 | Theme.swift:ColorConcept.all (146-158) | 쉬움 · 데이터 미포팅 (상수) — Obsidian 테마 변수와 별도로 상수 이식 |
| C-02 | 기본 컬러 정하기 | 설정 → 컬러 컨셉의 카드 클릭 | 3열 카드 (미리보기 "0929 TUE" + TOTAL "8H36M"), 선택 시 prefs.defaultTheme. 따로 고르지 않은 모든 날이 따라감 | Settings.swift:SettingsConceptPane (1400-1433), Models.swift:editPrefs (1294) | 쉬움 · 데이터 완료 (planner.editPrefs defaultTheme) |
| C-03 | 하루만 컬러 바꾸기 | 일간에서 팔레트 "오늘의 컬러" 선택 | 그날 theme 에만 저장 (P-06 과 같은 동작). 기본 컬러와 같은 색을 고르면 해제 | Palette.swift:ConceptPicker (1226-1230), Models.swift:setTheme (1412) | 쉬움 · 데이터 완료 (planner.setTheme) |
| C-04 | 모두 기본 컬러로 되돌리기 | 설정 → 컬러 컨셉의 "모두 기본 컬러로…" → 확인 | "따로 컬러를 고른 날" 수 표시 (0이면 비활성). 확인하면 모든 날의 theme 를 지우고 비게 된 날 레코드는 삭제 | Settings.swift:SettingsConceptPane (1435-1465) | 쉬움 · 데이터 미포팅 |
| C-05 | 책 표지 색 고르기 | 책 만들기 / 편집 시트의 표지 색 줄 | 표지는 ColorConcept 의 accent 사용 (책 id 와 별개로 cover 번호 저장), 툴팁에 컬러 이름 | Settings.swift:SettingsCoverPicker (1005-1029), FrontMatter.swift:CoverPage (174) | 쉬움 |

## 10. PDF 로 뽑기

> 페이지를 SwiftUI 뷰 그대로 PDF 에 그려 글씨 · 선이 벡터로 남음 (PDFExporter). 화면 전용 요소 (COMMENT ▾, "+ D-day" 안내, 분류 칸, 빈 첫 장 안내) 는 isPrinting 으로 제외. 용지 크기: A4 세로 595.28×841.89pt, 가로 841.89×595.28pt, 가장자리 여백 16pt.

| ID | 동작 | 하는 법 | 결과 · 규칙 | 원본 위치 | Obsidian 이식 난이도 |
|---|---|---|---|---|---|
| PDF-01 | PDF 화면 열기 | ⌘P / 플래너 메뉴 "PDF로 내보내기…" / 설정 → PDF로 뽑기 | 전용 창 (520×560) 과 설정 항목이 같은 화면 (PDFExportView) 을 씀. 열릴 때 지금 보는 쪽 종류 · 지금 페이지로 기간을 채움 | PDFExportWindow.swift:PDFExportWindowController (8-27), PDFExportView.onAppear (139-144), App.swift:commands (55-58) | 쉬움 — 모달 / 설정 섹션 |
| PDF-02 | 종류 · 용지 고르기 | "일간" "주간" "홈" 분할 버튼, 일간이면 용지 라디오 | 일간: "A4 반쪽 · 두 장씩" (기본, A4 가로 한 장에 이틀) 또는 "A4 세로 · 하루 한 장". 주간 = A4 가로 한 주 한 장, 홈 = A4 가로 1장 (오늘 기준). 각 레이아웃 설명문 표시 | PDFExport.swift:PDFLayout (18-55), PDFExportWindow.swift:body (68-96) | 쉬움 |
| PDF-03 | 기간 고르기 | "부터" / "까지" 달력 + 빠른 버튼 "지금 페이지" "이번 주" (일간) / "이번 달" (주간) "기록한 날 전체" | 날짜는 책 기간 안으로 보정 (종료일이 없으면 시작일·오늘 중 늦은 날 +1년까지). 앞뒤가 뒤집혀도 min / max 로 정렬. 주간은 월요일 단위로 맞춰 "M/D 주부터 M/D 주까지". "기록한 날 전체" = 기록이 있는 첫 날 ~ 마지막 날 (D-day 만 붙인 날 제외, hasRecord 기준) | PDFExportWindow.swift:bookRange (56-61), current/thisSpan/recorded (153-179), PDFExport.swift:pages (63-76) | 쉬움 |
| PDF-04 | 표지 · 첫 장 포함 | "표지와 첫 장 넣기" 토글 (기본 켬) | 일간 · 주간에서 펼친 책이 있을 때만 표시. 맨 앞에 표지, 그다음 첫 장 (A4 반쪽이면 첫 장에 둘이 나란히) | PDFExport.swift:canIncludeFront (83-85), export (98-101), PDFExportWindow.swift:body (86-92) | 보통 — 앞 장 렌더 재사용 |
| PDF-05 | 반쪽 자르는 선 | "가운데 자르는 선 넣기" 토글 (A4 반쪽일 때만, 기본 켬) | 용지 가운데 세로 점선 (0.5pt, 3-3) + 위아래 8pt 눈금. 가운데를 따라 자르면 실물 플래너 크기 | PDFExport.swift:drawCutGuide (178-199), slot (132-141) | 보통 — CSS 인쇄 레이아웃에 포함 |
| PDF-06 | 요약 문구 · 쪽 수 | (읽기 전용) | 예: "표지·첫 장 + N일 · A4 가로 M장 (두 장씩)", "N주 · A4 가로 M장", "A4 가로 1장". 안내 "기록이 없는 날은 빈 양식으로 나와요. 인쇄해서 종이로도 쓸 수 있어요." | PDFExportWindow.swift:summary (190-197), PDFExport.swift:sheetCount (78-80) | 쉬움 |
| PDF-07 | PDF 만들기 | "PDF 만들기…" → 저장 위치 선택 | 편집 중이면 먼저 종료. 기본 파일명 "책이름 일간(A4 반쪽) yyyyMMdd-yyyyMMdd.pdf" / "책이름 주간 …" / "책이름 홈.pdf". 쪽마다 진행률 (한 장 끝날 때마다 양보), 끝나면 파일 열기. 실패 시 "PDF를 만들지 못했어요: …". PDF 제목 = "책이름 — 레이아웃" | PDFExportWindow.swift:make (213-231), fileName (199-211), PDFExport.swift:export (95-129) | 어려움 — 벡터 PDF 생성은 데스크톱 인쇄 / Electron 기능에 의존하고 모바일은 불가 (추정). A4 반쪽 배치 · 쪽 나눔을 인쇄 CSS 로 직접 구현 |

## 11. 설정

> 설정 창 (720×560, 최소 680×460) 은 사이드바 10개 항목: 플래너 · 형광펜 · 컬러 컨셉 · D-day · PDF로 뽑기 · 팔레트 · 단축키 · 튜토리얼 · 데이터 · 동기화. 마지막으로 본 항목을 기억 (settingsPane). 형광펜 · 컬러 컨셉 · D-day 는 펼친 책마다 따로, 나머지는 앱 전체. 항목별 동작은 각 절 (6-10절, 14-16절) 에 있고 여기에는 창 자체와 데이터 항목만.

| ID | 동작 | 하는 법 | 결과 · 규칙 | 원본 위치 | Obsidian 이식 난이도 |
|---|---|---|---|---|---|
| S-01 | 설정 열기 | ⌘, / 팔레트 톱니 / 도움말 "튜토리얼 모음…" | 새로 열 때 첫 입력 칸이 자동 선택돼 이름이 반전되지 않도록 포커스 해제. 창 위치 · 크기 기억. 둘러보는 중에는 열리지 않음 (비프음) | Settings.swift:SettingsWindowController (12-88), SettingsView (185-229) | 쉬움 — Obsidian PluginSettingTab 또는 모달 |
| S-02 | 항목이 책별인지 알림 | (읽기 전용) | 책별 항목 (형광펜 · 컬러 컨셉 · D-day) 머리에 캡슐 "지금 펼친 ‘책이름’에만 적용돼요", 툴팁 "플래너마다 형광펜, 기본 컬러, D-day 가 따로 있어요. 다른 플래너를 펼치면 그 플래너의 설정이 보여요." | Settings.swift:SettingsBookScope (2343-2362), SettingsPane.perBook (182) | 쉬움 |
| S-03 | 단축키 안내 보기 | 설정 → 단축키 | 읽기 전용 표: ← → (⌘[ ⌘]) 이전 · 다음 장, T (⌘T) 오늘, H · W · D (⌘0 · ⌘1 · ⌘2), ⌘\ 팔레트 접기, 1-7 형광펜 (현재 펜 이름과 색 표시), E 지우개, esc 글쓰기 마치기, ⌘, 설정. 꼬리말 "한글 입력 상태에서도 그대로 동작해요. 글자를 쓰는 동안에는 글자·숫자 단축키가 잠시 쉬어요." | Settings.swift:SettingsShortcutsPane (1714-1782) | 쉬움 |
| S-04 | 데이터 위치 · 상태 보기 | 설정 → 데이터 | 저장 폴더 경로 (홈은 ~ 로 줄임, 선택해 복사 가능), "플래너 파일: books 폴더에 한 권당 하나씩 · N권", 마지막 저장 "크기 · M월 d일 a h:mm" (5초마다 갱신), 메모리 전용 (데모) 일 때 "저장하지 않음" | Settings.swift:SettingsDataPane (1978-2005), SettingsDataFile.summary (2212-2217) | 쉬움 |
| S-05 | 폴더를 파인더에서 열기 | "Finder에서 보기" 클릭 | 데이터 폴더를 OS 파일 관리자로 열기 | Settings.swift:SettingsDataPane (2007-2009), SettingsDataFile.reveal (2220-2222) | 불가 — OS 파일 관리자 호출은 모바일에서 불가. 대체 = 볼트 안 폴더 경로 표시 |
| S-06 | 백업 내보내기 | "백업 내보내기…" → 저장 패널 | 지금 펼친 책 한 권의 파일을 JSON 하나로 복사 (저장 전 saveNow, 파일이 없으면 지금 내용을 인코딩). 기본 이름 "Spiralday 백업 - 책이름 yyyy-MM-dd.json" (이름의 / : \ 줄바꿈 탭은 "-"). 결과 줄 "<파일> 저장됨" 클릭 시 파인더에서 표시 | Settings.swift:SettingsDataPane.export (2105-2127), SettingsDataFile.backupName (2225-2231) | 보통 — 볼트 안 폴더에 복사하는 쪽이 모바일에서도 가능, 외부 저장 패널은 데스크톱 한정 (추정) |
| S-07 | 백업 가져오기 | "백업 가져오기…" → 파일 선택 | 백업 JSON 을 새 플래너로 되살려 펼침 (기존 책은 그대로). 이름 = 파일명에서 복원 ("Spiralday 백업 - " · 옛 "PaperPlanner 백업 - " 접두와 날짜 꼬리 제거), 같은 이름이 있으면 " (백업)". 시작일 = 가장 이른 기록 날 (없으면 오늘), 종료일 없음, 표지 = 안 쓴 색. 1.0.2 이전이면 D-day 옮기고 줄 없는 할 일에 줄 매김. 실패 시 "Spiralday 백업 파일이 아니라서 가져오지 못했어요." | Settings.swift:SettingsDataPane.importBackup (2130-2145), SettingsDataFile.restore (2247-2263), bookName (2234-2243) | 보통 · 데이터 일부 (decodeData · migrate · assignTaskRows 완료, 새 책 만들기 + 데이터 주입 흐름 미포팅) |
| S-08 | 기록 요약 보기 | 설정 → 데이터 | "기록한 날 N일" "적은 할 일 N개" "칠한 시간 H시간 M분" (현재 존재하는 형광펜 칸만). 기록한 날 = hasRecord 기준 | Settings.swift:SettingsDataPane (2030-2037), SettingsDataFile.stats (2278-2287) | 쉬움 · 데이터 완료 (planner.recordedDayCount) |
| S-09 | 익명 사용 통계 | 설정 → 데이터의 "익명 사용 통계 보내기" 토글 | 하루 한 번 앱 버전 · macOS 버전 · 칩 · 언어 + 무작위 설치 번호만 전송 (기본 켬). 설치 번호 표시 · 선택 복사, "개인정보 처리방침" 링크 | Telemetry.swift:Telemetry (1-40), Settings.swift:SettingsDataPane (2039-2066) | 불가 — Obsidian 플러그인에서 외부 전송형 통계는 정책상 부적합 (추정). 이식 제외 |
| S-10 | 정보 · 라이선스 보기 | 설정 → 데이터의 "정보" | 버전, 손글씨 글꼴 "Poor Story · SIL OFL 1.1", 오픈소스 목록과 "고지 보기…" | Settings.swift:SettingsDataPane (2085-2100) | 쉬움 — NOTICE.md 와 글꼴 라이선스 표기 |
| S-11 | 설정 창 중 플래너 입력 분리 | (자동) | 설정 · PDF · 업데이트 창 · 팝오버가 키 입력 창일 때는 플래너 단축키 · 스크롤을 받지 않음. 설정 창은 닫으면 포커스가 플래너로 돌아감 | DesktopInput.swift:plannerTakesKey (86-89), plannerTakesScroll (97-99), Settings.swift:SettingsPanel (91) | 보통 — 키 이벤트를 뷰 포커스 범위로 한정 |

## 12. 앱 창 · 메뉴바 (맥 셸)

> 이 절은 SpiraldayKit 밖의 앱 계층 (Sources/Spiralday). Obsidian 은 탭 안의 뷰라 창 · 메뉴바 · 별도 패널 관련 동작은 대부분 대체안으로만 이식 가능.

| ID | 동작 | 하는 법 | 결과 · 규칙 | 원본 위치 | Obsidian 이식 난이도 |
|---|---|---|---|---|---|
| A-01 | 창 = 종이 한 장 | (자동) | 제목 막대 투명, 신호등 버튼이 종이 왼쪽 위. 창 비율 고정 (일간 1277:2000, 주간 · 홈 2000:1277), 최소 크기 (일간 358×560, 주간 860×549), 쪽 종류별 창 크기 기억 (contentSize.*), 종이는 늘 밝게. 기본 크기는 화면 높이의 90% 이내 + 팔레트 자리 제외 | WindowController.swift:MainWindowController.init (28-70), applyConstraints (165-168), defaultContentSize (170-190) | 불가 — 창 크기 · 비율 통제 불가. 대체 = 뷰 컨테이너가 탭 크기에 맞춰 같은 비율로 스케일 (쉬움~보통) |
| A-02 | 쪽 종류 전환 시 창 변형 | (자동, 일간 ↔ 주간 · 홈) | 내용을 0.14초 페이드 → 창이 0.46초 동안 새 비율로 변형 (윗변 고정, 화면 · 팔레트 자리 안으로 보정) → 새 쪽이 0.24초 페이드 인 | WindowController.swift:morph (258-294) | 불가 — 창 변형 불가. 대체 = 뷰 안 CSS 전환 |
| A-03 | 초록 버튼 확대 | 창 확대 버튼 클릭 | 페이지 비율을 지키면서 화면에 들어가는 가장 큰 크기 (팔레트 자리 제외) | WindowController.swift:windowWillUseStandardFrame (299-320) | 불가 — 네이티브 창 제어. 대체 = 해당 없음 (탭을 키우면 됨) |
| A-04 | 창 밖 스프링 링 | (자동) | 종이 가장자리 (일간 왼쪽, 주간 · 홈 위) 의 구멍과 창 밖으로 나오는 쌍 금속 고리. 넘어가는 종이가 고리를 덮도록 종이 위 앞 가닥은 넘김 스냅샷에 구움 | Rings.swift:RingStrip (27-), RingWindow.swift (1-210), WindowController.swift:rings (69) | 불가 — 창 밖 요소. 대체 = 뷰 안 장식 (쉬움, 선택) |
| A-05 | 창 제목 갱신 | (자동, 쪽을 옮길 때) | "책이름 — yyyy년 M월 d일 EEEE" (일간) / "책이름 — yyyy년 M월 d일 – d일 · n주차" (주간, 월이 다르면 양쪽 월 표시) / "책이름 — Spiralday — 홈" / "책이름 — 표지" · "첫 장". 날짜는 종이에 직접 쓰므로 창 제목은 숨김 | WindowController.swift:updateTitle (138-161) | 쉬움 — 뷰 탭 제목 (getDisplayText) |
| A-06 | 플래너 메뉴 명령 | 메뉴바 "플래너" | 주간 보기 ⌘1, 일간 보기 ⌘2, 홈 (통계) ⌘0, 팔레트 접기 / 펼치기 ⌘\, 이전 장 ⌘[, 다음 장 ⌘], 오늘 ⌘T, PDF로 내보내기… ⌘P, 지금 맞추기 ⇧⌘S, 이 날 / 이 주의 이전 버전…, 동기화 설정…. 둘러보는 중에는 쉬거나 비프음 | App.swift:SpiraldayApp.commands (43-63), Sync/SyncIndicatorViews.swift:SyncMenuItems (93-125) | 쉬움 — 네이티브 메뉴바는 불가이므로 Obsidian 명령 (addCommand) 으로 대체, 단축키는 사용자가 지정 |
| A-07 | 앱 · 도움말 메뉴 | 메뉴바 "Spiralday" / "도움말" | 업데이트 확인…, 설정… ⌘,, 도움말: 플래너 둘러보기, 튜토리얼 모음…, Spiralday 웹사이트, 버그 신고 · 기능 제안…, GitHub (오픈소스), GitHub에서 별 주기 (원문은 별 이모지 포함), 개인정보 처리방침, 린에자일헝그리 | App.swift:SpiraldayApp.commands (15-41) | 불가 — 네이티브 메뉴바. 대체 = 명령 팔레트 몇 개 (둘러보기 · 설정 열기), 외부 링크는 제외 |
| A-08 | 자동 업데이트 (Sparkle) | 앱 메뉴 "업데이트 확인…" / 하루 한 번 자동 | 서명 확인 후 설치. 개발 · 데모 실행에서는 꺼짐 | App.swift:AppDelegate.applicationDidFinishLaunching (310-313), checkForUpdates (95) | 불가 — Obsidian 커뮤니티 플러그인 업데이트 체계 사용 |
| A-09 | 닫으면 저장 후 종료 | 창 닫기 / 앱 종료 | 창을 닫으면 즉시 저장하고 앱 종료. 동기화 중이면 마무리 후 종료. iOS 는 백그라운드 진입 시 저장 | WindowController.swift:windowWillClose (392-395), App.swift:applicationShouldTerminate (369-373), Models.swift:init (739-751) | 쉬움 · 데이터 완료 (main.onunload flush) |
| A-10 | 손글씨 글꼴 준비 후 다시 그림 | (자동) | 글꼴 등록이 끝나면 fontsReady 를 올려 이미 그린 화면을 다시 그림. 글꼴은 Poor Story (OFL) | App.swift:applicationDidFinishLaunching (337-338), Settings.swift:SettingsConceptPane (1424) | 쉬움 — document.fonts.ready 후 재그리기 |
| A-11 | 개발 · 점검 실행 인자 | --demo --snapshot --pdf-test --tour-test --palette-test --sample-book-test --load-safety-test --sync-qa 등 | 샘플 데이터 · PNG 출력 · 시험용 흐름. 사용자 기능이 아님 | App.swift:AppDelegate.init (125-139), applicationDidFinishLaunching (178-300) | 쉬움 — 이식 대상 아님 (제외) |
| A-12 | 뷰 비율 맞춤 (A-01 의 대체) | (자동) | 신규 설계: 일간 1277:2000 / 주간 · 홈 2000:1277 비율을 탭 (뷰) 크기에 맞춰 u = 폭 ÷ 디자인 폭 으로 스케일하고, 좁은 탭에서는 최소 크기 (일간 358×560, 주간 860×549 단위를 참고) 이하로 줄이지 않고 스크롤. 원본 동작이 아니라 A-01 · A-03 의 대체 | WindowController.swift:applyConstraints (165-168), PageView.swift:PageView (21-22) | 보통 — 디자인 단위 좌표를 u 로 환산하는 레이아웃 래퍼, 모바일 세로 폭 대응 포함 |

## 13. 키보드 · 제스처

> 키는 플래너 창 (또는 딸린 팔레트) 에서만, 글 칸 · 한글 조합 · 날짜 선택기가 입력을 받는 중에는 양보. ⌘ ⌃ ⌥ 가 눌려 있으면 글자 단축키 무시. 한글 입력 상태에서도 글자 키는 자모와 물리 키 코드 둘 다 확인. 순수 함수는 DesktopInput.swift (공유 벡터 Tests/Fixtures/desktop-turn-input.json).

| ID | 동작 | 하는 법 | 결과 · 규칙 | 원본 위치 | Obsidian 이식 난이도 |
|---|---|---|---|---|---|
| K-01 | 이전 · 다음 장 키 | ← / → (메뉴 ⌘[ / ⌘]) | 일간 · 주간에서 한 장씩. 책 범위 끝이면 넘기지 않고 트랙패드 진동 | AppState.swift:handleKey (455-460), flip (246-251), DesktopInput.turn (55-62) | 쉬움 |
| K-02 | 위가 묶인 쪽의 세로 키 | ↑ ↓ / PageUp PageDown (fn+↑ ↓) | 스프링이 위에 있는 쪽 (주간 · 홈) 에서만: ↑ · PageUp = 이전, ↓ · PageDown = 다음. 일간에서는 키를 가로채지 않음. 홈은 한 장뿐이라 키를 먹고 아무 일도 하지 않음 | DesktopInput.swift:turn (55-62), AppState.swift:turnKey (476-486) | 쉬움 |
| K-03 | 오늘 키 | T / ㅅ / ⌘T | goToday (P-04 와 같음) | AppState.swift:handleKey (448), KeyShortcut (360-377) | 쉬움 |
| K-04 | 보기 전환 키 | W · D · H (한글 ㅈ · ㅇ · ㅗ) / ⌘1 · ⌘2 · ⌘0 | 주간 · 일간 · 홈 전환 (P-02) | AppState.swift:handleKey (449-451), KeyShortcut (360-377) | 쉬움 |
| K-05 | 도구 키 | E (ㄷ) 지우개, 1-7 형광펜 | 숫자 키 = 팔레트 순서의 n번째 펜 (그 순서의 펜이 없으면 무시). 접힌 팔레트면 1.2초 펼쳐 보여 줌. 물리 키 코드 맵: 18 19 20 21 23 22 26 → 1-7 | AppState.swift:perform (381-395), handleKey (452-471), pickTool (353-356) | 쉬움 |
| K-06 | 쓰기 마치기 | Esc | 플래너 창 · 팔레트에서의 Esc 는 쓰던 글을 마침 (글 칸이 받던 Esc 는 소비). 다른 창의 Esc 는 그 창 몫 | AppState.swift:handleKey (438-443), DesktopInput.escEndsEditing (92-94) | 쉬움 |
| K-07 | 글 쓰는 중 단축키 양보 | 글 칸 입력 중 / 한글 조합 중 / 날짜 선택기 조작 중 | 글자 · 숫자 · 화살표 단축키 쉼. responder = none 일 때만 플래너 단축키 | DesktopInput.swift:plannerTakesKey (86-89), AppState.inputResponder (421-427) | 보통 — 포커스 중인 요소 판정 + IME 조합 (compositionstart) 처리 |
| K-08 | 한글 입력 상태 단축키 | 한글 자판으로 ㅅ ㅈ ㅇ ㅗ ㄷ | 자모 문자와 물리 키 코드 모두 매핑해서 한글 상태에서도 동작 | AppState.swift:KeyShortcut.init (366-376), handleKey (446-472) | 보통 — event.key 가 IME 상태에서 달라져 event.code 병행 (추정) |
| K-09 | 두 손가락 가로 쓸기 | 트랙패드 / 매직 마우스 가로 스크롤 | 종이 어디서나 종이를 잡고 넘김 (왼쪽으로 쓸면 다음). 한 손짓의 첫 움직임에서 한 축이 다른 축의 1.2배를 넘고 0.5pt 이상이면 그 축으로 확정, 남은 이벤트와 관성 이벤트는 먹음. 시스템 "자연스러운 스크롤" 설정을 반영해 손가락 방향으로 환산 | DesktopInput.swift:swipeAxis (32-36), DesktopSwipeTracker (104-166), AppState.swift:handleScroll (490-514) | 보통 — wheel 이벤트 deltaX 기준의 한 번 넘김으로 이식 (종이 따라오는 물리는 제외) |
| K-10 | 두 손가락 세로 쓸기 | 트랙패드 세로 스크롤 (주간 · 홈만) | 위로 쓸면 다음 장. 일간에서는 넘기지 않고 스크롤에 맡김. 가로 쓸기도 그대로 유지 | DesktopInput.swift:swipeAxis (33-35), turnDelta (39-41) | 보통 |
| K-11 | 일반 마우스 휠 | 가로 휠 | 단계 없는 휠은 가로 이동량이 2 를 넘고 세로 이동량보다 클 때 한 장 (세로 휠은 안 넘김, Mac 기준. Windows 는 주간 세로 휠을 넘김으로 보는 별도 벡터가 있음) | DesktopInput.swift:wheelStep (24), DesktopSwipeTracker.handle .none (135-139) | 쉬움 |
| K-12 | 모서리 클릭 넘기기 | 종이 아래 두 모서리 클릭 | 앞 모서리 = 다음 장, 뒤 모서리 = 이전 장. 영역: 일간 150×104 (뒤 모서리는 스프링 옆 28 단위부터), 주간 150×58 디자인 단위. 툴팁 "다음 장 (→)" / "이전 장 (←)" | PageView.swift:CornerZones (124-174) | 쉬움 |
| K-13 | 모서리 호버 들림 · 잡고 끌어 넘기기 | 모서리에 마우스 올림 / 모서리를 잡고 끌기 | 올리면 모서리가 살짝 들림 (dog-ear), 3pt 이상 끌면 종이가 손가락을 따라 말리고 놓을 때 위치와 속도 (fling) 로 넘김 / 되돌림 판정 | PageView.swift:CornerZones.zone (143-166), Curl/CurlController.swift:hover/dragBegan/dragChanged/dragEnded (227-285) | 불가 — Metal 종이 말림 물리. 대체 = 클릭 · 스와이프 이산 넘김 |
| K-14 | 종이 말림 넘김 애니메이션 | (넘길 때마다) | 원통형 말림 모델을 픽셀 셰이더로 계산 (뒷면 비침 · 그림자 · 스프링 물리). 연타하면 하나만 대기시키고 지금 장은 빨리 끝냄. 넘김 중 / 창 변형 중에는 입력 잠금 | Curl/CurlController.swift:flip (199-224), CurlShader.swift, CurlPhysics.swift, AppState.swift:flip (246-251) | 불가 — Metal 셰이더. 대체 = 슬라이드 / 페이드 (선택) |
| K-15 | 끝에서 진동 | 첫 장 앞 / 마지막 장 뒤로 넘기려 할 때 | 트랙패드 햅틱 (levelChange). iOS 는 경고 진동 | AppState.swift:bump (192-194), Platform.swift:Haptics (67-132) | 불가 — 데스크톱 햅틱 API 없음 (모바일 일부는 추정). 제외 |
| K-16 | 툴팁 (도움말 문구) | 마우스를 올림 | 거의 모든 컨트롤에 한국어 도움말 (예: "이 날의 D-day — 저장한 D-day 를 고르거나 새로 만들어 붙여요 (최대 2개)") | DailyPage.swift:ddayField (126), Components.swift:MarkButton (230), Palette.swift (여러 곳) | 쉬움 — title / aria-label |
| K-17 | 모바일 터치 동작 | 손가락 스와이프 · 탭 · 길게 누르기 | 원본 Mac 앱에는 터치 규칙이 없음 (iOS 앱은 별도 앱 계층, 이번 읽은 범위 밖). Obsidian 모바일용 넘기기 · 칠하기 · 메뉴 호출은 새로 설계해야 함 | Platform.swift (iOS 분기), AppState.swift:#if os(macOS) (67-74) | 보통 — 신규 설계 (스크롤과 칠하기 드래그 충돌 처리 포함, 추정) |

## 14. 데이터 안전 · 저장

> 원칙: 읽지 못한 파일은 절대 덮어쓰지 않고, 쓰기는 모두 임시 파일에 다 쓴 뒤 이름 바꾸기. M0 데이터 계층 (src/storage/bookstore.ts) 이 이미 상당 부분 옮겨 둠.

| ID | 동작 | 하는 법 | 결과 · 규칙 | 원본 위치 | Obsidian 이식 난이도 |
|---|---|---|---|---|---|
| DS-01 | 자동 저장 | (입력할 때마다) | 변경은 메모리에 즉시 반영하고 0.6초 묶음 뒤 파일에 저장 (scheduleSave). 책 바꾸기 · 앱 종료 · (iOS) 백그라운드 진입은 즉시 저장 (saveNow). 파일은 같은 폴더의 임시 파일에 다 쓴 뒤 이름 바꿔 교체 | Models.swift:scheduleSave (1194-1221), saveNow (1232-1242), writeNewFile (893-902) | 쉬움 · 데이터 완료 (main.scheduleSave 600ms, bookstore.writeAtomic) — 참고: TS writeAtomic 은 기존 파일을 지운 뒤 이름을 바꾸는 순서라 완전 원자적이지 않음 (그래서 .tmp 복구 읽기가 있음) |
| DS-02 | 파일 구성 · 형식 호환 | (자동) | library.json (책 목록 · 펼친 책 · 예시 꽂음 여부) + books/<ID>.json. 키 정렬 JSON, 날짜 ISO-8601 (UTC "Z"). 빠진 키는 읽을 때 기본값, 비어 있으면 쓰지 않는 키 (ddays · dayOff · mottoText · isSample · carriedFrom · row). slots 는 144칸으로 보정, 형광펜 0개 또는 12개 초과면 기본값 | Models.swift:DayRecord Codable (90-123), BookInfo Codable (523-545), Prefs.init (351-367), enc (677-682) | 쉬움 · 데이터 완료 (types.decode*/encode*, stableStringify) |
| DS-03 | 읽지 못한 파일 보존 | (켤 때 / 책을 펼칠 때) | 책 파일 · library.json 이 있는데 읽지 못하면 (깨짐 · 모르는 형식 · 권한 없음) 원본은 손대지 않고 옆에 "<파일>.unreadable-yyyyMMdd-HHmmss.json" 복사본을 남김 (같은 내용 복사본이 이미 있으면 재사용, 임시 이름으로 복사 후 이름 변경, 있는 파일은 덮어쓰지 않음). 실행 중 그 원본에는 아무것도 쓰지 않음 (saveNow · writeLibrary 가 건너뜀) | Models.swift:preserveUnreadable (860-883), unreadableCopyName (840-845), loadBook (930-952), saveNow (1232-1242) | 보통 · 데이터 일부 (bookstore.preserve · unreadableBooks · 쓰기 건너뜀 완료; 같은 내용 복사본 재사용 미포팅) |
| DS-04 | 읽지 못할 때 다른 책 펼치기 | (자동) | 켤 때 펼치려던 책을 읽지 못하면 다른 책 — 내가 만든 책 먼저, 없으면 예시, 읽지 못한 책은 건너뜀. 읽을 수 있는 책이 하나도 없으면 새 플래너를 만들어 폄 ("새 플래너" / "새 플래너 n", 안 쓴 표지 색) — 적은 것이 어디에도 저장되지 않는 일을 막음. 사용 중 읽지 못하는 책을 고르면 펼치지 않고 지금 책 그대로 | Models.swift:openActiveBook (808-825), openFreshBookIfNothingReadable (831-837), activate (1086-1093), fallbackBook (672-675) | 보통 · 데이터 미포팅 |
| DS-05 | 읽지 못한 파일 알림 | (켤 때 1회 / 읽지 못하는 책을 펼치려 할 때마다) | 경고 대화상자. 제목: "플래너 목록 파일을 열지 못했어요" / "‘이름’을 열지 못했어요" / "플래너 파일 N개를 열지 못했어요". 본문: 까닭, 원본 경로, 복사본 경로, "원본 파일은 손대지 않았고, 아무것도 덮어쓰지 않았어요. 앱을 쓰는 동안 그 파일에는 저장하지 않아요.", 대신 펼친 책, 해결 안내. 버튼 "확인" / "폴더 열기" | DataSafety.swift:DataSafetyAlert (24-60), DataSafetyText.swift:launchText/refusedText (11-44), Josa (73-101) | 쉬움 — 문구와 조사 함수 그대로 이식, "폴더 열기" 는 데스크톱 한정 |
| DS-06 | 책장을 읽지 못할 때 임시 책장 | (자동) | library.json 을 읽지 못하면 books 폴더의 읽을 수 있는 파일마다 한 권으로 책장을 메모리에서만 꾸밈 ("되찾은 플래너" / "되찾은 플래너 n"; 시작일 = 가장 이른 기록 날, 기록이 없으면 파일 생성일 (오늘 이후면 오늘); 끝없음; 표지는 순서대로), 가장 최근에 저장한 책을 펼침. library.json 에는 쓰지 않으므로 이름 · 표지 · 기간을 바꾼 것은 저장되지 않고 예시 플래너도 꽂지 않음 | Models.swift:recoveredLibrary (780-803), loadLibrary (759-774), seedSampleBookIfNeeded (1155) | 보통 · 데이터 미포팅 |
| DS-07 | 밖에서 바뀐 파일 반영 | (동기화 · 클라우드 · 다른 기기가 책 파일을 바꿈) | 합친 내용을 메모리에 넣고 바로 저장. 쓰는 칸 (할 일 · 타임테이블 메모 · COMMENT · 메모 · 꼬리표 · 주간 목표 · 첫 장 말) 은 마지막으로 고친 뒤 5초 (editingGrace) 안이면 화면의 글을 유지, 포커스만 있고 안 쓴 칸은 새 글 수용. 쓰던 할 일 · 메모가 밖에서 지워졌으면 되살리지 않고 편집 종료. lastKind · ddaysPerDay 는 이 기기 값 유지. 펼친 책이 밖에서 빠지면 다른 책을 폄. 칸마다 3자 비교 (base · mine · theirs) 로 다른 기기의 다른 칸 편집을 보존 | ExternalChanges.swift:applyLibrary (96-146), applyActiveData (152-190), applyActiveChange (192-219), noteEditingField (221-230), isTyping (231-241), rebased (431-) | 어려움 · 데이터 미포팅 — 3자 병합 규칙 + 쓰는 칸 보호. Obsidian Sync · iCloud 가 파일을 바꾸므로 필요. M1 은 단순판 (편집 중이 아니면 다시 읽기, 편집 중이면 저장 보류 후 경고) 으로 시작 권장 (추정) |
| DS-08 | 옛 기록의 할 일 줄 매김 | (자동, 책을 열 때) | row 가 없는 할 일은 그때 보이던 대로 줄을 매김 (같은 형광펜끼리 모은 순서, 긴 할 일이 이어 쓰던 줄까지). 일부만 없거나 겹치면 있는 것은 그대로, 나머지는 위 빈 줄부터. 메모리에서 바꾸고 다음 저장 때 파일에 적음 | Models.swift:assignTaskRows (176-202), loadBook (950), grouped (1462-1470) | 쉬움 · 데이터 완료 (day.assignTaskRows, legacyTaskRows, grouped) |
| DS-09 | 옛 파일 · 폴더 옮기기 | (자동, 옛 버전 사용자만) | planner.json 한 권짜리를 "내 플래너" 로 옮기고 planner.json.backup 으로 남김. 옛 이름 폴더 PaperPlanner 가 있고 새 폴더가 없으면 복사. Obsidian 신규 사용자에게는 해당 없음 | Models.swift:migrateLegacy (1030-1040), migrateFolder (905-909) | 쉬움 — 이식 제외 |

## 15. 동기화 (Spiralday Sync)

> 있다는 것과 사용자 동작만 기록. 엔진 · 프로토콜 (Sources/SpiraldaySync) 과 Sources/Spiralday/Sync 의 연결 코드는 읽지 않고, 버튼 · 메뉴 이름만 확인. 종단간 암호화 · 계정 없음 · 서버 sync.spiralday.com 은 암호문 · 불투명 id · 순번만 봄 (README.md "동기화" 절). Obsidian 에서는 볼트 동기화 (Obsidian Sync · iCloud · Git 등) 가 대신하므로 전부 불가 / 보류, 대신 14절 DS-07 이 필요.

| ID | 동작 | 하는 법 | 결과 · 규칙 | 원본 위치 | Obsidian 이식 난이도 |
|---|---|---|---|---|---|
| SY-01 | 동기화 켜기 | 설정 → 동기화 → "이 Mac 에서 시작하기" | 기본은 꺼짐 (켜기 전에는 키체인 · 네트워크를 건드리지 않음). 켜면 복구 코드를 보여 줌 (복사 · 텍스트 파일 · 인쇄 → 두 묶음을 다시 입력해 확인, 복사한 코드는 1분 뒤 클립보드에서 지움). 열쇠는 로그인 키체인 (com.spiralday.sync), 상태는 SyncState 폴더 | README.md (동기화 절), Sync/SyncSettingsPane.swift, Sync/SyncFlows.swift | 불가 — 서버 · 키체인 · 암호 프로토콜 의존. 대체 = 볼트 동기화 |
| SY-02 | 기기 추가 · 합류 | 기존 기기 "기기 추가" → 새 기기에서 QR 또는 8자리 코드 입력 | 연결 코드 (QR / 8자리, "연결 글 복사" 가능) 를 만들고, 새 기기 화면의 숫자 4자리를 원래 기기에 입력해야 그룹 열쇠가 감. 처음 켠 Mac 은 첫 안내의 "다른 기기의 플래너를 동기화로 가져오기" 로 새 플래너 없이 합류 | README.md (동기화 절), Sync/SyncFlows.swift | 불가 — SY-01 과 같은 이유 |
| SY-03 | 복구 코드로 되살리기 | 합류 시트 "복구 코드로 되살리기" / 설정 "복구 코드 새로 만들기…" | 기기를 모두 잃어도 복구 코드로 그룹에 다시 들어옴. 합치기 직전 이 Mac 의 플래너를 SyncBackups/ 에 자동 백업 (설정 → 데이터 "백업 가져오기…" 로 꺼냄), 아직 아무것도 안 적은 플래너는 합칠 때 제외 (스위치로 끔) | README.md (동기화 절), Sync/SyncBackups.swift, Sync/SyncFlows.swift | 불가 — SY-01 과 같은 이유 |
| SY-04 | 기기 관리 · 끄기 · 지우기 | 설정 → 동기화의 기기 목록 | 기기 이름 바꾸기 · 빼기, "끄기…", "지우기…" (서버 사본 삭제, 확인 대화상자), 이 Mac 에서 이어 쓰기 / 정리하기 (키체인이 다른 Mac 으로 옮겨 갔다고 감지될 때) | Sync/SyncSettingsPane.swift | 불가 — SY-01 과 같은 이유 |
| SY-05 | 지금 맞추기 · 상태 표시 | ⇧⌘S / 팔레트 톱니 배지 | 수동 동기화, 톱니의 상태 배지, 종이 위 안내 (다른 기기에서 지운 플래너 등) | Sync/SyncIndicatorViews.swift:SyncMenuItems (93-125) | 불가 — SY-01 과 같은 이유 |
| SY-06 | 이전 버전 보기 · 되돌리기 | 플래너 메뉴 "이 날의 이전 버전…" / "이 주의 이전 버전…" | 서버가 하루 · 한 주의 이전 버전을 바뀐 때부터 30일 보관. 플래너 · 날을 고르고 버전을 보고 하나로 되돌림 (새 편집으로 기록되어 다른 기기로 퍼지고 그때의 지금 내용도 이전 버전으로 남음) | Sync/SyncHistory.swift | 불가 — 서버 보관 의존. 대체 후보 = Obsidian 파일 복구 (추정) |
| SY-07 | 다른 기기 편집 실시간 반영 | (자동) | 쓰는 칸을 지키며 (5초) 다른 기기 편집을 받아 반영. ⌘Z 가 다른 기기의 편집을 지우지 않음 | README.md (동기화 절), Sync/PlannerSyncHost.swift | 불가 — 실시간 채널 의존 (DS-07 단순판이 대체) |

## 16. 첫 실행 · 튜토리얼 · 둘러보기

> 처음 안내 (OnboardingController) 와 플래너 둘러보기 (TourController) 는 별개. 둘러보기 단계 수는 소스의 대본 정의를 센 값: 일간 16 + 주간 4 + 홈 11 + 표지 · 첫 장 2 + 끝 1 = 전체 34. 안내 문구 전체는 Tour.swift:TourScript (253-408) 에 있고 이 문서에는 옮기지 않음.

| ID | 동작 | 하는 법 | 결과 · 규칙 | 원본 위치 | Obsidian 이식 난이도 |
|---|---|---|---|---|---|
| T-01 | 처음 안내 띄우기 | (앱 첫 실행) | "onboardingDone" 이 없거나 내 플래너가 한 권도 없으면 (예시 플래너는 세지 않음) 안내 창 (760×560, 스프링 달린 종이) 을 본 창보다 먼저 띄움. 설정 → 튜토리얼 "처음 안내" 에서 언제든 다시 봄. 창을 닫아도 앱을 쓸 수 있게 플래너가 없으면 기본 플래너 한 권을 만들고 끝냄 | App.swift:applicationDidFinishLaunching (331-336), Onboarding.swift:OnboardingController (18-120), FirstRunFlow.swift:needsFirstRun (59-61) | 보통 — 모달 위저드 |
| T-02 | 처음 안내 7단계 | 아래 점 / [다음] | 1 환영 → 2 플래너 만들기 → 3 넘기기 → 4 형광펜 · 타임테이블 → 5 할 일 → 6 주간 · 일간 · 홈 → 7 시작하기 (화면 라벨 WELCOME / MY PLANNER / PAGE TURN / TIMETABLE / TASKS / VIEWS / READY). 플래너가 없으면 2 에서 만들기 전에는 앞으로 못 감 | Onboarding.swift:OnboardingModel.Step (209-258), canVisit (364) | 보통 — 단계별 사용법 문구와 그림 필요 (이식 시 축소 가능) |
| T-03 | 첫 플래너 만들기 단계 | 2 단계 양식 | 이름 (안내 글 "내 플래너" / "내 플래너 n", 30자), 시작일 ("오늘" 칩), 종료일 토글 + "3개월" "6개월" "1년" 칩 + 달력 (기본 12개월 뒤 하루 전), 표지 선택, 기간 미리보기 띠. 종료 < 시작이면 "종료일은 시작일과 같거나 그 뒤여야 해요". [플래너 만들기] 로 생성. 이미 있으면 "한 권 더 만들기" | Onboarding.swift:BookDraft (617-658), 양식 (1320-1380), primary (385-394) | 쉬움 — B-01 시트 재사용 |
| T-04 | 단계 이동 조작 | [이전] [다음] [건너뛰기] / Return · Esc · ← → | Return = 다음 · 만들기 · 시작하기, Esc = 이전 (글 칸이면 먼저 포커스 해제), ← → = 이동 (글 칸이면 글자 사이 이동), [건너뛰기] = 준비 끝 단계로. 한글 조합 중에는 입력기에 맡김. 본 창 단축키가 가로채지 않도록 이 창의 키를 먼저 처리 | Onboarding.swift:installKeyMonitor/handleKey (151-200), primary/back/skip/forwardKey (385-416) | 쉬움 |
| T-05 | 시작하기로 마치기 | 7 단계 [시작하기] / 창 닫기 | 내 플래너가 없으면 기본 플래너 (이름 "내 플래너", 오늘부터 끝없음) 를 만들고 onboardingDone = true. 둘러보기가 아직 안 뜬 상태면 "처음 한 번 자동" 대상으로 둠 | Onboarding.swift:finish (93-118), recordFinished (126-132), settleBooksOnFinish (136-146), FirstRunFlow.finish (132-134) | 쉬움 |
| T-06 | 동기화 합류 분기 | 2 단계 "다른 기기의 플래너를 동기화로 가져오기" | 시작 단계를 (내 플래너 있나 × 동기화 그룹에 있나) 로 정하는 상태 기계 (환영 / 플래너 / 준비 끝: 만듦 · 합류 · 복구 · 받는 중). 받는 중이면 30초 뒤에야 [새 플래너 만들기] 표시 | FirstRunFlow.swift:startStage (64-72), waitingPatience (124), Onboarding.swift (582-760) | 불가 — 동기화 의존 |
| T-07 | 플래너 둘러보기 자동 시작 | (본 창을 처음 열 때) | plannerTourDone 이 없으면 0.9초 뒤 전체 둘러보기를 저절로 한 번만 시작 (끝까지 보든 끝내기를 누르든 다시는 저절로 뜨지 않음) | Tour.swift:startFirstTimeIfNeeded (468-474), TourController.doneKey (414) | 쉬움 |
| T-08 | 둘러보기 종류 고르기 | 도움말 "플래너 둘러보기" / 설정 → 튜토리얼의 "보기" | 5종: "플래너 둘러보기 — 전체" (34단계) · "일간만" (16) · "주간만" (4) · "홈만" (11) · "표지와 첫 장만" (2). 시작하면 설정 창은 닫음. 마지막 단계 버튼 "플래너로 돌아가기" / "마치기" | Tour.swift:TourKind (25-75), Settings.swift:SettingsTutorialsPane (1877-1925) | 쉬움 |
| T-09 | 둘러보기 말풍선 조작 | → / Return 다음, ← 이전, Esc 끝내기 (버튼 [이전] [다음] [끝내기]) | 가리키는 곳만 밝게 두고 나머지 종이는 어둡게, 옆에 말풍선 (n / N). 도는 동안 플래너 단축키 · 종이 누르기 · 팔레트는 쉼 (단계가 허락한 첫 장 글 칸만 누를 수 있음). ⌘Q ⌘H ⌘M ⌘W 만 시스템에 통과. 첫 장에 쓰는 중이면 글자는 글상자로 가고 Esc 는 쓰기만 마침 | Tour.swift:handleKey (750-775), next/back/end (522-545), TourOverlay (790-) | 보통 — 스포트라이트 + 말풍선 배치 (디자인 단위 × u 좌표) |
| T-10 | 둘러보기 장면 이동 · 복귀 | (자동) | 예시 플래너가 있으면 잠깐 펼쳐 보여 주고 (마지막 날 전날 · 일곱 날이 다 찬 마지막 주), 없으면 지금 책의 보던 날 · 주. 단계마다 일간 / 주간 / 홈 / 앞 장으로 옮기고 끝나면 보던 책 · 쪽 · 장으로 돌아옴. 도착하지 못해도 8초 뒤 말풍선 표시 | Tour.swift:start (476-519), go/settle/drive (576-660), TourContext (150-195) | 보통 — 장면 전환 상태 기계 |
| T-11 | 둘러보기 중 팔레트 · 메뉴 동결 | (자동) | 접힌 팔레트를 둘러보는 동안 펼쳐 두고 (끝나면 접힘 · 고정 되돌림), 가리키는 도구가 빛나며 말풍선이 팔레트 쪽을 향함. 메뉴의 설정 · 넘기기 · 쪽 바꾸기 · PDF 는 쉼 | Palette.swift:PaletteController init (457-462), PaletteView (665-701), App.swift:commands (18-63) | 보통 |
| T-12 | GitHub 별 부탁 | (서로 다른 날 7일째 사용 후 1회) | 켜고 4초 뒤 본 창 위에 시트로 한 번만 묻고, 어느 쪽을 눌러도 다시는 묻지 않음. 튜토리얼 · 둘러보기 중이거나 내 플래너가 없으면 다음 실행으로 미룸 | StarPrompt.swift:StarPrompt (5-60) | 쉬움 — 마케팅 기능이라 이식 제외 |

## 17. 집계

### 17.1 절별 동작 수 × 난이도 × 분류

| 절 | 동작 | 쉬움 | 보통 | 어려움 | 불가 | M1 | 2차 | 보류 |
|---|---|---|---|---|---|---|---|---|
| 1. 일간 페이지 | 28 | 19 | 9 | 0 | 0 | 24 | 3 | 1 |
| 2. 주간 페이지 | 14 | 10 | 4 | 0 | 0 | 0 | 14 | 0 |
| 3. 홈 (통계) | 11 | 4 | 7 | 0 | 0 | 0 | 11 | 0 |
| 4. 표지 · 첫 장 | 5 | 3 | 2 | 0 | 0 | 0 | 5 | 0 |
| 5. 도구 팔레트 | 17 | 11 | 5 | 0 | 1 | 9 | 7 | 1 |
| 6. 책 (플래너) 관리 | 8 | 3 | 5 | 0 | 0 | 4 | 3 | 1 |
| 7. D-day | 11 | 10 | 1 | 0 | 0 | 10 | 1 | 0 |
| 8. 형광펜 (분류 · 타임테이블 펜) | 8 | 8 | 0 | 0 | 0 | 3 | 5 | 0 |
| 9. 컬러 컨셉 | 5 | 5 | 0 | 0 | 0 | 1 | 4 | 0 |
| 10. PDF 로 뽑기 | 7 | 4 | 2 | 1 | 0 | 0 | 7 | 0 |
| 11. 설정 | 11 | 6 | 3 | 0 | 2 | 1 | 8 | 2 |
| 12. 앱 창 · 메뉴바 (맥 셸) | 12 | 5 | 1 | 0 | 6 | 5 | 0 | 7 |
| 13. 키보드 · 제스처 | 17 | 9 | 5 | 0 | 3 | 8 | 6 | 3 |
| 14. 데이터 안전 · 저장 | 9 | 5 | 3 | 1 | 0 | 7 | 1 | 1 |
| 15. 동기화 (Spiralday Sync) | 7 | 0 | 0 | 0 | 7 | 0 | 0 | 7 |
| 16. 첫 실행 · 튜토리얼 · 둘러보기 | 12 | 6 | 5 | 0 | 1 | 2 | 8 | 2 |
| 합계 | 182 | 108 | 52 | 2 | 20 | 74 | 83 | 25 |

### 17.2 불가 항목

| ID | 동작 | 대체안 · 이유 |
|---|---|---|
| P-16 | 창 밖 부착 · 자리 계산 | 창 밖 요소 (NSPanel). 대체 = P-15 의 뷰 안 배치 |
| S-05 | 폴더를 파인더에서 열기 | OS 파일 관리자 호출은 모바일에서 불가. 대체 = 볼트 안 폴더 경로 표시 |
| S-09 | 익명 사용 통계 | Obsidian 플러그인에서 외부 전송형 통계는 정책상 부적합 (추정). 이식 제외 |
| A-01 | 창 = 종이 한 장 | 창 크기 · 비율 통제 불가. 대체 = 뷰 컨테이너가 탭 크기에 맞춰 같은 비율로 스케일 (쉬움~보통) |
| A-02 | 쪽 종류 전환 시 창 변형 | 창 변형 불가. 대체 = 뷰 안 CSS 전환 |
| A-03 | 초록 버튼 확대 | 네이티브 창 제어. 대체 = 해당 없음 (탭을 키우면 됨) |
| A-04 | 창 밖 스프링 링 | 창 밖 요소. 대체 = 뷰 안 장식 (쉬움, 선택) |
| A-07 | 앱 · 도움말 메뉴 | 네이티브 메뉴바. 대체 = 명령 팔레트 몇 개 (둘러보기 · 설정 열기), 외부 링크는 제외 |
| A-08 | 자동 업데이트 (Sparkle) | Obsidian 커뮤니티 플러그인 업데이트 체계 사용 |
| K-13 | 모서리 호버 들림 · 잡고 끌어 넘기기 | Metal 종이 말림 물리. 대체 = 클릭 · 스와이프 이산 넘김 |
| K-14 | 종이 말림 넘김 애니메이션 | Metal 셰이더. 대체 = 슬라이드 / 페이드 (선택) |
| K-15 | 끝에서 진동 | 데스크톱 햅틱 API 없음 (모바일 일부는 추정). 제외 |
| SY-01 | 동기화 켜기 | 서버 · 키체인 · 암호 프로토콜 의존. 대체 = 볼트 동기화 |
| SY-02 | 기기 추가 · 합류 | SY-01 과 같은 이유 |
| SY-03 | 복구 코드로 되살리기 | SY-01 과 같은 이유 |
| SY-04 | 기기 관리 · 끄기 · 지우기 | SY-01 과 같은 이유 |
| SY-05 | 지금 맞추기 · 상태 표시 | SY-01 과 같은 이유 |
| SY-06 | 이전 버전 보기 · 되돌리기 | 서버 보관 의존. 대체 후보 = Obsidian 파일 복구 (추정) |
| SY-07 | 다른 기기 편집 실시간 반영 | 실시간 채널 의존 (DS-07 단순판이 대체) |
| T-06 | 동기화 합류 분기 | 동기화 의존 |

### 17.3 데이터 계층 대조 (TS 에 이미 있는 것 / 없는 것)

- 데이터 완료 55개: D-05 · D-06 · D-07 · D-08 · D-09 · D-10 · D-11 · D-13 · D-14 · D-15 · D-16 · D-17 · D-19 · D-22 · D-23 · D-24 · D-25 · W-02 · W-03 · W-05 · W-07 · W-08 · W-09 · W-10 · W-11 · W-12 · W-13 · F-03 · P-02 · P-06 · P-08 · B-07 · B-08 · DD-01 · DD-03 · DD-04 · DD-05 · DD-06 · DD-07 · DD-08 · DD-09 · DD-10 · DD-11 · HL-01 · HL-02 · HL-03 · HL-04 · HL-05 · C-02 · C-03 · S-08 · A-09 · DS-01 · DS-02 · DS-08
- 데이터 일부 7개: D-04 · D-26 · H-05 · B-01 · HL-07 · S-07 · DS-03
- 데이터 미포팅 17개: H-04 · H-06 · H-07 · H-08 · H-09 · H-10 · H-11 · P-01 · B-02 · B-03 · B-04 · HL-06 · C-01 · C-04 · DS-04 · DS-06 · DS-07

### 17.4 TS 에 더 필요한 데이터 함수 (이 표에서 뽑은 것)

- 책 관리: `activate` (B-03) · `updateBook` (B-02) · `deleteBook` (B-04) · 예시 플래너 (B-06, 보류) · 백업 가져오기용 새 책 + 데이터 주입 (S-07)
- 형광펜: `moveCategories` (HL-06) · 삭제 시 칸 · 할 일 일괄 정리 `SettingsPenUsage.delete` (HL-07) · 새 펜 이름 · 색 제안 (HL-02)
- 컬러: `ColorConcept` 9종 상수 (C-01) · 모두 기본 컬러로 (C-04)
- 메모: `memo` · `memoTag` 읽기 · 쓰기 (D-26)
- 통계: `HomeStats.make` 전체 (H-04 ~ H-11)
- 안전: 다른 책 펼치기 · 새 플래너 자동 생성 (DS-04) · 임시 책장 (DS-06) · 외부 변경 반영 (DS-07) · 읽지 못한 파일 알림 문구 (DS-05)
- 계산: `ruled.fitScale` 의 높이 조건 (D-04 · F-02 · F-03) · 한 줄 맞춤 `oneLineScale` (W-05) · 캐럿 줄 판정용 `lineRanges` (D-10)

## 18. 원본에 없는 것 · 추정 · 주의

### 18.1 원본에 없는 동작 (이식 때 새로 정하거나 하지 않기로 할 것)

- 칠하기 · 체크 · 삭제의 되돌리기 (⌘Z): SpiraldayKit 에서 UndoManager 를 쓰는 곳을 찾지 못함 (undo 관련 코드는 동기화 쪽의 글 칸 시스템 기록 정리와 `rebased` 주석뿐). 글 칸 안의 시스템 되돌리기만 존재.
- 할 일 삭제는 확인 없이 즉시 (메뉴 → 삭제). 확인 대화상자는 책 · 형광펜 삭제와 일부 동기화 동작에만 있음.
- 주간 `review` 글 (WeekRecord.review): 데이터 필드만 있고 입력 화면이 없음 (샘플 데이터만 채움). 별점 `stars` 는 입력 가능.
- 모바일 터치 규칙: 원본 Mac 앱에는 없음 (K-17).
- 종이는 늘 밝은 색 (`window.appearance = aqua`). 다크 모드 · Obsidian 테마 연동은 원본에 없으므로 종이 색을 고정할지 별도 결정 필요.

### 18.2 이식 제외 권고

- 상표 · 홍보: D-27 워드마크 링크, T-12 GitHub 별 부탁, A-07 웹사이트 · 회사 링크 (NOTICE.md 에서 이름 · 로고 · 아이콘을 쓰지 않는다고 명시).
- 외부 전송: S-09 익명 사용 통계.
- 옛 버전 호환 중 Obsidian 신규 사용자와 무관한 것: DS-09 (단일 파일 · 옛 폴더 옮기기). 단, DD-10 (1.0.2 D-day 옮기기) 과 DS-08 (줄 매김) 은 같은 JSON 을 읽는 호환성이라 유지.
- 개발 · 점검 실행 인자 (A-11), iOS 위젯용 읽기 전용 리더 (`SharedReader.swift`).

### 18.3 (추정) 표기 항목

다음 행에 `(추정)` 이 들어 있음: D-04 · D-08 · W-11 · P-13 · PDF-07 · S-06 · S-09 · K-08 · K-15 · K-17 · DS-07 · SY-06.

### 18.4 다음에 소스로 더 확인할 것

- `SpiraldayKit/Theme.swift` 의 `Ink` · `HighlighterBar` · `PaperSurface` 시각 규칙은 동작이 아니라 제외했음. 디자인 단계에서 별도로 읽어야 함.
- 동기화 쪽 `SyncText.swift` 의 사용자 문구 전체는 읽지 않음 (SY 절은 버튼 · 메뉴 이름과 README 만 근거).
- `Onboarding.swift` 의 3-6 단계 사용법 문구 (TipRow) 는 단계 구조만 기록. 이식하려면 문구를 따로 정리해야 함.

## 19. 분류 요약 — 1차 (M1) 필수 / 2차 / 보류

절마다 한 줄, 표 순서. 어려움 · 불가는 괄호로 표시. 근거는 각 절의 표 (ID 로 찾기).

### 19.1 1차 (M1) 필수 (74개)

- 1. 일간 페이지 (24): D-01 일간 양식 보기 · D-02 날짜 보기 · D-03 D-DAY 칸 열기 · D-04 COMMENT 쓰기 · D-05 DAY OFF 켜기·끄기 · D-06 TOTAL TIME 보기 · D-07 할 일 새로 쓰기 · D-08 할 일 글 고치기 · D-09 Return 으로 다음 줄 · D-10 ↑ ↓ 로 줄 이동 · D-11 비운 할 일 자동 삭제 · D-12 편집 끝내기 · D-13 체크 표시 순환 · D-14 → 미룸 = 다음 날로 넘기기 · D-15 내일로 미루기 (메뉴) · D-16 체크 표시 지정 (메뉴) · D-17 할 일 삭제 (메뉴) · D-18 할 일 메뉴 열기 · D-19 할 일 분류 (형광펜) 고르기 · D-20 형광펜 이름 표시 · D-21 완료 할 일 형광 긋기 · D-22 타임테이블 칠하기 · D-23 지우개 · D-26 MEMO 쓰기
- 5. 도구 팔레트 (9): P-01 책 메뉴 열기 · 전환 · P-02 보기 전환 · P-03 이전 · 다음 장 · P-04 오늘로 · P-05 팔레트에서 D-day 붙이기 · P-07 형광펜 선택 · P-08 형광펜 이름 · 색 바꾸기 · P-09 지우개 선택 · P-11 설정 열기
- 6. 책 (플래너) 관리 (4): B-01 새 플래너 만들기 · B-03 플래너 펼치기 (전환) · B-07 책 기간 규칙 · B-08 마지막 쪽 종류 기억
- 7. D-day (10): DD-01 하루 2개 제한 · DD-02 D-day 편집 패널 열기 · DD-03 저장한 D-day 붙이기 · DD-04 새로 만들어 붙이기 · DD-05 붙인 D-day 고치기 · DD-06 붙인 D-day 떼기 · DD-07 어제와 같게 · DD-08 D-day 표시 형식 · DD-10 1.0.2 파일의 D-day 옮기기 · DD-11 옛 단일 D-day 읽기
- 8. 형광펜 (분류 · 타임테이블 펜) (3): HL-01 기본 형광펜 7종 · 개수 제한 · HL-05 TOTAL TIME 포함 토글 · HL-08 지운 형광펜 흔적
- 9. 컬러 컨셉 (1): C-01 컬러 9종 정의
- 11. 설정 (1): S-01 설정 열기
- 12. 앱 창 · 메뉴바 (맥 셸) (5): A-05 창 제목 갱신 · A-06 플래너 메뉴 명령 · A-09 닫으면 저장 후 종료 · A-10 손글씨 글꼴 준비 후 다시 그림 · A-12 뷰 비율 맞춤 (A-01 의 대체)
- 13. 키보드 · 제스처 (8): K-01 이전 · 다음 장 키 · K-02 위가 묶인 쪽의 세로 키 · K-03 오늘 키 · K-04 보기 전환 키 · K-05 도구 키 · K-06 쓰기 마치기 · K-07 글 쓰는 중 단축키 양보 · K-12 모서리 클릭 넘기기
- 14. 데이터 안전 · 저장 (7): DS-01 자동 저장 · DS-02 파일 구성 · 형식 호환 · DS-03 읽지 못한 파일 보존 · DS-04 읽지 못할 때 다른 책 펼치기 · DS-05 읽지 못한 파일 알림 · DS-07 밖에서 바뀐 파일 반영 (어려움) · DS-08 옛 기록의 할 일 줄 매김
- 16. 첫 실행 · 튜토리얼 · 둘러보기 (2): T-03 첫 플래너 만들기 단계 · T-05 시작하기로 마치기

### 19.2 2차 (83개)

- 1. 일간 페이지 (3): D-24 타임테이블 글씨 메모 · D-25 밥시간 · D-28 도구별 마우스 커서
- 2. 주간 페이지 (14): W-01 주간 양식 보기 · W-02 이번 주 목표 쓰기 · W-03 주간 별점 · W-04 날짜 머리 → 그날 일간 · W-05 주간에서 할 일 쓰기 · W-06 10개 초과 할 일 표시 · W-07 주간 Return · W-08 주간 체크 표시 순환 · W-09 주간 분류 고르기 · W-10 주간 할 일 메뉴 · W-11 주간 타임테이블 칠하기 · W-12 하루 합계 보기 · W-13 책 기간 밖 날 잠금 · W-14 쉬는 날 꼬리표
- 3. 홈 (통계) (11): H-01 홈 보기 · H-02 이번 주 목표 → 주간 · H-03 오늘의 D-day 편집 · H-04 요약 6칸 보기 · H-05 기록한 날 · STREAK 규칙 · H-06 LAST 12 WEEKS · H-07 HIGHLIGHTERS (이번 달) · H-08 TIME OF DAY (지난 4주) · H-09 WEEKDAYS (지난 8주) · H-10 TASK MARKS (이번 달) · H-11 LAST 35 DAYS (잔디)
- 4. 표지 · 첫 장 (5): F-01 앞 장 순서 · 이동 · F-02 표지 보기 · F-03 첫 장에 하고 싶은 말 쓰기 · F-04 앞 장에서 도구 제한 · F-05 책 정보 변경 후 앞 장 유지
- 5. 도구 팔레트 (7): P-06 컬러 고르기 · P-10 글씨 · 밥 도구 선택 · P-12 팔레트 접기 · 펼치기 · P-13 손잡이 호버 펼침 · P-14 자동으로 접기 · P-15 팔레트 자리 고르기 · P-17 긴 팔레트 스크롤
- 6. 책 (플래너) 관리 (3): B-02 플래너 편집 · B-04 플래너 삭제 · B-05 책장 보기
- 7. D-day (1): DD-09 저장한 D-day 목록 관리
- 8. 형광펜 (분류 · 타임테이블 펜) (5): HL-02 형광펜 추가 · HL-03 이름 바꾸기 · HL-04 색 바꾸기 · HL-06 순서 바꾸기 · HL-07 형광펜 삭제
- 9. 컬러 컨셉 (4): C-02 기본 컬러 정하기 · C-03 하루만 컬러 바꾸기 · C-04 모두 기본 컬러로 되돌리기 · C-05 책 표지 색 고르기
- 10. PDF 로 뽑기 (7): PDF-01 PDF 화면 열기 · PDF-02 종류 · 용지 고르기 · PDF-03 기간 고르기 · PDF-04 표지 · 첫 장 포함 · PDF-05 반쪽 자르는 선 · PDF-06 요약 문구 · 쪽 수 · PDF-07 PDF 만들기 (어려움)
- 11. 설정 (8): S-02 항목이 책별인지 알림 · S-03 단축키 안내 보기 · S-04 데이터 위치 · 상태 보기 · S-06 백업 내보내기 · S-07 백업 가져오기 · S-08 기록 요약 보기 · S-10 정보 · 라이선스 보기 · S-11 설정 창 중 플래너 입력 분리
- 13. 키보드 · 제스처 (6): K-08 한글 입력 상태 단축키 · K-09 두 손가락 가로 쓸기 · K-10 두 손가락 세로 쓸기 · K-11 일반 마우스 휠 · K-16 툴팁 (도움말 문구) · K-17 모바일 터치 동작
- 14. 데이터 안전 · 저장 (1): DS-06 책장을 읽지 못할 때 임시 책장
- 16. 첫 실행 · 튜토리얼 · 둘러보기 (8): T-01 처음 안내 띄우기 · T-02 처음 안내 7단계 · T-04 단계 이동 조작 · T-07 플래너 둘러보기 자동 시작 · T-08 둘러보기 종류 고르기 · T-09 둘러보기 말풍선 조작 · T-10 둘러보기 장면 이동 · 복귀 · T-11 둘러보기 중 팔레트 · 메뉴 동결

### 19.3 보류 (25개)

- 1. 일간 페이지 (1): D-27 워드마크 링크
- 5. 도구 팔레트 (1): P-16 창 밖 부착 · 자리 계산 (불가)
- 6. 책 (플래너) 관리 (1): B-06 예시 플래너
- 11. 설정 (2): S-05 폴더를 파인더에서 열기 (불가) · S-09 익명 사용 통계 (불가)
- 12. 앱 창 · 메뉴바 (맥 셸) (7): A-01 창 = 종이 한 장 (불가) · A-02 쪽 종류 전환 시 창 변형 (불가) · A-03 초록 버튼 확대 (불가) · A-04 창 밖 스프링 링 (불가) · A-07 앱 · 도움말 메뉴 (불가) · A-08 자동 업데이트 (Sparkle) (불가) · A-11 개발 · 점검 실행 인자
- 13. 키보드 · 제스처 (3): K-13 모서리 호버 들림 · 잡고 끌어 넘기기 (불가) · K-14 종이 말림 넘김 애니메이션 (불가) · K-15 끝에서 진동 (불가)
- 14. 데이터 안전 · 저장 (1): DS-09 옛 파일 · 폴더 옮기기
- 15. 동기화 (Spiralday Sync) (7): SY-01 동기화 켜기 (불가) · SY-02 기기 추가 · 합류 (불가) · SY-03 복구 코드로 되살리기 (불가) · SY-04 기기 관리 · 끄기 · 지우기 (불가) · SY-05 지금 맞추기 · 상태 표시 (불가) · SY-06 이전 버전 보기 · 되돌리기 (불가) · SY-07 다른 기기 편집 실시간 반영 (불가)
- 16. 첫 실행 · 튜토리얼 · 둘러보기 (2): T-06 동기화 합류 분기 (불가) · T-12 GitHub 별 부탁

### 19.4 분류 메모

- M1 에 들어간 `DS-07 밖에서 바뀐 파일 반영` 은 난이도가 어려움이지만, Obsidian Sync · iCloud 로 볼트가 맞춰지면 열린 책 파일이 밖에서 바뀌므로 첫 배포부터 필요. M1 에서는 단순판 (편집 중이 아니면 다시 읽기, 편집 중이면 경고) 으로 시작하고 3자 병합은 2차로 미루는 안을 권장 (추정).
- `D-26 MEMO` · `P-08 형광펜 이름 · 색 팝오버` · `DD-01 ~ DD-08` 은 일간 양식 안에 이미 칸이 있어 M1 에 포함. 설정 화면의 목록 관리 (`DD-09` `HL-02 ~ HL-07` `C-02 ~ C-04`) 는 2차.
- 창 · 메뉴바 · 말림 · 햅틱은 대체안이 있더라도 사용자 동작이 아니라 연출이므로 보류. 대체가 필요한 것만 `A-01` (비율 맞춤) · `A-06` (명령) 을 M1 에 둠.
