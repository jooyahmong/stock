# WOOJOO Stock Planner — stock.woojooland.com

**WOOJOO Stock Planner** — Stock Content Planner + Production Tracker.
365일 / 주간 / 월간 스톡 이미지 키워드를 관리하고, 키워드별 제작·작업 상태를
체크하며, 사용자가 지정한 GPT/GPTs로 연결한다. AI 이미지 생성 사이트가 아니다.

> 로컬 개발 단계(V1). 운영 배포 / Cloudflare / DNS는 요청 전까지 건드리지 않는다.

## 실행

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc + vite build
npm run test       # vitest (도메인 로직 단위 테스트)
node e2e/smoke.mjs  # dev 서버가 떠 있는 상태에서 Playwright E2E 스모크
```

## 핵심 원칙 (구현에 반영됨)

| 원칙 | 구현 |
| --- | --- |
| 한 행 = 한 키워드 | `KeywordItem` 독립 레코드. 날짜 병합 없음 |
| 같은 날짜 반복 허용 | `period` 문자열 중복 허용, DB/Excel 모두 |
| 화면에서만 날짜 그룹 | `domain/grouping.ts` — 표시 그룹과 데이터 분리 |
| 선택 체크 ≠ 작업 체크 | 선택 = `uiStore.selection`(휘발성). 작업 = `keywordStatus`(저장) |
| 기본 작업상태 = 생성 / 미캔 | 계획 생성 시 seed. rename·순서변경만 가능(숨김·삭제 불가) |
| 사용자 정의 작업상태 개수 무제한 | `statusColumns` + `keywordStatus` 분리 스키마 |
| Full Export도 한 행 = 한 키워드 | `domain/excel.ts` — TRUE/FALSE, 날짜 반복 |
| 키워드 클릭 = 복사 + GPT 새 탭 | 자동 전송 아님. 클릭해도 "생성" 자동 체크 안 함 |

## 아키텍처 — 저장소 계층 분리

UI/도메인 로직은 **`Repository` 인터페이스**(`src/repo/types.ts`)에만 의존한다.
V1은 `DexieRepository`(IndexedDB) 하나만 구현. 운영 백엔드(**Cloudflare D1**)로
교체할 때 `src/main.tsx`의 한 줄만 바꾸면 되도록 설계했다.

```
src/
  repo/
    types.ts              Repository 인터페이스 + 엔티티 타입 (저장소 유일 계약)
    RepositoryContext.tsx  Provider + useRepository() + useRepoQuery() (백엔드 무관 반응형)
    dexie/
      db.ts               ← Dexie 타입이 등장하는 유일한 파일
      DexieRepository.ts   Repository 구현체
      seed.ts              최초 1회 시딩 + 개발용 초기화(DEV 한정 wipe)
  domain/                 순수 로직 (DB·React 없음) — D1로 바꿔도 그대로 재사용
    periods.ts            plan type별 기간 파싱/검증/표시
    grouping.ts           기간 그룹핑 + 검색/필터
    progress.ts           작업상태별 진행률
    statusColumns.ts      "생성" 컬럼 탐색 (Calendar O/X · Direct 자동체크 공용)
    calendar.ts           월 grid / keywordsByDay / O·X 규칙 (Calendar View)
    excel.ts              Import 파서 / Template / Full Export
    prompt.ts             GPT 전달 텍스트 (Phase 2 템플릿 훅)
  data/defaultStockKeywords/   기본 1년 스톡 키워드 팩 (격리된 seed dataset)
    buildDefaultStockPlan.ts   buildDefaultStockPlan(startIso?) → {productionDate, keyword}[] (오늘부터 365일)
    events.ts / pools.ts / dateUtils.ts
  store/uiStore.ts        휘발성 UI 상태(선택/검색/필터/토스트)만
  components/             UI. 저장은 useRepository()로 인터페이스만 호출
    calendar/            월간 Calendar View (조회 + 키워드 클릭만)
  generation/            [선택] Direct Generate 레이어 — 아래 "생성 방식" 참고.
                         keyword 도메인/Repository와 분리, 플래그로 제거 가능
