'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getMyTeams,
  getTeamDetail,
  getTeamMembers,
  createTeam,
  updateTeam,
  deleteTeam,
  joinTeam,
  leaveTeam,
  removeMember,
  changeRole,
  transferCaptain,
  regenerateInviteCode,
} from '@/_lib/api/teams';
import { hasAccessToken } from '@/_lib/auth/tokenStore';
import type {
  TeamCreateRequest,
  TeamUpdateRequest,
  TeamListItem,
  JoinTeamRequest,
  CaptainTransferRequest,
} from '@/_types/team';

export function useMyTeams() {
  return useQuery({
    queryKey: ['teams'],
    queryFn: getMyTeams,
    staleTime: 1000 * 60 * 5,
    enabled: hasAccessToken(),
  });
}

export function useTeamDetail(teamId: number | undefined) {
  return useQuery({
    queryKey: ['teams', teamId],
    queryFn: () => getTeamDetail(teamId!),
    enabled: !!teamId && hasAccessToken(),
    staleTime: 1000 * 30,
  });
}

export function useTeamMembers(teamId: number | undefined, role?: string) {
  return useQuery({
    queryKey: ['teams', teamId, 'members', role],
    queryFn: () => getTeamMembers(teamId!, role),
    enabled: !!teamId && hasAccessToken(),
  });
}

export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: TeamCreateRequest) => createTeam(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] });
    },
  });
}

export function useUpdateTeam(teamId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: TeamUpdateRequest) => updateTeam(teamId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] });
      qc.invalidateQueries({ queryKey: ['teams', teamId] });
    },
  });
}

export function useDeleteTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teamId: number) => deleteTeam(teamId),
    onSuccess: (_data, teamId) => {
      // 재조회가 끝나기 전에 목록 화면이 낡은 캐시로 삭제된 팀에 재진입하지 않도록 즉시 제거
      qc.setQueryData<{ teams: TeamListItem[] }>(['teams'], (old) =>
        old ? { ...old, teams: old.teams.filter((t) => t.id !== teamId) } : old,
      );
      qc.removeQueries({ queryKey: ['teams', teamId] });
      qc.invalidateQueries({ queryKey: ['teams'] });
    },
  });
}

export function useJoinTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: JoinTeamRequest) => joinTeam(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] });
    },
  });
}

export function useLeaveTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teamId: number) => leaveTeam(teamId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] });
    },
  });
}

export function useRemoveMember(teamId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memberId: number) => removeMember(teamId, memberId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams', teamId, 'members'] });
      qc.invalidateQueries({ queryKey: ['teams', teamId] });
    },
  });
}

export function useChangeRole(teamId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: number; role: string }) =>
      changeRole(teamId, memberId, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams', teamId, 'members'] });
    },
  });
}

export function useTransferCaptain(teamId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CaptainTransferRequest) => transferCaptain(teamId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] });
      qc.invalidateQueries({ queryKey: ['teams', teamId] });
      qc.invalidateQueries({ queryKey: ['teams', teamId, 'members'] });
    },
  });
}

export function useRegenerateInviteCode(teamId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => regenerateInviteCode(teamId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams', teamId] });
    },
  });
}
