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
 * 해시태그(일정 카테고리) — 관리 모달·일정/활동 폼의 선택·필터바·배지 전부.
 * 조/그룹 기능과 역할이 겹쳐 숨김(2026-08 결정). 백엔드 event-categories API와
 * 이미 기록된 해시태그 데이터는 그대로 살아 있다.
 */
export const CHINBA_HASHTAG_ENABLED: boolean = false;
