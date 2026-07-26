'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getActivities,
  getActivityDetail,
  createActivity,
  updateActivity,
  deleteActivity,
  uploadActivityPhoto,
} from '@/_lib/api/activities'
import type { ActivityCreateRequest, ActivityUpdateRequest } from '@/_types/team'

export function useActivities(
  teamId: number | undefined,
  params?: { group_id?: number; month?: string; category_id?: number; skip?: number; limit?: number },
) {
  return useQuery({
    queryKey: ['teams', teamId, 'activities', params],
    queryFn: () => getActivities(teamId!, params),
    enabled: !!teamId,
  })
}

export function useActivityDetail(teamId: number | undefined, activityId: number | undefined) {
  return useQuery({
    queryKey: ['teams', teamId, 'activities', activityId],
    queryFn: () => getActivityDetail(teamId!, activityId!),
    enabled: !!teamId && !!activityId,
  })
}

export function useCreateActivity(teamId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ActivityCreateRequest) => createActivity(teamId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams', teamId, 'activities'] })
    },
  })
}

export function useUpdateActivity(teamId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ activityId, data }: { activityId: number; data: ActivityUpdateRequest }) =>
      updateActivity(teamId, activityId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams', teamId, 'activities'] })
    },
  })
}

export function useDeleteActivity(teamId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (activityId: number) => deleteActivity(teamId, activityId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams', teamId, 'activities'] })
    },
  })
}

/** 사진 업로드는 활동 저장과 별개 요청이라 캐시를 건드리지 않는다 (URL만 받아 폼이 들고 있는다) */
export function useUploadActivityPhoto(teamId: number) {
  return useMutation({
    mutationFn: (file: File) => uploadActivityPhoto(teamId, file),
  })
}