```

D1 전환 시 필요한 것: `D1Repository implements Repository` 작성 →
`main.tsx`에서 주입. 모든 ID는 문자열 UUID, 모든 행에 `workspaceId`가 있어
멀티 유저/워크스페이스는 `WHERE` 절 추가로 확장된다. 반응형은 Dexie live query가
아니라 `repository.subscribe()` 이벤트라서 백엔드에 종속되지 않는다.

**현재 D1 / 로그인은 연결하지 않았다.**

## 데이터 모델

```
Plan          { id, workspaceId, name, type, createdAt, updatedAt }
KeywordItem   { id, workspaceId, planId, period, keyword, sortOrder, createdAt, updatedAt }
StatusColumn  { id, workspaceId, planId, name, order, isVisible, isDefault, createdAt, updatedAt? }
KeywordStatus { id, workspaceId, keywordItemId, statusColumnId, checked, updatedAt }
Generator     { id, workspaceId, name, url, isDefault, createdAt, updatedAt? }
AppSetting    { key, value }   // 활성 계획, 목록 창, 빈 기간 목록, (Phase 2) 프롬프트 템플릿
```

`period` 해석: `365/custom` → `YYYY-MM-DD`, `weekly` → `YYYY-Www`, `monthly` → `YYYY-MM`.
모든 가변 레코드에 `updatedAt` 이 있어 향후 Sync의 Last-Modified-Wins 기준이 된다.

## 데이터 저장 — Local Mode (현재) / Sync Mode (향후)

### Local Mode — 기본, 지금 구현됨

- 회원가입·로그인 없음. 모든 데이터는 **현재 브라우저의 IndexedDB(Dexie)** 에 저장.
  Plan · Keyword · 생성/미캔/사용자 체크 항목 · 체크 항목 순서·표시 · My GPT URL ·
  기본 생성 방식 · 일반 설정.
- 기기·브라우저마다 별개 저장소 (PC Chrome ↔ iPhone Safari 자동 공유 안 됨).
  PWA로 설치해도 같은 origin의 같은 브라우저 저장소를 쓰므로 Sync가 아니다.
- **공식 백업 = Excel.** `설정 > 저장 · 백업 → Excel 전체 백업`(= Full Export) 으로
  `Date | Keyword | 생성 | 미캔 | 사용자 체크 항목` xlsx를 받고, 다른 기기에서
  `Excel 가져오기`로 복원. Import/Export 구조는 그대로 유지.
- 설정 화면에 "이 기기에 자동 저장 · 다른 기기와 자동 동기화 안 됨 · 중요한 작업은
  Excel 백업" 안내.

### Sync Mode — 향후 (V1에서 구현 안 함)

**V1 범위 = ① 로컬 저장 + My GPT 링크만.** 아래 ②는 설계만 확정해 둔 상태이며
**V1 UI에는 표시하지 않는다** (`설정 > 저장 · 백업`은 로컬 저장 안내 + Excel
백업만). 회원가입은 어느 쪽에도 없다.

향후 목표 UX:

```
저장 방식
 ● 이 기기에 저장        로그인 없음 (기본). 한 기기에서만 쓰면 이대로.
 ○ 여러 기기에서 동기화   링크(키)를 다른 기기에 입력 → 자동 동기화
```

- **① 이 기기에 저장 (기본, V1)**: 지금 그대로. IndexedDB, 계정·이메일 없음.
  단일 기기 사용자는 아무것도 안 해도 됨.
- **② 여러 기기에서 동기화 (opt-in, 화면 표시형 영구 링크 — 이메일 없음)**:
  1. 동기화 켜기 → 서버가 계정 + 128비트 랜덤 토큰 생성 → **링크/키를 화면에
     표시**(`stock.woojooland.com/#k=<토큰>`). 이메일 발송 없음 — 사용자가
     비밀번호 관리자·메모에 저장하거나 다른 기기로 직접 전달.
  2. 다른 기기에서 그 링크 열기 → 그 기기에 토큰 저장 → 이후 자동 동기화.
  3. **열자마자 URL fragment 제거**(`history.replaceState`) — 토큰은 저장소에만
     남기고 주소창은 비운다. 방문기록·북마크·Referer·(향후 AdSense 등)
     제3자 스크립트 노출 최소화. 토큰은 `#` 뒤에만 두어 서버 로그에도 안 남김.
  4. **"링크 다시 보기" / "재설정" 버튼** — 로그인된 기기에서 제공. 재설정은
     새 토큰 발급(모든 기기 재로그인 필요).
  5. 비밀번호·6자리 코드·OAuth·이메일 발송 전부 없음.
  6. **이메일은 나중에 선택적으로** 얹을 수 있다(토큰 모델 동일, 아키텍처 변경
     없음). 원하면 "이 링크를 이메일로도 받기"만 추가.
