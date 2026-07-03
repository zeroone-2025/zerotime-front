# zerotime-front

전북대 공지 알림 웹/네이티브 앱 — Next.js 16 + Capacitor(iOS/Android) + PWA.

> **이 파일이 에이전트 문서의 원본**이고 `CLAUDE.md`/`GEMINI.md`는 symlink다. 수정은 여기서 한다.
> 하네스(상위 디렉토리)에서 세션을 시작했다면 공통 컨텍스트(구조·배포·위키)는 이미
> `../AGENTS.md`로 로드되어 있다 — 이 문서는 이 repo 내부 규칙만 다룬다.

## 무엇을 하는 앱인가

전북대 게시판 공지를 구독 기반으로 보여주는 프론트엔드. 게시판 정의는
`app/_lib/constants/boards.ts`의 `BOARD_MAP`(활성 게시판 ~121개 — Pending 게시판은 크롤러
구현 후 추가하는 정책, 파일 상단 주석 참조). 키워드 알림·즐겨찾기·읽음 추적·친바(일정 조율)·
팀·커리어(flow) 기능 포함. **게스트 우선 설계**: 대부분의 화면이 비로그인으로 동작하고, 구독
게시판은 localStorage(`JB_ALARM_GUEST_FILTER`, 버전 관리됨)에 저장된다 — e2e 테스트 대부분이
게스트 플로우인 이유. 게스트 필터 마이그레이션 규칙: `docs/guest-filter-migration.md`.

## 핵심 제약 — 정적 export

`next.config.ts`가 **`output: 'export'`** 다 (+ `trailingSlash: true`, `images.unoptimized: true`).
빌드 산출물은 `out/`이고 Capacitor가 그대로 감싼다(`capacitor.config.ts`의 `webDir: 'out'`).

- **런타임 SSR·Route Handler·미들웨어는 쓸 수 없다.** 모든 데이터는 클라이언트에서 axios로
  백엔드를 호출한다.
- PWA(`@ducanh2912/next-pwa`)는 dev와 Capacitor 빌드(`CAPACITOR_BUILD=true`)에서 비활성이다.

## 실행·빌드·테스트

```bash
npm run dev              # 개발 서버 :3000 (--webpack — Turbopack 아님)
npm run build            # 정적 export → out/
npm run lint             # ESLint
npm test                 # Vitest 유닛 테스트 (app/**/*.test.ts(x), e2e/ 제외)
npm run test:coverage    # 커버리지 (대상: app/_lib, app/_components)
npm run test:e2e         # Playwright — chromium(Desktop) + mobile(Pixel 7), 게스트 플로우 스모크
                         #   + e2e/visual/ 비주얼 회귀. dev 서버 자동 기동(reuseExistingServer)
```

- 백엔드가 필요하면 하네스의 `../dev.sh back` (백엔드는 :8080).
- `./run-dev.sh` — 웹 개발 서버 (크로스 플랫폼: macOS/Linux). `.env.local` 준비(localhost 고정)
  후 `next dev`. 하네스 `../dev.sh front`가 이 스크립트로 위임한다.
- iOS/Capacitor 작업은 `./run-ios.sh` (**Mac 전용** — xcrun·시뮬레이터 전제):
  API 환경 선택(local/dev/beta/prod — 인자로도 지정 가능) → 빌드 → `cap sync ios` → Xcode 열기.
  local 선택 시 LAN IP를 자동 감지해 실기기 접속을 지원한다.
  상세: `docs/ios-dev-guide.md`, 스토어 배포는 `IOS_RELEASE_CHECKLIST.md`

## 백엔드 연결 — 환경변수 2개

`app/_lib/api/client.ts`의 `getApiBaseUrl()`이 플랫폼을 감지해 고른다:

| 변수 | 대상 | 기본값 |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL_WEB` | 웹(및 빌드타임 프리렌더) | `http://localhost:8080` |
| `NEXT_PUBLIC_API_BASE_URL_NATIVE` | Capacitor 네이티브 | `https://dev-api.zerotime.kr:18181` ⚠️ localhost 아님 |

- `.env.local`은 `.env.sample`을 복사해 만든다 (`YOUR_LOCAL_IP` 플레이스홀더를 `run-dev.sh`가
  localhost로 치환). NATIVE URL은 `run-ios.sh`가 빌드 시점에 환경변수로 주입한다 —
  스크립트가 `.env.local`을 고쳐 쓰지 않는다.
- ⚠️ `next.config.ts`의 단일 `NEXT_PUBLIC_API_BASE_URL` env 노출은 **레거시 미사용**이다 —
  `client.ts`는 읽지 않는다. 혼동하지 말 것.
- ⚠️ 터널 전환(2026-07-04) 이전의 옛 NAT 포트 `:18181`이 아직 두 곳에 남아 있다 —
  `capacitor.config.ts`의 `allowNavigation`과 `client.ts`의 네이티브 폴백(위 표의 기본값).
  정리 전까지 네이티브 빌드는 `NEXT_PUBLIC_API_BASE_URL_NATIVE`를 명시해서 쓴다.

## 디렉토리 컨벤션

Next.js private folder(언더스코어 접두사 = 라우팅 제외):

