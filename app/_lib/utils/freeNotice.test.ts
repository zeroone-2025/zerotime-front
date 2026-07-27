import { describe, it, expect, beforeEach } from 'vitest';

import { hasSeenFreeNotice, markFreeNoticeSeen } from './freeNotice';

describe('freeNotice', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('기본값은 안 본 상태다', () => {
    expect(hasSeenFreeNotice(1, 10)).toBe(false);
  });

  it('한 번 기록하면 같은 (사용자, 동아리)에서만 본 것으로 처리된다', () => {
    markFreeNoticeSeen(1, 10);

    expect(hasSeenFreeNotice(1, 10)).toBe(true);
    expect(hasSeenFreeNotice(1, 11)).toBe(false); // 다른 동아리
    expect(hasSeenFreeNotice(2, 10)).toBe(false); // 다른 사용자
  });

  it('teamId가 없으면 기록하지도 읽지도 않는다', () => {
    markFreeNoticeSeen(1, 0);
    expect(hasSeenFreeNotice(1, 0)).toBe(false);
  });
});