- **복구 정리**: 링크만 잃음 → 로그인된 기기에서 "다시 보기". 로그인된 기기가
  하나도 없으면 → **Excel 전체 백업**이 유일한 복구 수단(모든 모드 공통 안전망).
- **동기화 대상**: Plan · KeywordItem · KeywordStatus · StatusColumn · Generator(My GPT
  이름·URL) · `defaultGenerationMode` · 일반 generation preference.
- **동기화 제외 (기기 로컬 전용)**: **Direct Generate API Key**, 민감한 provider
  credential. `providerType` / `model` 은 동기화 가능하되 `apiKey` 는 제외 —
  `src/generation/generationConfig.ts` 가 이미 Repository 밖(localStorage)에 있고
  주석으로 이 규칙을 명시. Excel 백업에도 API Key는 포함되지 않음(`domain/excel.ts`).
- **최초 Local → Sync 전환**: Local 데이터를 버리지 않는다.
  `[현재 작업을 계정에 저장] [계정 데이터 불러오기] [취소]` — 첫 Sync 시 Local
  workspace를 계정 workspace로 업로드.
- **충돌 정책 (V1)**: CRDT/merge 없이 **Last-Modified-Wins** — 레코드별 `updatedAt`
  최신값 사용 (Plan · KeywordItem · KeywordStatus · StatusColumn · Generator).
  실제 구현 시 재검토.
- **삭제 동기화**: 단순 hard delete만 하면 다른 기기에서 삭제 항목이 되살아날 수
  있으므로, D1 Sync 구현 시 `deletedAt` / tombstone 도입을 검토 (지금 Local 모델은
  변경하지 않음).
- **Repository 확장**: `workspaceId` local(익명) → 계정 workspace. UI/도메인은
  `Repository` 인터페이스만 쓰므로 `DexieRepository` → `D1Repository` /
  `SyncRepository` 교체만으로 확장. `src/repo/types.ts` 헤더 참조.

토큰 발급 / D1 / 서버 동기화 / API Key 서버 저장은 **별도 요청 전 구현 안 함.**
V1은 ① 로컬 + My GPT 링크만. (회원가입·비밀번호·OAuth·이메일 발송 없음 — 위 ②로 확정.)

## 계획 선택 · 브랜드 · 푸터

- **계획 유형 탭 제거**: 상단의 `365 Days / Weekly / Monthly / My Plan` 탭을 없앴다.
  대부분 계획이 하나뿐이라 빈 탭이 부담이었다. 대신 계획 `<select>`(2개 이상일 때)
  + `+ 새 계획`. 유형은 **생성 시 라디오로 선택**(날짜 365 / 날짜 내 계획 / 주간 /
  월간)하고 이름 옆 배지로 표시. 유형은 여전히 기간 형식·달력 가능 여부를 결정한다.
- **브랜드**: `public/logo.png`(헤더 워드마크), `public/favicon.ico`. 색상은 로고에서
  추출 — 바이올렛 `#6b4df5`(기본), 코랄 `#f4695a`(오늘·강조), 상단 그라데이션 스트립,
  진행바 그라데이션, 체크박스 `accent-color`. 과한 장식은 피함(생산성 도구).
