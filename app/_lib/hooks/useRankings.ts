'use client'

import { useQuery } from '@tanstack/react-query'

import {
  getRankings,
  getRankingsTrend,
  getGroupDetail,
  getMyRanking,
  getMembersRanking,
} from '@/_lib/api/rankings'

export function useRankings(
  teamId: number | undefined,
  params?: { period?: string; group_set_id?: number; category_id?: number },
) {
  return useQuery({
    queryKey: ['teams', teamId, 'rankings', params],
    queryFn: () => getRankings(teamId!, params),
    enabled: !!teamId,
  })
}

export function useRankingsTrend(
  teamId: number | undefined,
  params?: { period?: string; interval?: string; group_set_id?: number },
) {
  return useQuery({
    queryKey: ['teams', teamId, 'rankings', 'trend', params],
    queryFn: () => getRankingsTrend(teamId!, params),
    enabled: !!teamId,
  })
}

export function useGroupDetail(
  teamId: number | undefined,
  groupId: number | undefined,
) {
  return useQuery({
    queryKey: ['teams', teamId, 'rankings', 'groups', groupId],
    queryFn: () => getGroupDetail(teamId!, groupId!),
    enabled: !!teamId && !!groupId,
  })
}

export function useMyRanking(teamId: number | undefined, params?: { group_set_id?: number; category_id?: number }) {
  return useQuery({
    queryKey: ['teams', teamId, 'rankings', 'me', params],
    queryFn: () => getMyRanking(teamId!, params),
    enabled: !!teamId,
  })
}

export function useMembersRanking(teamId: number | undefined) {
  return useQuery({
    queryKey: ['teams', teamId, 'rankings', 'members'],
    queryFn: () => getMembersRanking(teamId!),
    enabled: !!teamId,
  })
}
