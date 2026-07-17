'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getEventCategories,
  createEventCategory,
  updateEventCategory,
  deleteEventCategory,
} from '@/_lib/api/categories'
import { hasAccessToken } from '@/_lib/auth/tokenStore'
import type { EventCategoryCreateRequest } from '@/_types/team'

export function useEventCategories(teamId: number | undefined) {
  return useQuery({
    queryKey: ['teams', teamId, 'categories'],
    queryFn: () => getEventCategories(teamId!),
    enabled: !!teamId && hasAccessToken(),
  })
}

export function useCreateEventCategory(teamId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: EventCategoryCreateRequest) => createEventCategory(teamId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams', teamId, 'categories'] })
    },
  })
}

export function useUpdateEventCategory(teamId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ categoryId, data }: { categoryId: number; data: EventCategoryCreateRequest }) =>
      updateEventCategory(teamId, categoryId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams', teamId, 'categories'] })
      // 이벤트·활동 응답에 카테고리 이름이 임베드되므로 배지 이름 갱신
      qc.invalidateQueries({ queryKey: ['teams', teamId, 'events'] })
      qc.invalidateQueries({ queryKey: ['teams', teamId, 'activities'] })
    },
  })
}

export function useDeleteEventCategory(teamId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (categoryId: number) => deleteEventCategory(teamId, categoryId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams', teamId, 'categories'] })
      // 참조 해제(category → null) + 랭킹 재계산 반영
      qc.invalidateQueries({ queryKey: ['teams', teamId, 'events'] })
      qc.invalidateQueries({ queryKey: ['teams', teamId, 'activities'] })
      qc.invalidateQueries({ queryKey: ['teams', teamId, 'rankings'] })
    },
  })
}