- **푸터**: 보라색 배경·흰색 가운데 정렬 바 — `© <연도> WOOJOO Stock Planner` +
  **데이터 처리 안내** 링크(모달).
  - 로그인·서버 계정 없음. 모든 데이터는 이 브라우저(IndexedDB/localStorage)에만 저장.
  - 계획·키워드 데이터를 우리 서버로 전송·수집하지 않음.
  - My GPT 링크·Direct API Key도 브라우저에만. 요청은 사용자가 지정한 GPT/OpenAI로만.
  - 삭제: 브라우저 사이트 데이터 삭제 또는 콘솔 `__wipeAllData()`.
  - 현재는 개인정보 미수집이라 **이용약관·개인정보처리방침 페이지는 두지 않음**.
    로그인·클라우드 저장(D1)·**광고(Google AdSense 등)** 도입 시 별도 게시.
    → "광고·추적 없음" 같은 단정 문구는 넣지 않음(향후 AdSense 가능성).

## 목록 보기 / 달력 보기 (Calendar View)

Planner 상단 `[목록 보기] [달력 보기]` 토글(마지막 선택은 localStorage에 기억).
기존 목록 화면은 그대로 유지되고, 달력은 **조회 + 키워드 클릭 생성**만 한다
(수정·상태관리·DnD는 목록 보기).

### 목록 보기 날짜 창

365일(730행)을 한 번에 쭉 그리지 않는다. 목록은 기본적으로 **오늘 주변**
(오늘 −3일 ~ +11일 ≈ 2주)만 보여주고, 목록 끝에 두 개의 버튼만 둔다:

- **`이후 더 보기 ▼`** (코랄, 전체폭, 가운데) — 14일씩 뒤로 확장
- **`전체 N일 보기` ↔ `최근 날짜만 보기`** (작은 밑줄 링크) — 전부 펼치기/접기
- **검색·필터 중에는 창을 무시**하고 매칭 전부 표시(find-anywhere)
- 계획 전환 시 기본값으로 리셋. 주간/월간 계획도 현재 주/월 기준 동일.
- (`이전 더 보기`·범위 라벨 바는 제거 — 시드가 오늘부터라 과거가 거의 없어 불필요)

- 월간 7열 grid (SUN–SAT), `‹ 월 연도 ›` + `[오늘]`, 오늘 날짜 강조.
- 각 날짜 셀에 그 날짜(`productionDate`)의 KeywordItem을 그대로 표시 — 데이터는
  절대 합치지 않는다. 하루 최대 3개 표시, 초과 시 `+N개` → 상세 모달(전체 목록,
  각 키워드 클릭 가능).
- **O/X 규칙** (`domain/calendar.ts` `genMark`): 판단 컬럼은 **"생성" 하나뿐**.
  과거 + 생성 O → `○`, 과거 + 미생성 → `×`, **오늘·미래는 표시 안 함**
  (아직 안 끝난 날에 X를 붙이지 않는다). O/X는 날짜가 아니라 **키워드 단위**.
- 긴 키워드는 1줄 ellipsis(`white-space:nowrap; overflow:hidden; text-overflow:ellipsis`),
  전체 문자열은 `title`(hover)과 상세 모달에서 확인.
- 키워드 클릭은 목록 보기와 **완전히 동일한 `onRun` 핸들러**를 재사용 (Direct 기본
  → GenerateModal, My GPT 기본 → 복사 + GPT 탭). 생성 로직 복제 없음.
- 날짜 기반(`365`/`My Plan`) 계획에서만 사용. `weekly`/`monthly`에서는 달력 탭
  비활성 + 안내.
- 모바일(≤640px)은 7열을 억지로 줄이지 않고 **agenda 리스트**(키워드 있는 날만)로
  전환. page-level 가로 스크롤 없음.

## 기본 스톡 키워드 팩 — 오늘부터 365일 (롤링)

새 사용자는 첫 실행 시 `365 스톡 키워드` 플랜을 자동으로 받는다
(`src/data/defaultStockKeywords/`, 컴포넌트에 하드코딩하지 않음).

**시딩 방식** (`src/repo/dexie/seed.ts`, 마커 `seed:marker = rolling-365-v2`):
- **빈 DB (모든 빌드)**: 기본 플랜 생성.
- **개발용 초기화 (`import.meta.env.DEV` 한정)**: 이전 개발용 샘플 데이터(구 마커 +
  플랜 존재)가 남아 있으면 전 테이블을 비우고 기본 팩으로 교체. **프로덕션 빌드에서는
  절대 실행되지 않음** → 실제 사용자 데이터는 seed 버전 상향만으로 삭제되지 않는다.
