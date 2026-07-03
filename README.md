<p align="center">
  <img src="assets/logo.svg" alt="ZeroTime" width="220" />
</p>

<p align="center">
  <b>전북대학교 공지, 이제 한곳에서 — 제로타임</b><br />
  교내 150개+ 게시판의 공지를 구독 기반으로 모아보고, 키워드 알림으로 놓치지 않는 서비스
</p>

<p align="center">
  <a href="https://zerotime.kr"><img src="https://img.shields.io/badge/서비스-zerotime.kr-2563eb" alt="Production" /></a>
  <img src="https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS 4" />
  <img src="https://img.shields.io/badge/Capacitor-8-119EFF?logo=capacitor&logoColor=white" alt="Capacitor 8" />
</p>

---

전북대 공지사항은 본부·단과대·학과·사업단 홈페이지에 흩어져 있어, 학생이 장학금·행사·채용 공지를
놓치기 쉽습니다. **제로타임**은 이 공지들을 한곳에 모아 내가 구독한 게시판만 보여주고,
키워드가 매칭되면 알려줍니다. 이 저장소는 그 프론트엔드로, **한 코드베이스에서 웹·PWA·iOS·Android를
모두 빌드**합니다.

- 🌐 **운영**: https://zerotime.kr
- 🧪 **개발**: https://dev.zerotime.kr
- 🔌 **백엔드 API**: [zerotime-back](https://github.com/zeroone-2025/zerotime-back) (FastAPI)

## 목차

- [주요 기능](#주요-기능)
- [기술 스택](#기술-스택)
- [아키텍처](#아키텍처)
- [시작하기](#시작하기)
- [폴더 구조](#폴더-구조)
- [테스트](#테스트)
- [네이티브 앱 (Capacitor)](#네이티브-앱-capacitor)
- [배포](#배포)
- [기여](#기여)

## 주요 기능

- 📄 **통합 공지 피드** — 150개+ 게시판(본부·단과대·학과·사업단) 공지를 하나의 리스트로. 무한 스크롤과 로딩 스켈레톤으로 네이티브 앱 같은 사용감을 냅니다.
- 🎛️ **구독 필터** — 내가 고른 게시판만 피드에 표시. 전체 / 안 읽음 / 키워드 / 즐겨찾기 탭으로 2차 필터링합니다.
- 🔔 **키워드 알림** — "장학", "인턴" 같은 키워드를 등록하면 매칭된 공지를 따로 모아 보여줍니다.
- ✅ **읽음·즐겨찾기** — 공지별 읽음 상태를 추적하고, 나중에 볼 공지는 즐겨찾기에 보관합니다.
- 🗓️ **친바** — 팀·그룹의 일정 조율. 참가자들의 가능 시간을 모아 겹치는 시간을 찾고, 랭킹으로 참여를 독려합니다.
- 📅 **시간표** — 학기별 시간표 관리. 시간표 이미지를 올리면 AI가 인식해 자동 입력합니다.
- 💼 **커리어 프로필** — 학력·경력·활동을 정리하는 프로필.
- 📱 **어디서나** — 브라우저, 홈 화면 설치(PWA), iOS/Android 네이티브 앱을 모두 지원합니다.
- 🔐 **소셜 로그인** — Google · Apple · Naver · Kakao.

## 기술 스택

| 분류 | 선택 | 비고 |
|---|---|---|
| 프레임워크 | Next.js 16 (App Router) + React 19 + TypeScript | `output: 'export'` 정적 빌드 — Capacitor가 그대로 감쌈 |
| 스타일 | Tailwind CSS v4 | 태블릿 호환용 커스텀 `md` breakpoint(832px) |
| 서버 상태 | @tanstack/react-query | 공지 목록, 무한 스크롤, 캐싱 |
| 클라이언트 상태 | Zustand | 사용자 전역 상태 (`app/_lib/store/`) |
| HTTP | Axios | JWT interceptor — 401 시 큐 기반 자동 토큰 갱신 |
| 네이티브 | Capacitor 8 | iOS/Android, appId `kr.zerotime.app` |
| PWA | @ducanh2912/next-pwa | Service Worker 수동 등록, API는 NetworkFirst 캐싱 |
| 테스트 | Vitest + Playwright | 단위 + E2E·비주얼 리그레션 |

## 아키텍처

한 번의 정적 빌드(`out/`)가 세 플랫폼으로 나갑니다:

```mermaid
graph LR
    Code[Next.js 정적 빌드 out/] --> Web[웹 · PWA<br/>Vercel]
    Code --> IOS[iOS 앱<br/>Capacitor]
    Code --> AND[Android 앱<br/>Capacitor]
    Web --> API[zerotime-back API]
    IOS --> API
    AND --> API
```

- **플랫폼별 API 주소** — 웹과 네이티브가 서로 다른 주소를 쓸 수 있게 환경 변수를 분리했습니다. 감지 로직: `app/_lib/api/client.ts`의 `getApiBaseUrl()`.
- **인증** — OAuth 2.0 → JWT. Access Token은 메모리에, Refresh Token은 HttpOnly 쿠키에 보관. Axios interceptor가 401 응답을 가로채 토큰을 갱신한 뒤 실패한 요청을 재시도합니다(동시 요청은 큐로 직렬화).
- **홈 피드 필터링** — ① 구독한 게시판으로 거르고 → ② 전체/안읽음/키워드/즐겨찾기 탭으로 거르는 2단계 파이프라인 (`app/(main)/(home)/`).
- **게시판 정의** — `app/_lib/constants/boards.ts`의 `BOARD_MAP`에 150개+ 게시판의 이름·색·카테고리가 모여 있습니다. 게시판 추가는 이 파일 한 곳만 고치면 됩니다.

## 시작하기

### 필수 조건

- Node.js 18 이상
- 백엔드 API — 기본값 `http://localhost:8080`. [zerotime-back](https://github.com/zeroone-2025/zerotime-back)을 로컬에서 실행하세요.

> 팀 공용 작업공간(zerotime-harness)에서 작업한다면 하네스 루트의 `./dev.sh`가 백엔드·프론트를 tmux로 함께 띄웁니다.

### 설치와 실행

```bash
git clone https://github.com/zeroone-2025/zerotime-front.git
cd zerotime-front
npm install

cp .env.sample .env.local   # API 주소 설정
npm run dev                  # → http://localhost:3000
```

또는 검사·설치·실행을 한 번에 해주는 스크립트를 써도 됩니다: `./run-dev.sh`

### 환경 변수

| 변수 | 용도 |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL_WEB` | 웹 브라우저에서 사용할 API 주소 |
| `NEXT_PUBLIC_API_BASE_URL_NATIVE` | Capacitor 네이티브 앱에서 사용할 API 주소 |

정적 export라서 환경 변수는 **빌드 타임에 고정**됩니다 — 값을 바꿨다면 다시 빌드해야 합니다.

### npm 스크립트

| 명령 | 동작 |
|---|---|
| `npm run dev` | 개발 서버 (http://localhost:3000) |
| `npm run build` | 프로덕션 정적 빌드 (`out/`) |
| `npm run lint` | ESLint |
| `npm run test` / `test:run` | Vitest 단위 테스트 (watch / 1회) |
| `npm run test:e2e` / `test:e2e:ui` | Playwright E2E (전체 / UI 디버깅 모드) |

## 폴더 구조

Next.js private folder 컨벤션을 사용합니다 — 언더스코어 접두사 폴더는 라우팅에서 제외됩니다.

```
app/
├── (auth)/              # 로그인, OAuth 콜백, 온보딩
├── (main)/              # 메인 앱 (로그인 후)
│   ├── (home)/          #   홈 — 공지 피드 + 2단계 필터링
│   ├── filter/          #   게시판 구독 설정
│   ├── keywords/        #   키워드 관리
│   ├── notifications/   #   알림
│   ├── chinba/ teams/   #   친바 — 일정 조율·팀
│   ├── flow/            #   커리어 플로우
│   └── profile/         #   프로필
├── _components/         # 전역 공유 컴포넌트
│   ├── layout/          #   레이아웃 (Sidebar 등)
│   ├── ui/              #   재사용 UI (Toast, Badge 등)
│   └── system/          #   시스템 (ServiceWorker 등록 등)
├── _lib/                # 로직 계층
│   ├── api/             #   도메인별 API 클라이언트 + axios 설정
│   ├── hooks/           #   커스텀 훅
│   ├── store/           #   Zustand 스토어
│   └── constants/       #   BOARD_MAP 등 상수
├── _context/            # React Context providers
└── _types/              # TypeScript 타입 정의
```

각 라우트는 자체 `_components/`, `_hooks/` 폴더를 가질 수 있습니다 (기능 단위 응집).

## 테스트

### 단위 테스트 (Vitest)

```bash
npm run test          # watch 모드
npm run test:coverage # 커버리지 리포트
```

### E2E 테스트 (Playwright)

**백엔드 없이 돌아갑니다** — `page.route()`로 API를 가로채 목 데이터를 반환하므로,
CI에서도 프론트만으로 전 페이지를 검증할 수 있습니다.

```bash
npm run test:e2e                          # 전체
npx playwright test e2e/filter.spec.ts    # 특정 페이지만
npm run test:e2e:ui                       # UI 모드 디버깅
```

- **인증 상태 제어** — `asGuest` / `asLoggedInUser` 픽스처로 로그인/비로그인 시나리오 전환 (`e2e/fixtures/auth.fixture.ts`)
- **비주얼 리그레션** — `toHaveScreenshot()` 스크린샷 비교. 기준 이미지는 git으로 관리하며, UI를 의도적으로 바꿨다면 갱신합니다:
  ```bash
  npx playwright test e2e/visual/ --update-snapshots
  ```

## 네이티브 앱 (Capacitor)

정적 빌드 결과(`out/`)를 Capacitor가 감싸 네이티브 앱으로 만듭니다. 설정: `capacitor.config.ts`

```bash
npm run build            # out/ 생성
npx cap sync             # ios/, android/ 프로젝트에 반영
npx cap open ios         # Xcode 열기 (Mac)
npx cap open android     # Android Studio 열기
```

- **iOS 개발** — Mac에서 `./run-ios.sh` 한 번으로 빌드→sync→시뮬레이터 실행. 상세: [docs/ios-dev-guide.md](docs/ios-dev-guide.md)
- **스토어 릴리스** — [IOS_RELEASE_CHECKLIST.md](IOS_RELEASE_CHECKLIST.md)의 체크리스트를 따릅니다.
- 네이티브에서는 `CapacitorHttp`·`CapacitorCookies` 플러그인으로 쿠키 기반 인증을 유지합니다.

## 배포

- **웹** — Vercel이 브랜치 push를 감지해 환경별로 자동 배포합니다 (`develop` → dev.zerotime.kr, `main` → zerotime.kr).
- **네이티브** — 릴리스 체크리스트에 따라 수동으로 App Store / Play Store에 제출합니다.

## 기여

이슈 제보와 Pull Request를 환영합니다.

1. 기능 브랜치를 만듭니다 — `feature/#<이슈번호>-<짧은설명>`
2. 커밋은 `<type>(<scope>): <설명>` 형식 (한글 설명):
   ```
   feat(keywords): 키워드 추천 목록 추가
   fix(auth): OAuth 콜백 토큰 파싱 오류 수정
   ```
3. `develop` 브랜치로 PR을 보냅니다.

타입·스코프 전체 목록과 Epic 브랜치 전략은 [CLAUDE.md](CLAUDE.md)의 Git Conventions 절에 있습니다.

## 더 읽을 문서

| 문서 | 내용 |
|---|---|
| [docs/ios-dev-guide.md](docs/ios-dev-guide.md) | iOS 개발 환경 가이드 |
| [IOS_RELEASE_CHECKLIST.md](IOS_RELEASE_CHECKLIST.md) | 앱스토어 릴리스 체크리스트 |
| [CAPACITOR_PLAN.md](CAPACITOR_PLAN.md) | Capacitor 도입 계획·이력 |
| [CLAUDE.md](CLAUDE.md) | AI 에이전트용 컨텍스트 |

---

<p align="center">
  <sub>Made by <a href="https://github.com/zeroone-2025">ZeroOne</a> — 전북대학교</sub>
</p>
