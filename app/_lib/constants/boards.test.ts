import { describe, expect, it } from 'vitest';

import { GUEST_SCHOOL_OPTIONS, SCHOOL_FULL_NAME, SUPPORTED_SCHOOLS } from './boards';


describe('학교 선택 상수', () => {
  it('게스트와 로그인 사용자에게 부산대를 같은 값으로 노출한다', () => {
    expect(GUEST_SCHOOL_OPTIONS).toContain('부산대');
    expect(SCHOOL_FULL_NAME['부산대']).toBe('부산대학교');
  });

  it('지원 학교 목록과 전체 이름 매핑이 서로 어긋나지 않는다', () => {
    expect(SUPPORTED_SCHOOLS).toEqual(Object.keys(SCHOOL_FULL_NAME));
    expect(GUEST_SCHOOL_OPTIONS).toBe(SUPPORTED_SCHOOLS);
  });
});
