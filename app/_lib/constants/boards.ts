/**
 * 게시판 관련 UI 상수
 *
 * 게시판 이름/카테고리는 더 이상 여기 하드코딩하지 않는다 — 학교가 늘어날
 * 때마다(전북대→전남대→경북대→충남대) 매번 목록을 손으로 옮겨 적어야 했고,
 * 실제로 신규 학교 게시판이 이 파일에 누락되어 화면에 아예 안 뜨는 문제가
 * 있었다. `GET /boards`가 school/category를 함께 반환하므로 이제 그쪽을
 * 근거로 삼는다 (app/_lib/hooks/useBoards.ts, app/_lib/api/boards.ts 참고).
 */
import type { BoardCategory } from '@/_lib/api/boards';

export type { BoardCategory };

/**
 * LocalStorage 저장 키 (Guest 사용자용)
 */
export const GUEST_FILTER_KEY = 'JB_ALARM_GUEST_FILTER';

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
 * 게스트 필터 버전 (기본값 변경 시 증가)
 * 버전이 다르면 localStorage를 새 기본값으로 덮어씁니다.
 */
export const GUEST_FILTER_VERSION = 2;

/**
 * 게스트 기본 필터 게시판 목록
 *
 * 학교 선택 전(비로그인) 상태의 기본값이라 전북대 게시판으로 고정한다.
 * 온보딩에서 다른 학교를 선택해도 이 기본값이 그대로 섞여 들어가는 문제는
 * 별도 이슈 — OnboardingModal의 buildStudentBoardCodes()가 학교 무관하게
 * 이 상수를 베이스로 쓰고 있다.
 */
export const GUEST_DEFAULT_BOARDS = [
  'home_campus', 'home_student', 'home_lecture',
  'home_news', 'home_contest', 'home_parttime', 'agency_sw',
];
