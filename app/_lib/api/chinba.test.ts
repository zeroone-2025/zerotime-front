import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('./client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
  },
}));

import api from './client';
import { getChinbaEventDetail, joinChinbaEventTeam } from './chinba';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getChinbaEventDetail', () => {
  it('비멤버 응답의 동아리 정보를 그대로 넘긴다', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        event_id: 'ev123456',
        title: '정기 모임',
        dates: ['2026-04-01'],
        start_hour: 8,
        end_hour: 24,
        status: 'active',
        creator_id: 10,
        creator_nickname: '팀장',
        category: null,
        participants: [],
        heatmap: [],
        recommended_times: [],
        created_at: '2026-03-15',
        team_id: 7,
        team_name: '컴공 알고리즘 동아리',
        is_team_member: false,
      },
    });

    const result = await getChinbaEventDetail('ev123456');

    expect(api.get).toHaveBeenCalledWith('/chinba/events/ev123456');
    expect(result.team_id).toBe(7);
    expect(result.team_name).toBe('컴공 알고리즘 동아리');
    expect(result.is_team_member).toBe(false);
    expect(result.participants).toEqual([]);
  });
});

describe('joinChinbaEventTeam', () => {
  it('sends POST /chinba/events/:eventId/join-team', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        team_id: 7,
        team_name: '컴공 알고리즘 동아리',
        my_role: 'member',
        already_member: false,
        message: '컴공 알고리즘 동아리에 가입했습니다',
      },
    });

    const result = await joinChinbaEventTeam('ev123456');

    expect(api.post).toHaveBeenCalledWith('/chinba/events/ev123456/join-team');
    expect(result.team_id).toBe(7);
    expect(result.my_role).toBe('member');
    expect(result.already_member).toBe(false);
  });

  it('이미 멤버여도 성공 응답을 그대로 반환한다', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        team_id: 7,
        team_name: '컴공 알고리즘 동아리',
        my_role: 'captain',
        already_member: true,
        message: '이미 가입한 동아리입니다',
      },
    });

    const result = await joinChinbaEventTeam('ev123456');

    expect(result.already_member).toBe(true);
  });
});
