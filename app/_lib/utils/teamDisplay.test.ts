import { describe, it, expect } from 'vitest';
import {
  getRoleBadgeLabel,
  getRoleBadgeColor,
  formatInviteUrl,
  getTeamStatusLabel,
  formatMemberCount,
  getCategoryOptions,
} from './teamDisplay';

describe('getRoleBadgeLabel', () => {
  it('returns 팀장 for captain', () => {
    expect(getRoleBadgeLabel('captain')).toBe('팀장');
  });

  it('returns 임원 for executive', () => {
    expect(getRoleBadgeLabel('executive')).toBe('임원');
  });

  it('returns 팀원 for member', () => {
    expect(getRoleBadgeLabel('member')).toBe('팀원');
  });

  it('returns 팀원 for undefined', () => {
    expect(getRoleBadgeLabel(undefined)).toBe('팀원');
  });

  it('returns 팀원 for unknown role', () => {
    expect(getRoleBadgeLabel('unknown')).toBe('팀원');
  });
});

describe('getRoleBadgeColor', () => {
  it('returns red for captain', () => {
    expect(getRoleBadgeColor('captain')).toBe('red');
  });

  it('returns blue for executive', () => {
    expect(getRoleBadgeColor('executive')).toBe('blue');
  });

  it('returns gray for member', () => {
    expect(getRoleBadgeColor('member')).toBe('gray');
  });

  it('returns gray for undefined', () => {
    expect(getRoleBadgeColor(undefined)).toBe('gray');
  });

  it('returns gray for unknown role', () => {
    expect(getRoleBadgeColor('unknown')).toBe('gray');
  });
});

describe('formatInviteUrl', () => {
  it('formats invite code into full URL', () => {
    expect(formatInviteUrl('abc12345')).toBe(`${window.location.origin}/invite?code=abc12345`);
  });

  it('handles empty string', () => {
    expect(formatInviteUrl('')).toBe(`${window.location.origin}/invite?code=`);
  });
});

describe('getTeamStatusLabel', () => {
  it('returns 프리미엄 when isPaid is true', () => {
    expect(getTeamStatusLabel(true, 5)).toBe('프리미엄');
  });

  it('returns 프리미엄 when isPaid is true regardless of member count', () => {
    expect(getTeamStatusLabel(true, 25)).toBe('프리미엄');
  });

  it('returns 구독 필요 when not paid regardless of member count', () => {
    expect(getTeamStatusLabel(false, 20)).toBe('구독 필요');
    expect(getTeamStatusLabel(false, 50)).toBe('구독 필요');
    expect(getTeamStatusLabel(false, 5)).toBe('구독 필요');
    expect(getTeamStatusLabel(false, 0)).toBe('구독 필요');
  });
});

describe('formatMemberCount', () => {
  it('formats count with 명 suffix', () => {
    expect(formatMemberCount(5)).toBe('5명');
  });

  it('formats zero', () => {
    expect(formatMemberCount(0)).toBe('0명');
  });

  it('formats large numbers', () => {
    expect(formatMemberCount(100)).toBe('100명');
  });
});

describe('getCategoryOptions', () => {
  it('returns 6 category options', () => {
    const options = getCategoryOptions();
    expect(options).toHaveLength(6);
  });

  it('each option has label and value', () => {
    const options = getCategoryOptions();
    options.forEach((option) => {
      expect(option).toHaveProperty('label');
      expect(option).toHaveProperty('value');
      expect(typeof option.label).toBe('string');
      expect(typeof option.value).toBe('string');
    });
  });

  it('includes expected categories', () => {
    const options = getCategoryOptions();
    const values = options.map((o) => o.value);
    expect(values).toContain('동아리');
    expect(values).toContain('학과');
    expect(values).toContain('스터디');
    expect(values).toContain('연구실');
    expect(values).toContain('학회');
    expect(values).toContain('기타');
  });
});
