'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getMyChinbaEvents,
  getChinbaEventDetail,
  getChinbaMyParticipation,
  getChinbaParticipantUnavailability,
  createChinbaEvent,
  updateChinbaUnavailability,
  importChinbaTimetable,
  deleteChinbaEvent,
  completeChinbaEvent,
  joinChinbaEventTeam,
} from '@/_lib/api/chinba';
import type {
  ChinbaEventCreateRequest,
  ChinbaUnavailabilityUpdateRequest,
} from '@/_types/chinba';

export function useMyChinbaEvents(enabled = true) {
  return useQuery({
    queryKey: ['chinba', 'my-events'],
    queryFn: getMyChinbaEvents,
    enabled,
    staleTime: 1000 * 60 * 5,
  });
}

export function useChinbaEventDetail(eventId: string | undefined) {
  return useQuery({
    queryKey: ['chinba', 'event', eventId],
    queryFn: () => getChinbaEventDetail(eventId!),
    enabled: !!eventId,
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 30,
  });
}

export function useMyParticipation(eventId: string | undefined) {
  return useQuery({
    queryKey: ['chinba', 'participation', eventId],
    queryFn: () => getChinbaMyParticipation(eventId!),
    enabled: !!eventId,
    staleTime: 1000 * 30,
  });
}

// 전체 일정에서 참여자 클릭 시 그 사람의 불가능 시간을 조회한다 (userId가 없으면 비활성)
export function useParticipantUnavailability(
  eventId: string | undefined,
  userId: number | null,
) {
  return useQuery({
    queryKey: ['chinba', 'participant-unavailability', eventId, userId],
    queryFn: () => getChinbaParticipantUnavailability(eventId!, userId!),
    enabled: !!eventId && userId !== null,
    staleTime: 1000 * 30,
  });
}

export function useCreateChinbaEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ChinbaEventCreateRequest) => createChinbaEvent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chinba', 'my-events'] });
    },
  });
}

export function useUpdateUnavailability(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ChinbaUnavailabilityUpdateRequest) =>
      updateChinbaUnavailability(eventId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chinba', 'event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['chinba', 'participation', eventId] });
      queryClient.invalidateQueries({ queryKey: ['chinba', 'my-events'] });
    },
  });
}

export function useImportTimetable(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => importChinbaTimetable(eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chinba', 'event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['chinba', 'participation', eventId] });
      queryClient.invalidateQueries({ queryKey: ['chinba', 'my-events'] });
    },
  });
}

// 동아리 일정 링크에서 가입 확인 -> 가입 + 그 일정 참여가 한 번에 끝난다.
// 가입으로 동아리 목록·상세가 바뀌므로 teams 캐시도 함께 비운다.
export function useJoinChinbaEventTeam(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => joinChinbaEventTeam(eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chinba', 'event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['chinba', 'participation', eventId] });
      queryClient.invalidateQueries({ queryKey: ['chinba', 'my-events'] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });
}

// 삭제·완료는 팀 상세의 일정 탭 목록(['teams', teamId, 'events', ...])에도 반영되어야 한다 —
// teams 캐시를 함께 비우지 않으면 목록이 옛 상태(진행중/존재)로 남는다.
export function useDeleteChinbaEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => deleteChinbaEvent(eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chinba', 'my-events'] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });
}

export function useCompleteChinbaEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => completeChinbaEvent(eventId),
    onSuccess: (_data, eventId) => {
      queryClient.invalidateQueries({ queryKey: ['chinba', 'event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['chinba', 'my-events'] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });
}
