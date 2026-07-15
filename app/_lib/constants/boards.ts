/**
 * 게시판 관련 UI 상수
 *
 * 게시판 이름/카테고리는 더 이상 여기 하드코딩하지 않는다 — 학교가 늘어날
 * 때마다(전북대→전남대→경북대→충남대) 매번 목록을 손으로 옮겨 적어야 했고,
 * 실제로 신규 학교 게시판이 이 파일에 누락되어 화면에 아예 안 뜨는 문제가
 * 있었다. `GET /boards`가 school/category를 함께 반환하므로 이제 그쪽을
 * 근거로 삼는다 (app/_lib/hooks/useBoards.ts, app/_lib/api/boards.ts 참고).
 */
import type { BoardCategory, BoardInfo } from '@/_lib/api/boards';

export type { BoardCategory };

/**
 * LocalStorage 저장 키 (Guest 사용자용)
 */
export const GUEST_FILTER_KEY = 'JB_ALARM_GUEST_FILTER';

/**
 * GUEST_FILTER_KEY에 저장된 board_codes가 어느 학교 기준으로 계산됐는지 기록하는 키.
 * useGuestSchool()의 학교와 다르면(마이그레이션 필요 신호) 기본값을 다시 계산한다.
 */
export const GUEST_FILTER_SCHOOL_KEY = 'JB_ALARM_GUEST_FILTER_SCHOOL';

/**
 * 게스트가 고른 "둘러보는 학교" 저장 키. 로그인 사용자는 안 쓴다(user.school이 기준).
 */
export const GUEST_SCHOOL_KEY = 'JB_ALARM_GUEST_SCHOOL';

/**
 * 게스트 학교 선택 드롭다운에 보여줄 학교 목록.
 */
export const GUEST_SCHOOL_OPTIONS = ['전북대', '전남대', '경북대', '충남대'] as const;

export const DEFAULT_GUEST_SCHOOL = '전북대';

/**
 * 게시판 목록에서 기본 구독 대상(board.default_subscribe === true)만 board_code로 뽑는다.
 * 정책(어떤 게시판이 기본값인지)은 백엔드가 결정하므로(`GET /boards`의 default_subscribe
 * 필드) 프론트는 그 값을 그대로 필터링만 한다.
 */
export const getDefaultBoardCodes = (boards: BoardInfo[]): string[] =>
  boards.filter((board) => board.default_subscribe).map((board) => board.board_code);

/**
 * 카테고리 표시 순서
 */
export const CATEGORY_ORDER: BoardCategory[] = ['본부', '단과대', '학과', '사업단'];

/**
 * 카테고리별 배지 색상 (게시판 개별 색상 대신 카테고리 단위로 단순화)
 */
export const CATEGORY_COLORS: Record<BoardCategory, string> = {
  본부: 'blue',
  단과대: 'gray',
  학과: 'orange',
  사업단: 'green',
};

/**
 * 색상 이름을 Tailwind CSS 클래스로 변환
 */
export const getColorClasses = (color: string) => {
  const colorMap: Record<string, { bg: string; text: string }> = {
    blue: { bg: 'bg-blue-100', text: 'text-blue-700' },
    green: { bg: 'bg-green-100', text: 'text-green-700' },
    gray: { bg: 'bg-gray-100', text: 'text-gray-700' },
    indigo: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
    orange: { bg: 'bg-orange-100', text: 'text-orange-700' },
    sky: { bg: 'bg-sky-100', text: 'text-sky-700' },
    teal: { bg: 'bg-teal-100', text: 'text-teal-700' },
  };

  return colorMap[color] || colorMap.gray;
};

/**
 * 게스트 기본 필터 게시판 목록 — 전북대 하드코딩 폴백.
 *
 * 정상 경로에서는 `getDefaultBoardCodes()`로 `GET /boards`의
 * default_subscribe 값을 학교별로 동적으로 가져온다. 이 상수는 그 API
 * 호출이 실패했을 때만 쓰는 최후 폴백이다 — 평소엔 안 쓰인다.
 */
export const GUEST_DEFAULT_BOARDS = [
  'home_campus', 'home_student', 'home_lecture',
  'home_news', 'home_contest', 'home_parttime', 'agency_sw',
];
