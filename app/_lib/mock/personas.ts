/**
 * DEV 전용 목업 페르소나 픽스처.
 *
 * 세 페르소나(회장/운영진/회원)가 **동일 클럽 id=1을 공유**하고 `teamDetail.my_role`만
 * 다르다 — 권한만 변수로 격리해 권한별 UI 분기를 확인하기 위함.
 * 타입은 `@/_types/{user,team}`에서 가져와 실제 API 계약과 동기화한다.
 *
 * 이 모듈은 dead-branch 동적 import로만 진입하므로 프로덕션 청크에 실리지 않는다.
 */

import type {
  TeamRole,
  TeamListItem,
  TeamDetail,
  TeamMember,
  TeamMemberListResponse,
  InvitationInfo,
  SubscriptionDetail,
  TeamEventListResponse,
} from '@/_types/team';
import type { UserProfile } from '@/_types/user';

export interface MockPersona {
  id: string;
  label: string; // 폼 표시용
  credential: { id: string; password: string };
  profile: UserProfile;
  teams: TeamListItem[];
  teamDetail: TeamDetail;
  members: TeamMemberListResponse;
  invitation: InvitationInfo;
  subscription: SubscriptionDetail;
  events: TeamEventListResponse;
}

const CLUB_ID = 1;
const CLUB_NAME = '제로타임 개발동아리';
const CREATED_AT = '2026-03-02T09:00:00Z';

// 클럽 구성원 4명 — 모든 페르소나가 공유하는 동일 명단.
// (회장 1 · 운영진 1 · 회원 2 → 역할변경/내보내기 대상이 존재)
const ROSTER: { memberId: number; userId: number; nickname: string; role: TeamRole }[] = [
  { memberId: 101, userId: 1, nickname: '회장 김철수', role: 'captain' },
  { memberId: 102, userId: 2, nickname: '운영진 이영희', role: 'executive' },
  { memberId: 103, userId: 3, nickname: '회원 박민수', role: 'member' },
  { memberId: 104, userId: 4, nickname: '회원 최지우', role: 'member' },
];

function buildMembers(): TeamMemberListResponse {
  const members: TeamMember[] = ROSTER.map((r) => ({
    id: r.memberId,
    user_id: r.userId,
    nickname: r.nickname,
    profile_image: null,
    role: r.role,
    group: null,
    joined_at: CREATED_AT,
  }));
  return { members, total: members.length };
}

function buildProfile(userId: number, nickname: string): UserProfile {
  return {
    id: userId,
    email: `mock-${userId}@jbnu.ac.kr`,
    username: nickname,
    nickname,
    dept_code: 'CSE', // non-null → 온보딩 리다이렉트 회피
    school: '전북대학교',
    admission_year: 2022,
    profile_image: null,
    role: 'user',
    user_type: 'student',
    created_at: CREATED_AT,
    keyword_notice_seen_at: CREATED_AT,
  };
}

function buildTeamDetail(myRole: TeamRole): TeamDetail {
  return {
    id: CLUB_ID,
    name: CLUB_NAME,
    description: '목업 데이터 — 권한별 플로우 테스트용 동아리',
    category: '개발',
    member_count: ROSTER.length,
    my_role: myRole,
    my_group: null,
    invite_code: 'MOCKCODE',
    status: 'active',
    is_paid: false,
    trial_used: false,
    subscription: null,
    created_at: CREATED_AT,
  };
}

function buildTeamListItem(myRole: TeamRole): TeamListItem {
  return {
    id: CLUB_ID,
    name: CLUB_NAME,
    category: '개발',
    member_count: ROSTER.length,
    my_role: myRole,
    status: 'active',
    is_paid: false,
    created_at: CREATED_AT,
  };
}

const INVITATION: InvitationInfo = {
  invite_code: 'MOCKCODE',
  invite_url: 'https://zerotime.kr/invite/MOCKCODE',
  is_active: true,
  created_at: CREATED_AT,
  expires_at: null,
};

function buildSubscription(): SubscriptionDetail {
  return {
    team_id: CLUB_ID,
    member_count: ROSTER.length,
    tier: null,
    tier_label: null,
    billing_cycle: null,
    amount: null,
    status: null,
    started_at: null,
    expires_at: null,
    trial_used: false,
    available_tiers: [],
  };
}

const EMPTY_EVENTS: TeamEventListResponse = { events: [], total: 0 };

function buildPersona(
  id: string,
  label: string,
  credential: { id: string; password: string },
  roster: (typeof ROSTER)[number],
): MockPersona {
  return {
    id,
    label,
    credential,
    profile: buildProfile(roster.userId, roster.nickname),
    teams: [buildTeamListItem(roster.role)],
    teamDetail: buildTeamDetail(roster.role),
    members: buildMembers(),
    invitation: INVITATION,
    subscription: buildSubscription(),
    events: EMPTY_EVENTS,
  };
}

export const MOCK_PERSONAS: Record<string, MockPersona> = {
  captain: buildPersona('captain', '회장', { id: 'captain', password: 'captain' }, ROSTER[0]),
  executive: buildPersona('executive', '운영진', { id: 'exec', password: 'exec' }, ROSTER[1]),
  member: buildPersona('member', '회원', { id: 'member', password: 'member' }, ROSTER[2]),
};

/** "아이디:비밀번호" → personaId */
export const MOCK_CREDENTIALS: Record<string, string> = Object.fromEntries(
  Object.values(MOCK_PERSONAS).map((p) => [`${p.credential.id}:${p.credential.password}`, p.id]),
);

/** 폼의 빠른 채움 버튼용 목록 */
export const MOCK_PERSONA_LIST = Object.values(MOCK_PERSONAS).map((p) => ({
  id: p.id,
  label: p.label,
  credential: p.credential,
}));