- 프로덕션 빌드 + 기존 데이터: 손대지 않음.

- **시작일**: 시딩 시점의 **로컬 오늘**. 거기서부터 365일 연속, 총 **730**개.
- **핵심 규칙**: 표시 날짜 = *제작일(productionDate)* ≈ 타깃 날짜 − **약 61일(≈2개월)**.
  오늘 만든 이미지는 약 2개월 뒤에 팔린다는 전제.
- **(월, 일) 사이클로 루프**: 채우기(fill) 콘텐츠는 각 날짜의 (월, 일) 서수로만
  결정된다 → 어느 해든 같은 (월, 일)은 같은 채우기 키워드. `buildDefaultStockPlan`
  두 번(연도만 다른 같은 시작일)의 동일 (월, 일) 비교 테스트로 검증.
- **이벤트**는 실제 날짜 기준 제작일에 그날 두 슬롯을 덮어쓴다(이벤트 우선). 이동형
  이벤트(Easter=computus, Thanksgiving=11월 4째주 목, Mother/Father's Day,
  Lunar New Year=표)는 실제 날짜 계산. Thanksgiving 등 요일 기반 이벤트는 해마다
  ±1~2일 이동한다.
- **연말/연초 경계**: 12월 제작분이 다음 해 2월 Valentine을, 11-01이 다음 해 1-01
  New Year를 준비한다 (target year ≠ production year). 창(window)이 두 해를 걸침.
- 하루 정확히 **2개**: 슬롯0 = 인물/라이프스타일 주제, 슬롯1 = 디자인 배경/보조 주제.
  같은 날짜는 2행으로 반복(병합 없음).
- 창에 윤년 2월 29일이 포함돼도 항상 365일 / 730개 (29일은 채우기상 2월 28일 슬롯).
- **한국어 · 단어 위주** 키워드(2~6어절 명사구, 서술형 문장 아님). 풀이 커서
  하나를 공유하며 회전 → 한 바퀴 돈 뒤부터만 구도/대상 한정어(클로즈업·플랫레이…)
  를 붙인다(약 30%). 완전 동일 키워드 중복 0.
- 브랜드·캐릭터·유명인 이름 제외. UI/키워드 언어 분리 — 향후 영어/지역 pack은
  `data/defaultStockKeywords` 복제·교체.
- 생성/미캔 등 모든 상태 초기값 FALSE (시딩이 `keywordStatus` 행을 만들지 않음).
- 시딩된 뒤에는 일반 KeywordItem과 동일 — 자유롭게 수정/삭제/날짜 변경.
  기존 Plan이 있으면(프로덕션) 두 번째 플랜을 만들지 않는다.

## Excel

- **Template**: 한 파일에 **`Date` / `Week` / `Month` 세 탭** — 계획을 바꾸지
  않아도 모든 유형의 양식을 받는다. 각 탭은 `<기준> | Keyword | <작업단계 열…>`
  로 **Full Export와 동일한 열 구조**, 작업단계는 `FALSE` 기본값 + 예시 행 3개.
  가져올 때 현재 계획 유형에 맞는 탭을 자동으로 읽는다(`parseImportFile` →
  `TAB_NAME[kind]`, 없으면 첫 시트). `buildTemplateWorkbookAllKinds()`.
