import { useQuery } from '@tanstack/react-query';

import { getBoards, BoardInfo } from '@/_lib/api/boards';

/**
 * 전체 게시판 목록 조회 훅 (학교 무관 - 전체 4개교 830여개)
 *
 * board_code -> {name, school, category} 조회가 필요한 곳(CategoryBadge 등)에서
 * 쓴다. 게시판 구성은 자주 안 바뀌므로 staleTime을 길게 잡는다.
 */
export function useAllBoards() {
  return useQuery<BoardInfo[]>({
    queryKey: ['boards', 'all'],
    queryFn: () => getBoards(),
    staleTime: 1000 * 60 * 60, // 1시간
  });
}

/**
 * 특정 학교 게시판 목록 조회 훅 (게시판 선택 화면용)
 */
export function useBoardsBySchool(school: string | undefined) {
  return useQuery<BoardInfo[]>({
    queryKey: ['boards', 'school', school],
    queryFn: () => getBoards(school),
    enabled: Boolean(school),
    staleTime: 1000 * 60 * 60, // 1시간
  });
}
