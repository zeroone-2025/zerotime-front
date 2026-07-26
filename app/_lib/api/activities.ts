import api from './client'
import type {
  Activity,
  ActivityCreateRequest,
  ActivityUpdateRequest,
  ActivityListResponse,
  ActivityPhotoUploadResponse,
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

/** 활동 사진 1장을 올리고 URL을 받는다. 받은 URL을 생성·수정의 photo_urls에 실어 보낸다. */
export async function uploadActivityPhoto(teamId: number, file: File): Promise<ActivityPhotoUploadResponse> {
  const formData = new FormData()
  formData.append('file', file)

  const res = await api.post<ActivityPhotoUploadResponse>(
    `/chinba/teams/${teamId}/activities/photos`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30_000, // 기본 5초로는 업로드가 끊긴다
    },
  )
  return res.data
}
