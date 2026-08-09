/**
 * 프론트 기능 토글 — 빌드타임 상수.
 * 정적 export(`output: 'export'`)라 런타임 플래그를 쓸 수 없어 상수로 둔다.
 * 되살릴 때는 값만 true로 바꾼다.
 *
 * 타입을 `boolean`으로 명시하는 이유: 생략하면 리터럴 타입으로 추론되어
 * TS가 사용처를 죽은 코드로 좁힌다.
 */

/**
 * 활동 기록 폼의 '조별 점수' 입력란.
 * 랭킹 기능 미사용 결정(2026-07)으로 꺼둠 — 백엔드 점수·랭킹 API와
 * 이미 기록된 점수 데이터는 그대로 살아 있고, '랭킹' 탭도 그대로 노출된다.
 */
export const CHINBA_GROUP_SCORING_ENABLED: boolean = false;

/**
 * 팀 상세의 '랭킹'(잡아봐) 탭.
 * 추후 업데이트로 재공개 예정(2026-07 결정) — 탭 버튼은 그대로 두되 진입을 막고
 * "추후 업데이트 예정입니다" 안내만 띄운다. 백엔드 랭킹 API·데이터는 그대로 살아 있다.
 */
export const CHINBA_RANKING_TAB_ENABLED: boolean = false;

/**
 * 팀 상세의 '랭킹' 탭 버튼 노출 자체.
 * 애플 앱 심사는 미완성 기능 노출을 불허해 버튼까지 숨김(2026-08 결정) —
 * 심사 통과 후 dev에서 true로 되돌려 버튼(+진입 차단 안내)을 복구한다.
 * false면 CHINBA_RANKING_TAB_ENABLED와 무관하게 탭이 렌더되지 않는다.
 */
export const CHINBA_RANKING_TAB_VISIBLE: boolean = false;

/**
 * 응답 현황(운영 패널)의 미제출자 '알림' 버튼.
 * 백엔드 미비로 "준비 중" 토스트만 띄우는 빈껍데기라 앱 심사 대비 숨김(2026-08 결정) —
 * 심사 통과 후 dev에서 true로 되돌린다. '복사' 버튼은 완성 기능이라 그대로 노출.
 */
export const CHINBA_UNSUBMITTED_NOTIFY_ENABLED: boolean = false;

/**
 * 해시태그(일정 카테고리) — 관리 모달·일정/활동 폼의 선택·필터바·배지 전부.
 * 조/그룹 기능과 역할이 겹쳐 숨김(2026-08 결정). 백엔드 event-categories API와
 * 이미 기록된 해시태그 데이터는 그대로 살아 있다.
 */
export const CHINBA_HASHTAG_ENABLED: boolean = false;
