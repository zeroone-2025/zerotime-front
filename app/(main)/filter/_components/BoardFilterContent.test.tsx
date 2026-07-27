import { describe, it, expect } from 'vitest';

import type { BoardInfo } from '@/_lib/api/boards';

import { displayBoardName, filterBoardCodesToSchool } from './BoardFilterContent';

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

describe('displayBoardName', () => {
  it('끝의 "공지" 접미사를 제거한다', () => {
    expect(displayBoardName('컴퓨터공학부 공지')).toBe('컴퓨터공학부');
    expect(displayBoardName('전자공학부 공지')).toBe('전자공학부');
  });

  it('중간에 있는 단어는 건드리지 않고 끝의 접미사만 뗀다', () => {
    expect(displayBoardName('영어영문학부 영어전공 공지')).toBe('영어영문학부 영어전공');
  });

  it('"공지"로 끝나지 않는 이름은 그대로 둔다', () => {
    expect(displayBoardName('학사 공지사항')).toBe('학사 공지사항');
    expect(displayBoardName('도서관')).toBe('도서관');
  });

  it('이름이 "공지" 자체이면(제거 시 빈 문자열) 원본을 그대로 둔다', () => {
    expect(displayBoardName('공지')).toBe('공지');
  });
});
