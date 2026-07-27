import type { TeamRole } from '@/_types/team';

export function getRoleBadgeLabel(role?: string): string {
  switch (role) {
    case 'captain': return '팀장';
    case 'vice_captain': return '부팀장';
    case 'executive': return '임원';
    case 'member': return '팀원';
    default: return '팀원';
  }
}

export function getRoleBadgeColor(role?: string): string {
  switch (role) {
    case 'captain': return 'red';
    case 'vice_captain': return 'orange';
    case 'executive': return 'blue';
    case 'member': return 'gray';
    default: return 'gray';
  }
}

/** club 용어(terminology === 'club')일 때의 역할 라벨 — 컴포넌트별 사본 금지, 여기서만 관리 */
export const CLUB_ROLE_LABELS: Record<TeamRole, string> = {
  captain: '회장',
  vice_captain: '부회장',
  executive: '운영진',
  member: '회원',
};

export function formatInviteUrl(inviteCode: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://chinba.app';
  return `${origin}/invite?code=${inviteCode}`;
}

export function getTeamStatusLabel(isPaid: boolean, _memberCount: number): string {
  if (isPaid) return '프리미엄';
  return '구독 필요';
}

export function formatMemberCount(count: number): string {
  return `${count}명`;
}

export function getCategoryOptions(): { label: string; value: string }[] {
  return [
    { label: '동아리', value: '동아리' },
    { label: '학과', value: '학과' },
    { label: '스터디', value: '스터디' },
    { label: '연구실', value: '연구실' },
    { label: '학회', value: '학회' },
    { label: '기타', value: '기타' },
  ];
}

/**
 * groupId → setName 조회맵 생성
 */
export function buildGroupSetNameMap(groupSets: { id: number; name: string; groups: { id: number }[] }[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const gs of groupSets) {
    for (const g of gs.groups) {
      map.set(g.id, gs.name);
    }
  }
  return map;
}

/**
 * 그룹 표시명에 세트명 접두어를 붙임 (예: "친바 - 1조")
 */
export function groupDisplayName(groupName: string, groupId: number, setNameMap: Map<number, string>): string {
  const setName = setNameMap.get(groupId);
  return setName ? `${setName} - ${groupName}` : groupName;
}