- **Import (Upsert)**: 첫 시트만. 기준 열 + `Keyword` 열 필요. 확장 열(생성/미캔/
  사용자 단계)은 기존 작업단계 이름과 대소문자 무시 매칭되면 자동 인식.
  - **같은 `기준값 + Keyword` = 기존 항목**으로 보고 그 행의 체크값을 시트대로
    덮어쓴다 — **체크 해제도 반영**(TRUE→FALSE). 새 조합만 새로 생성 →
    편집한 Full Export를 다시 넣어도 **중복이 생기지 않는다**.
  - 매칭은 `(기준값, Keyword)` 그룹별 1:1 소비. 시트에 같은 조합이 더 많으면
    초과분은 새 항목.
  - 미리보기: `새로 추가 / 기존 갱신 / (파일에 없는 기존 항목) / 오류 / 빈 행 무시`.
  - **"파일과 완전히 일치시키기"** 체크(기본 꺼짐): 파일에 없는 기존 키워드를
    삭제해 시트와 미러링. 전체 Export를 편집했을 때만 켜라.
  - 빈 키워드/빈 행: 조용히 무시. 잘못된 날짜/주/월: 오류로 분류(중단 아님).
  - Date는 SheetJS `cellDates`로 Date 객체도 처리(±1초 드리프트는 가까운
    자정으로 스냅), `.`·`/` 구분자, 한 자리 월/일 허용.
- **Full Export**: `Date|Week|Month`, `Keyword`, 그리고 **모든 작업단계 열(숨김 포함)**.
  값은 `TRUE`/`FALSE`. 같은 날짜는 모든 행에 반복 기록(병합 없음).
  이 파일을 그대로 다시 Import하면 작업상태까지 복원된다(라운드트립 테스트 통과).

## 생성 방식 — Direct Generate + My GPT

> **현재 Direct Generate는 기본 비활성(`VITE_DIRECT_GENERATION` 미설정)입니다.**
> OpenAI·Gemini/Imagen 이미지 생성 API가 모두 유료(결제) 키를 요구해서 UI에서
> 숨겨 두었습니다. 지금은 **My GPT만 동작**합니다. 되살리려면 `.env`(또는
> Cloudflare Pages 환경변수)에 `VITE_DIRECT_GENERATION=true`.

키워드 클릭 시 **Settings > 생성 > 기본 생성 방식**(`direct` | `my-gpt`)에 따라 동작:

- **My GPT** (기본값, API 불필요): 프롬프트를 클립보드에 복사한다.
  - **탭 재사용은 브라우저 한계로 불가**: ChatGPT는 `Cross-Origin-Opener-Policy:
    same-origin`을 보내 페이지 로드 즉시 opener의 Window 참조와 명명 타깃 링크를
    모두 끊는다. 그래서 열린 탭을 다시 focus하거나 재사용할 방법이 없다.
  - **대응**: 세션당 **첫 클릭에서만** `window.open(url, 'woojoo-gpt')`으로 탭을
    열고, 이후 클릭은 **복사만** 하고 Toast로 "ChatGPT 탭에 붙여넣기(Ctrl/⌘+V)"를
    안내한다 → 새 탭이 계속 생기지 않는다.
  - 툴바 **`GPT 열기`** 버튼(코랄)으로 필요할 때 탭을 다시 연다(`force`).
  - 자동 전송·자동 Enter·DOM 조작 없음. 열었다고 "생성"을 체크하지 않음.
  - **URL 검증**(`src/lib/gptUrl.ts`): 저장 시 `https` + hostname `chatgpt.com`
    (`www.` 허용)만 통과. `javascript:` / `data:` / http / 임의 외부 호스트 차단.
    사용 직전에도 한 번 더 검증한다.
- **Direct Generate** (개인 API 필요): 내부 Generator 모달 → 키워드를 프롬프트로
  즉시 생성 → 로딩 → 이미지 표시 → **성공 시에만 "생성" 자동 체크**. 실패 시 오류
  메시지 + [다시 시도] / [My GPT로 열기], 체크 안 함.
- **Fallback**: 기본이 Direct인데 사용 가능한 API가 없으면 모달에서 [API 설정] /
  [My GPT로 열기](미등록 시 [My GPT 설정]) 제공.

**등록된 Provider** (`설정 > 생성 > Direct Generate`의 `API Provider`):

| Provider | 모델 | 비고 |
|---|---|---|
| **OpenAI** | `gpt-image-1` · `dall-e-3` · `dall-e-2` | `api.openai.com` |
| **Google (Gemini / Imagen)** | `imagen-3.0-generate-002` · `imagen-4.0-generate-001`(preview) · `gemini-2.5-flash-image-preview` | `generativelanguage.googleapis.com`. `imagen-*` → `:predict`, `gemini-*` → `:generateContent`. **무료 등급은 프롬프트·결과물이 Google 학습·검토에 쓰임** → 상업용은 유료 등급 권장. Preview 모델은 프로덕션 부적합 문구가 붙을 수 있음. |

