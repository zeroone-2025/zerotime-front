import type { TeamRole } from '@/_types/team';

export function canEditTeam(role: TeamRole): boolean {
  return role === 'captain' || role === 'vice_captain' || role === 'executive';
}

export function canDeleteTeam(role: TeamRole): boolean {
  return role === 'captain' || role === 'vice_captain';
}

export function canRemoveMember(currentRole: TeamRole, targetRole: TeamRole): boolean {
  if (currentRole === 'captain' || currentRole === 'vice_captain') return targetRole !== 'captain';
  if (currentRole === 'executive') return targetRole === 'member';
  return false;
}

export function canChangeRole(role: TeamRole): boolean {
  return role === 'captain' || role === 'vice_captain';
}

export function canChangeRoleOf(myRole: TeamRole, targetRole: TeamRole): boolean {
  return canChangeRole(myRole) && targetRole !== 'captain';
}

export function canViewInvitation(role: TeamRole): boolean {
  return role === 'captain' || role === 'vice_captain' || role === 'executive';
}

export function canRegenerateInvitation(role: TeamRole): boolean {
  return role === 'captain' || role === 'vice_captain';
}

export function canTransferCaptain(role: TeamRole): boolean {
  return role === 'captain';
}

// 구독 생성·해지는 서버가 회장·부회장만 허용한다 (LEADER_ROLES)
export function canManageSubscription(role: TeamRole): boolean {
  return role === 'captain' || role === 'vice_captain';
}
