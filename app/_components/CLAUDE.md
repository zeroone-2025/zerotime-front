# _components

`app/_components/` — 여러 페이지에서 공유하는 컴포넌트. 특정 페이지에서만 쓰이는 컴포넌트는 해당 라우트의 `_components/` 폴더에 배치 (예: `app/(main)/(home)/_components/NoticeCard.tsx`).

## Layout (`layout/`)

| 컴포넌트 | 역할 |
|---------|------|
| `MobileSidebar` | 모바일 사이드 메뉴 (슬라이드) |
| `DesktopSidebar` | 데스크톱 고정 사이드바 (260px) |
| `SidebarContent` | 사이드바 공통 내용 (로그인/메뉴) |
| `SharedHeader` | 페이지 공통 헤더 |
| `FullPageModal` | 전체화면 모달 |
| `BottomSheet` | 하단 시트 (드래그 지원) |
| `AuthPageShell` | 인증 페이지 레이아웃 쉘 |

## UI (`ui/`)

범용 UI 컴포넌트: Button, Toast, ConfirmModal, LoadingSpinner, Logo, ScrollToTop, PullToRefreshIndicator 등.

- `CategoryFilter.tsx` — 필터 바 (전체/안읽음/키워드/즐겨찾기). 좌측 설정 버튼 + 우측 가로 스크롤 칩. Sticky 포지셔닝.
- `CategoryBadge.tsx` — 게시판 색상 뱃지

## Auth (`auth/`)

소셜 로그인 버튼 컴포넌트: GoogleLoginButton, SocialLoginButton, LoginButtonGroup, UserInfoForm.

## Timetable (`timetable/`)

시간표 관련: TimetableGrid, TimetableTab, AddClassModal, ClassDetailSheet, UnmatchedQueue.

## System (`system/`)

DevHostMetaTag, ServiceWorkerRegistration 등 시스템 유틸리티 컴포넌트.

## 페이지별 컴포넌트 (참고)

- `app/(main)/(home)/_components/` — NoticeCard, OnboardingModal, UserStatsBanner, KeywordSettingsBar 등
- `app/(main)/chinba/_components/` — 친바 이벤트 관련 (HeatmapGrid, ScheduleGrid 등)
- `app/(main)/filter/_components/` — 게시판 필터 설정 (BoardFilterContent 등)
- `app/(main)/profile/_components/` — 커리어 프로필 섹션들

## Styling Rules

- Tailwind 동적 색상: `CATEGORY_COLORS`(`_lib/constants/boards.ts`)의 색상값이 런타임에 적용되므로, `tailwind.config.js`의 safelist에 `bg-{color}-{shade}`, `text-{color}-{shade}` 패턴이 등록되어 있어야 함
- 새 색상 추가 시 safelist 업데이트 필수
