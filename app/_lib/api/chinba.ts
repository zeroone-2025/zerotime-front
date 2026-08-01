import api from './client';
import type {
  ChinbaEventDetail,
  ChinbaMyParticipation,
  ChinbaEventListItem,
  ChinbaEventCreateRequest,
  ChinbaEventCreateResponse,
  ChinbaEventTeamJoinResponse,
  ChinbaUnavailabilityUpdateRequest,
} from '@/_types/chinba';

export async function createChinbaEvent(data: ChinbaEventCreateRequest): Promise<ChinbaEventCreateResponse> {
  const res = await api.post('/chinba/events', data);
  return res.data;
}

export async function getChinbaEventDetail(eventId: string): Promise<ChinbaEventDetail> {
  const res = await api.get(`/chinba/events/${eventId}`);
  return res.data;
}

// 동아리 일정 링크만 받은 사람이 그 동아리에 가입하고 일정에 참여한다.
// 초대 코드 없이 event_id로 가입 대상이 정해지며, 이미 멤버여도 200(already_member=true)이다.
export async function joinChinbaEventTeam(eventId: string): Promise<ChinbaEventTeamJoinResponse> {
  const res = await api.post(`/chinba/events/${eventId}/join-team`);
  return res.data;
}

export async function getChinbaMyParticipation(eventId: string): Promise<ChinbaMyParticipation> {
  const res = await api.get(`/chinba/events/${eventId}/my-participation`);
  return res.data;
}

export async function updateChinbaUnavailability(
  eventId: string,
  data: ChinbaUnavailabilityUpdateRequest
): Promise<void> {
  await api.put(`/chinba/events/${eventId}/my-unavailability`, data);
}

export async function importChinbaTimetable(eventId: string): Promise<{ message: string; imported_count: number }> {
  const res = await api.post(`/chinba/events/${eventId}/import-timetable`);
  return res.data;
}

export async function getMyChinbaEvents(): Promise<ChinbaEventListItem[]> {
  const res = await api.get('/chinba/my-events');
  return res.data;
}

export async function deleteChinbaEvent(eventId: string): Promise<void> {
  await api.delete(`/chinba/events/${eventId}`);
}

export async function completeChinbaEvent(eventId: string): Promise<void> {
  await api.patch(`/chinba/events/${eventId}/complete`);
}
