import { describe, it, expect, beforeEach } from 'vitest';

import { resolveMock } from './mockRouter';

// 목업 라우터 회귀 가드 — 페르소나 활성 시 어떤 요청도 실 백엔드로 새지 않아야 한다.
describe('resolveMock', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('mock_persona', 'captain');
  });

  it('명시 목업된 팀 상세는 페르소나 my_role을 담아 반환', () => {
    const r = resolveMock('get', '/chinba/teams/1');
    expect(r?.status).toBe(200);
    expect((r?.data as { my_role: string }).my_role).toBe('captain');
  });

  it('전역 프로바이더 호출(키워드·내일정·학과)은 빈 배열', () => {
    expect(resolveMock('get', '/users/me/keywords')?.data).toEqual([]);
    expect(resolveMock('get', '/users/me/keyword-notices')?.data).toEqual([]);
    expect(resolveMock('get', '/chinba/my-events')?.data).toEqual([]);
    expect(resolveMock('get', '/departments')?.data).toEqual([]);
  });

  it('목업 안 된 쓰기(일정 생성 등)도 폴백으로 성공 처리 — 401 누수 없음', () => {
    const r = resolveMock('post', '/chinba/events', { title: 'x' });
    expect(r).not.toBeNull();
    expect(r?.status).toBe(200);
  });

  it('통계 배너는 객체 shape로 목업(폴백에 안 걸림)', () => {
    expect((resolveMock('get', '/stats/teams')?.data as { total_teams: number }).total_teams).toBe(128);
    expect((resolveMock('get', '/stats/users')?.data as { total_users: number }).total_users).toBe(2048);
  });

  it('목업 안 된 GET 폴백은 null(빈 배열 아님) — 가드 패턴 크래시 방지', () => {
    const r = resolveMock('get', '/unknown/endpoint');
    expect(r?.status).toBe(200);
    expect(r?.data).toBeNull();
  });

  it('미매칭 팀 하위경로도 폴백으로 흡수', () => {
    const r = resolveMock('get', '/chinba/teams/1/unknown-subpath');
    expect(r).not.toBeNull();
    expect(r?.status).toBe(200);
  });

  it('비로그인(페르소나 없음): 인증 외 요청은 null(실 네트워크 위임)', () => {
    localStorage.removeItem('mock_persona');
    expect(resolveMock('get', '/chinba/teams/1')).toBeNull();
  });

  it('비로그인: refresh는 401(게스트 강등)', () => {
    localStorage.removeItem('mock_persona');
    expect(resolveMock('post', '/auth/refresh')?.status).toBe(401);
  });
});
