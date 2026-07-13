/**
 * DEV 전용 목업 라우팅 — (메서드, 경로, 바디) → { status, data } | null.
 * null이면 원래 네트워크로 위임한다(미매칭 엔드포인트는 그대로 실 백엔드 호출).
 *
 * 페르소나별 `my_role`을 담은 응답이 친바 클럽 UI의 권한 게이트를 구동한다.
 */

import { getActivePersonaId, makeMockToken, clearActivePersonaId } from './mockConfig';
import { MOCK_PERSONAS, type MockPersona } from './personas';

export interface MockResult {
  status: number;
  data: unknown;
}

function ok(data: unknown): MockResult {
  return { status: 200, data };
}

function stripQuery(url: string): string {
  const q = url.indexOf('?');
  return q === -1 ? url : url.slice(0, q);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

export function resolveMock(method: string, url: string, body?: unknown): MockResult | null {
  const m = (method || 'get').toLowerCase();
  const path = stripQuery(url || '');
  const personaId = getActivePersonaId();
  const persona = personaId ? MOCK_PERSONAS[personaId] : undefined;

  // --- 인증 (authApi, 인터셉터 없음) ---
  if (m === 'post' && path.endsWith('/auth/refresh')) {
    if (persona && personaId) return ok({ access_token: makeMockToken(personaId) });
    return { status: 401, data: { detail: 'no mock session' } };
  }
  if (m === 'post' && path.endsWith('/auth/logout')) {
    clearActivePersonaId();
    return ok({ message: 'ok' });
  }

  // 이하는 로그인된 페르소나가 있을 때만 처리.
  if (!persona) return null;

  // --- 사용자 ---
  if (m === 'get' && path.endsWith('/users/me/init')) {
    return ok({ user: persona.profile, subscriptions: [] });
  }
  if (m === 'get' && path.endsWith('/users/me/subscriptions')) return ok([]);
  if (m === 'get' && path.endsWith('/users/me/keywords')) return ok([]);
  if (m === 'get' && path.endsWith('/users/me/keyword-notices')) return ok([]);
  if (m === 'patch' && path.endsWith('/users/me')) {
    return ok({ ...persona.profile, ...(isObject(body) ? body : {}) });
  }
  if (m === 'get' && path.endsWith('/users/me')) return ok(persona.profile);

  // --- 전역 프로바이더(사이드바·알림 배지)가 로그인 시 부르는 호출 — 백엔드 없이 빈 응답 ---
  // (getMyKeywords·getMyChinbaEvents·getAllDepartments 등이 목업 밖으로 새어 실 백엔드에
  //  요청 → dev 에러를 유발하던 것을 여기서 막는다. 모두 배열 응답이라 [] 로 충분.)
  if (m === 'get' && path.endsWith('/chinba/my-events')) return ok([]);
  if (m === 'get' && path.endsWith('/departments')) return ok([]);

  // --- 팀(친바 클럽) ---
  const teamsIdx = path.indexOf('/chinba/teams');
  if (teamsIdx !== -1) {
    const rest = path.slice(teamsIdx + '/chinba/teams'.length); // '' | '/1' | '/1/members' ...
    const teamResult = resolveTeams(m, rest, persona, body);
    if (teamResult) return teamResult; // 미매칭 팀 하위경로는 아래 일반 폴백으로
  }

  // --- 일반 폴백 ---
  // 페르소나가 활성인 동안에는 목업 안 된 요청도 실 백엔드로 절대 새지 않게 한다.
  // (미매칭 요청이 백엔드로 가면 목업 토큰이 거부되어 401 "Could not validate credentials"가
  //  뜬다.) 앱의 인증 GET은 대부분 목록이라 [], 쓰기는 성공 응답으로 처리한다. 어떤
  //  엔드포인트가 폴백을 탔는지는 콘솔 경고로 남겨, 필요하면 위에 정식 목업을 추가한다.
  if (typeof console !== 'undefined') {
    console.warn('[MockAuth] 목업되지 않은 엔드포인트 → 빈 응답 처리:', m, path);
  }
  if (m === 'get') return ok([]);
  return ok({ message: 'ok' });
}

function resolveTeams(
  method: string,
  rest: string,
  persona: MockPersona,
  body?: unknown,
): MockResult | null {
  const seg = rest.split('/').filter(Boolean); // ['1','members', ...] | [] | ['join']

  // /chinba/teams
  if (seg.length === 0) {
    if (method === 'get') return ok({ teams: persona.teams });
    if (method === 'post') return ok(persona.teamDetail); // 클럽 생성
    return null;
  }

  // /chinba/teams/join
  if (seg[0] === 'join') {
    if (method === 'post') {
      return ok({
        team_id: persona.teamDetail.id,
        team_name: persona.teamDetail.name,
        my_role: 'member',
        message: 'joined',
      });
    }
    return null;
  }

  // seg[0] = teamId
  const sub = seg.slice(1);

  // /chinba/teams/{id}
  if (sub.length === 0) {
    if (method === 'get') return ok(persona.teamDetail);
    if (method === 'patch') return ok({ ...persona.teamDetail, ...(isObject(body) ? body : {}) });
    if (method === 'delete') return ok({ message: 'ok' });
    return null;
  }

  switch (sub[0]) {
    case 'members':
      // /members
      if (sub.length === 1 && method === 'get') return ok(persona.members);
      // /members/me (탈퇴)
      if (sub.length === 2 && sub[1] === 'me' && method === 'delete') return ok({ message: 'ok' });
      // /members/{mid}/role (역할 변경)
      if (sub.length === 3 && sub[2] === 'role' && method === 'patch') {
        const mid = Number(sub[1]);
        const target = persona.members.members.find((x) => x.id === mid);
        const role = isObject(body) && typeof body.role === 'string' ? body.role : 'member';
        return ok(target ? { ...target, role } : { id: mid, role });
      }
      // /members/{mid} (내보내기)
      if (sub.length === 2 && method === 'delete') return ok({ message: 'ok' });
      return null;

    case 'captain-transfer':
      if (method === 'post') return ok({ message: 'ok' });
      return null;

    case 'invitations':
      // /invitations
      if (sub.length === 1 && method === 'get') return ok(persona.invitation);
      // /invitations/regenerate
      if (sub.length === 2 && sub[1] === 'regenerate' && method === 'post') {
        return ok({ ...persona.invitation, invite_code: 'MOCK-NEW' });
      }
      return null;

    case 'subscription':
      if (method === 'get') return ok(persona.subscription);
      return null;

    case 'group-sets':
      if (method === 'get') return ok({ group_sets: [] });
      return null;

    case 'groups':
      if (method === 'get') return ok({ groups: [], unassigned_members: [] });
      return null;

    case 'events':
      if (method === 'get') return ok(persona.events);
      if (method === 'post') return ok({ event_id: 'mock-evt-new' });
      return null;

    case 'timetables':
      if (method === 'get') return ok([]);
      return null;

    case 'rankings':
      if (method === 'get') return ok({ period: 'all', rankings: [] });
      return null;

    case 'activities':
      if (method === 'get') return ok({ activities: [], total: 0 });
      return null;

    default:
      return null;
  }
}
