import { describe, it, expect } from 'vitest';

import type { BoardInfo } from '@/_lib/api/boards';

import { filterBoardCodesToSchool } from './BoardFilterContent';

const makeBoard = (board_code: string): BoardInfo => ({
  board_code,
  name: board_code,
  school: '전남대',
  category: '본부',
  default_subscribe: false,
});

describe('filterBoardCodesToSchool (F010)', () => {
  it('현재 학교 boardList에 없는 board_code는 제외하고, 있는 코드는 유지한다', () => {
    // 현재 학교(전남대) 게시판: jnu_home 만 존재. jbnu_home 은 타 학교 코드.
    const boardList = [makeBoard('jnu_home'), makeBoard('jnu_dept_cs')];
    const groupCodes = ['jnu_home', 'jbnu_home'];

    const result = filterBoardCodesToSchool(groupCodes, boardList);

    expect(result).toEqual(['jnu_home']);
    expect(result).not.toContain('jbnu_home');
  });

  it('모든 코드가 현재 학교에 존재하면 순서대로 그대로 유지한다', () => {
    const boardList = [makeBoard('jnu_home'), makeBoard('jnu_dept_cs')];
    const groupCodes = ['jnu_dept_cs', 'jnu_home'];

    expect(filterBoardCodesToSchool(groupCodes, boardList)).toEqual(['jnu_dept_cs', 'jnu_home']);
  });

  it('boardList가 비어 있으면 빈 배열을 반환한다', () => {
    expect(filterBoardCodesToSchool(['jnu_home'], [])).toEqual([]);
  });
});