새 provider 추가 = 어댑터 파일 1개 + `providers/index.ts` 레지스트리·`PROVIDER_TYPES`
각 1줄 (`ImageGenerationProvider` 인터페이스 구현). UI·핵심 로직 무변경.
공유 헬퍼는 `providers/http.ts`(CORS 메시지·API 에러 파싱). 브라우저 직접 호출이
CORS로 막히는 provider는 배포 시 서버 프록시 필요.

### Direct Generate 레이어 (`src/generation/`) — 완전 분리 / 제거 가능

핵심 원칙: **Direct Generate는 앱의 필수 의존성이 아니다.** keyword 도메인
(`src/domain/*`)·저장소(`src/repo/*`)에서 이 폴더를 절대 import 하지 않는다.

```
src/generation/
  featureFlags.ts        directGenerationEnabled (env VITE_DIRECT_GENERATION)
  types.ts               ImageProvider, ImageGenerationProvider 어댑터 인터페이스
  generationConfig.ts    설정/키 저장소 — localStorage 전용, 앱 Repository와 분리
  providers/
    index.ts             providerType -> 어댑터 팩토리 레지스트리
    openaiImageProvider.ts  첫 구현체 (OpenAI Images). UI는 이 파일을 직접 모른다
  directGenerationService.ts  provider 해석 + 위임 (테스트용 팩토리 주입 가능)
  GenerationContext.tsx  useGenerationConfig / store / service 훅
  components/
    GenerateModal.tsx        내부 Generator 패널 (needs-provider/generating/success/error)
    GenerationSettings.tsx    기본 방식 + Direct 설정 (My GPT 설정은 기존 컴포넌트)
  index.ts               앱이 닿는 유일한 barrel
```

**켜기/끄기**: 기본은 **꺼짐**. `.env`(또는 배포 환경변수)에
`VITE_DIRECT_GENERATION=true` → Direct UI 표시. 값이 없거나 `true`가 아니면 모든
Direct UI 비표시, API Key 관련 안내 문구도 숨김, 키워드 클릭은 항상 My GPT.

**완전 삭제**: ① `src/generation/` 삭제 ② `src/main.tsx`의 `<GenerationProvider>`
래퍼 제거 ③ `src/App.tsx`·`src/components/settings/SettingsModal.tsx`의
`directGenerationEnabled` 분기(각 파일 상단 import 포함) 제거. → WOOJOO Stock Planner +
My GPT 정상 작동.

**보안**: 로컬 V1은 API Key 입력을 허용한다. Key는 이 브라우저 localStorage에만
있고 앱 저장소와 분리돼 있다. **운영 배포 시 번들 하드코딩 금지**, 키 저장/프록시
설계는 `generationConfig.ts` 한 파일 교체로 대응하도록 격리했다. 지금은 Cloudflare
/ D1 / 서버 비밀키 구조를 추가하지 않았다. 브라우저에서 `api.openai.com` 직접 호출은
CORS로 차단될 수 있으며, 그 경우 모달에 "서버 프록시가 필요합니다" 오류를 표시한다.

## 테스트 결과

- **단위 (vitest) — 100/100 통과**: `periods`(+Date 드리프트 스냅, `periodNoun`),
  `excel`(import upsert 매칭·언체크 반영·mirror 후보, template 작업단계 열, 백업에 credential 없음 검증),
  `grouping`, `calendar`
  (월 grid·요일 offset·윤년 2월·genMark O/X 규칙), `statusColumns`, `gptUrl`,
  `generationConfig`, `directGenerationService`, `openaiImageProvider`,
  **`buildDefaultStockPlan`**(365일 연속·하루 2개·730개·같은 날짜 2행·빈 키워드
  없음·완전 동일 중복 0·결정론·(월,일) 루프·Valentine 12-01/12-14·Christmas ~10월·
  Halloween ~8월·New Year ~11월·이벤트 당일 배치 안 함·이동형 이벤트 실제 날짜·
  단어 위주 2~7어절·서술형 없음·한정어 <40%·브랜드명 제외·윤년 창도 365/730).
