import api from './client'
import type {
  Activity,
  ActivityCreateRequest,
  ActivityUpdateRequest,
  ActivityListResponse,
} from '@/_types/team'

export async function createActivity(teamId: number, data: ActivityCreateRequest): Promise<Activity> {
  const res = await api.post(`/chinba/teams/${teamId}/activities`, data)
  return res.data
}

export async function getActivities(
  teamId: number,
  params?: { group_id?: number; month?: string; category_id?: number; skip?: number; limit?: number },
): Promise<ActivityListResponse> {
  const res = await api.get(`/chinba/teams/${teamId}/activities`, { params })
  return res.data
}

export async function getActivityDetail(teamId: number, activityId: number): Promise<Activity> {
  const res = await api.get(`/chinba/teams/${teamId}/activities/${activityId}`)
  return res.data
}

export async function updateActivity(
  teamId: number,
  activityId: number,
  data: ActivityUpdateRequest,
): Promise<Activity> {
  const res = await api.patch(`/chinba/teams/${teamId}/activities/${activityId}`, data)
  return res.data
}

export async function deleteActivity(teamId: number, activityId: number): Promise<void> {
  await api.delete(`/chinba/teams/${teamId}/activities/${activityId}`)
}
