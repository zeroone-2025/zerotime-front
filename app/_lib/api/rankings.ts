import type {
  RankingsResponse,
  TrendResponse,
  GroupRankingDetail,
  MyRanking,
  MembersRankingResponse,
} from '@/_types/team'

import api from './client'

export async function getRankings(
  teamId: number,
  params?: { period?: string; group_set_id?: number; category_id?: number },
): Promise<RankingsResponse> {
  const res = await api.get(`/chinba/teams/${teamId}/rankings`, { params })
  return res.data
}

export async function getRankingsTrend(
  teamId: number,
  params?: { period?: string; interval?: string; group_set_id?: number },
): Promise<TrendResponse> {
  const res = await api.get(`/chinba/teams/${teamId}/rankings/trend`, { params })
  return res.data
}

export async function getGroupDetail(
  teamId: number,
  groupId: number,
): Promise<GroupRankingDetail> {
  const res = await api.get(`/chinba/teams/${teamId}/rankings/groups/${groupId}`)
  return res.data
}

export async function getMyRanking(teamId: number, params?: { group_set_id?: number; category_id?: number }): Promise<MyRanking> {
  const res = await api.get(`/chinba/teams/${teamId}/rankings/me`, { params })
  return res.data
}

export async function getMembersRanking(teamId: number): Promise<MembersRankingResponse> {
  const res = await api.get(`/chinba/teams/${teamId}/rankings/members`)
  return res.data
}
