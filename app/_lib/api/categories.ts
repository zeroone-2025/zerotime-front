import api from './client'
import type {
  EventCategory,
  EventCategoriesListResponse,
  EventCategoryCreateRequest,
} from '@/_types/team'

export async function getEventCategories(teamId: number): Promise<EventCategoriesListResponse> {
  const res = await api.get(`/chinba/teams/${teamId}/event-categories`)
  return res.data
}

export async function createEventCategory(teamId: number, data: EventCategoryCreateRequest): Promise<EventCategory> {
  const res = await api.post(`/chinba/teams/${teamId}/event-categories`, data)
  return res.data
}

export async function updateEventCategory(teamId: number, categoryId: number, data: EventCategoryCreateRequest): Promise<EventCategory> {
  const res = await api.put(`/chinba/teams/${teamId}/event-categories/${categoryId}`, data)
  return res.data
}

export async function deleteEventCategory(teamId: number, categoryId: number): Promise<void> {
  await api.delete(`/chinba/teams/${teamId}/event-categories/${categoryId}`)
}