- **E2E (Playwright, headless Chromium) — 35/35 통과 (Direct Generate off 시 7 skip)**:
  기본 365팩 렌더(창 windowed → 전체 보기 시 365그룹/730행/한국어), **목록 날짜 창**,
  작업체크 IndexedDB 영속, 선택체크 ↔ 작업체크 독립, **날짜 그룹에 선택 체크박스 없음**,
  **전체 선택(보이는 키워드만) + SelectionBar**, 키워드 추가, 체크 항목 추가,
  **저장 · 백업 탭(Local 안내·Excel 백업, 동기화 옵션 없음)**, 검색, 상태 필터,
  Full Export 내용 검증(같은 날짜 2행), **Template 헤더(작업단계 열 + FALSE)**,
  **Full Export 재import → 개수 불변(더블 없음)**, Excel Import 미리보기/커밋,
  My GPT 클릭마다 새 탭 + 복사·**GPT 열기 버튼**·
  **URL 검증**, Generator 미설정 경고,
  Settings 생성 탭, Direct fallback 모달·My GPT 전환, Direct 성공(목킹) → 이미지 +
  "생성" 자동 체크 + 영속, Direct 실패 → 체크 안 함, 모바일 가로 오버플로 없음,
  **Calendar**: 7열 grid + 과거 ○/×, 오늘·미래 마크 없음, 긴 키워드 ellipsis+title,
  하루 4개↑ → +N개 → 상세 모달, 캘린더 키워드 클릭 → 동일 generation handler,
  이전/다음 달 + [오늘], Weekly 계획에서 달력 탭 비활성, 모바일 agenda.

수동 확인 권장: Tablet 폭, 작업단계 6~7개일 때 데스크톱 정렬, 팝업 차단 브라우저
설정에서의 토스트 안내.

개발용 헬퍼: dev 모드에서 콘솔 `await __wipeAllData()` — 전체 데이터 삭제 후 리로드.

## 알려진 이슈 / 후속

- `xlsx@0.18.5`(npm 최신)에 알려진 보안 권고(프로토타입 오염/ReDoS)가 있다. 로컬
  전용 도구라 위험은 낮지만, 운영 전 교체 옵션: SheetJS 공식 CDN 최신판, 또는
  `exceljs`로 이전. 파서는 `domain/excel.ts` 한 곳에 격리돼 있어 교체가 쉽다.
- 번들 712KB(gzip 237KB) — 대부분 `xlsx`. Import/Export 시 `import()`로 지연 로딩하면
  초기 로드를 크게 줄일 수 있다(Phase 2).
- 작업단계 순서 변경은 ↑/↓ 버튼(드래그 핸들은 시각 표시만). 드래그 정렬은 후속.
- 빈 기간("+ 날짜/주/월 추가"로 만든 키워드 0개 그룹)은 `AppSetting`에 저장된다.
  버튼 라벨은 계획 유형에 따라 `날짜`/`주`/`월`(`periodNoun`).
- 목록 보기는 기본적으로 오늘 주변 2주만 렌더(위 "목록 보기 날짜 창"). `전체 보기`로
  365그룹/730행을 한 번에 그리면 초기 렌더가 수백 ms 걸린다 — 대규모 플랜은 달력
  보기·검색·날짜 창으로 탐색 권장. 가상 스크롤은 후속.
- 기본 seed 이벤트 날짜(Mother's/Father's Day, Thanksgiving 등)는 US 기준. 지역별
  pack은 `data/defaultStockKeywords`를 복제·교체하는 방식으로 확장.

## Phase 2 후보 (미구현)

진행률 상세, 고급 필터, Full Excel Restore(별도 UI), Prompt Template 설정,
키워드 Expand, 다중 Generator/Provider 고급 UI, Generation Profile, Reference Image,
채팅형 이미지 수정(`editImage`), 동적 모델 목록(`getAvailableModels`),
AI 프롬프트 자동 생성.
