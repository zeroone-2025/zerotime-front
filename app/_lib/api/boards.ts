import api from './client';

export type BoardCategory = '본부' | '단과대' | '학과' | '사업단';

export interface BoardInfo {
  board_code: string;
  name: string;
  school: string;
  category: BoardCategory;
  default_subscribe: boolean;
}

/**
 * 활성 게시판 목록 조회
 * @param school 소속 대학으로 필터링 (예: "전북대", "전남대", "경북대", "충남대", "충북대", "부산대"). 미지정 시 전체 학교.
 */
export const getBoards = async (school?: string) => {
  const response = await api.get<BoardInfo[]>('/boards', {
    params: school ? { school } : {},
  });
  return response.data;
};