- `app/_lib/` — API 클라이언트, hooks, 상수, store (상세: `app/_lib/CLAUDE.md`)
- `app/_components/` — 공유 컴포넌트 (상세: `app/_components/CLAUDE.md`)
- `app/_context/` — React Context (Toast, NotificationBadge)
- `app/_types/` — 도메인별 TypeScript 타입

Route Groups:

- `app/(auth)/` — login, auth/callback, onboarding
- `app/(main)/` — `(home)`, chinba(create/event/my/team), filter, flow(career/companies/profile),
  keywords, notifications, profile, teams(create/detail/join/settings)
- 각 라우트는 자체 `_components/`, `_hooks/`를 가질 수 있다.
- 시간표는 독립 라우트가 없다 — `_components/timetable`, `_types/timetable.ts`로만 존재.

## 아키텍처

### 상태 관리

- **Zustand** `app/_lib/store/useUserStore.ts` — 사용자 전역 상태
- **React Query**(`app/providers.tsx`) — 서버 상태 (공지 목록, 무한 스크롤)
- **localStorage** — 게스트 구독 게시판 (`useSelectedCategories` hook)

### 인증

OAuth 2.0 → JWT. Access Token은 **메모리**(`app/_lib/auth/tokenStore.ts` — localStorage에는
`session_hint`만), Refresh Token은 HttpOnly 쿠키(path `/auth`, 14일).
axios interceptor가 401 시 큐 기반 자동 리프레시 — `Authorization` 헤더가 있던 요청만 대상.
상세: `app/_lib/api/client.ts`.

### 홈 필터링

`app/(main)/(home)/page.tsx` 2단계: ① 구독 게시판 필터(`selectedCategories`) →
② 카테고리 필터(`ALL`/`UNREAD`/`KEYWORD`/`FAVORITE`).

### 스타일링

- **Tailwind CSS v4** — 설정면이 **두 곳**이다: `app/globals.css`의 `@theme`
  (custom md breakpoint 832px = 52rem 등) + 레거시 `tailwind.config.js`(동적 색상 safelist).
  breakpoint·테마는 globals.css, 동적 클래스 safelist는 config에.
- Custom CSS: `no-scrollbar`, safe-area 유틸리티, fadeIn/slideUp (`app/globals.css`)

### 주요 의존성

Next.js 16 + React 19, @capacitor/* 8.x, @ducanh2912/next-pwa, @tanstack/react-query, zustand,
axios, dayjs(ko locale), react-icons, react-intersection-observer, Playwright, Vitest.

## 코드 스타일

- ESLint: core-web-vitals + TS. import 순서: React → 외부 → 내부 alias(`@/_lib/*`, `@/_components/*`)
  → 상대 경로. unused vars: error / explicit any: warn. Prettier 통합.
- 스타일은 Tailwind 유틸리티 클래스로.

## Git 컨벤션 (요약)

본문은 하네스 위키 [git-conventions](../wiki/platform/git-conventions.md) — 어긋나면 위키가 기준.

- 커밋: `<type>(<scope>): <한글 설명>` (+ 이슈 있으면 본문에 `Refs #NN`).
  type(영문): feat / fix / docs / style / refactor / perf / test / build / chore / ci.
  scope(영문, 선택): auth, alarm, chinba, ui, filter, keywords, profile, notification, timetable 등.
- 브랜치: `<type>/<짧은-설명>`, 이슈 있으면 `<type>/#NN-<짧은-설명>`.
  develop 반영은 로컬 develop에 merge commit으로 머지 → push (PR은 Epic 등 리뷰 필요 시 선택).
  에이전트는 로컬 develop 머지까지 — push는 사람이 한다 (공유 설정이 차단).
  Epic 단위 작업은 `develop`에서 Epic 브랜치를 따고 하위 브랜치를 Epic으로 머지한 뒤 Epic → `develop`.
- **AI 세션은 항상 worktree에서 작업한다**: `git worktree add .worktrees/<슬러그> -b <브랜치> origin/develop`
  으로 시작 — checkout된 브랜치에 직접 커밋 금지 (`.worktrees/`는 gitignore됨).
- **push = 배포다**: `develop` → dev, `beta`/`main` → 실서버 (환경·도메인 표는 하네스 `../AGENTS.md`).
  promote는 배포 담당자가 한다.

## 세션 간 지식 저장소 — 하네스 위키

상위 하네스의 `../wiki/`에 트러블슈팅 사례·운영 절차·과거 결정(ADR)이 쌓여 있다.

- **같은 에러·증상에 2회 이상 막히면** 계속 파기 전에 `grep -ri "<키워드·에러문자열>" ../wiki/` 먼저.
- 배포·인프라 절차는 `../wiki/platform/`, "왜 이렇게 되어 있지?"는 `../wiki/decisions/`.
- 신뢰·기록 규칙은 `../wiki/SCHEMA.md`, 색인은 `../wiki/index.md` — verified만 신뢰,
  위키↔코드 불일치 시 코드가 맞다.
- AI 세션은 하네스 루트 시작이 기본이다 — 이 repo에서 직접 시작하면 하네스 스킬·캡처 훅이
  로드되지 않는다.
