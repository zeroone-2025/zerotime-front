import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('./client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

import api from './client'
import { parseGroups, saveGroups, getGroups, changeGroupLeader } from './groups'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('parseGroups', () => {
  it('sends POST /chinba/teams/:teamId/groups/parse', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { parsed_groups: [], unmatched_names: [], unassigned_members: [] } })
    await parseGroups(1, { text: '1조\n조장: 홍길동' })
    expect(api.post).toHaveBeenCalledWith(
      '/chinba/teams/1/groups/parse',
      { text: '1조\n조장: 홍길동' },
      { timeout: 30000 },
    )
  })
})

describe('saveGroups', () => {
  it('sends PUT /chinba/teams/:teamId/groups', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { groups: [] } })
    await saveGroups(1, { groups: [{ name: '1조', display_order: 1, members: [] }] })
    expect(api.put).toHaveBeenCalledWith('/chinba/teams/1/groups', { groups: [{ name: '1조', display_order: 1, members: [] }] })
  })
})

describe('getGroups', () => {
  it('sends GET /chinba/teams/:teamId/groups', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { groups: [], unassigned_members: [] } })
    const result = await getGroups(1)
    expect(api.get).toHaveBeenCalledWith('/chinba/teams/1/groups', { params: undefined })
    expect(result.groups).toEqual([])
  })
})

describe('changeGroupLeader', () => {
  it('sends PATCH /chinba/teams/:teamId/groups/:groupId/leader', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: {} })
    await changeGroupLeader(1, 2, 5)
    expect(api.patch).toHaveBeenCalledWith('/chinba/teams/1/groups/2/leader', { member_id: 5 })
  })
})
