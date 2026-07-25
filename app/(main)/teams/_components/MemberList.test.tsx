import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { useUserStore } from '@/_lib/store/useUserStore';
import type { TeamMember } from '@/_types/team';
import type { UserProfile } from '@/_types/user';

import MemberList from './MemberList';

vi.mock('@/_lib/hooks/useGroups', () => ({
  useGroupSets: () => ({ data: undefined }),
}));

const makeMember = (overrides: Partial<TeamMember>): TeamMember => ({
  id: 1,
  user_id: 1,
  nickname: '멤버',
  profile_image: null,
  role: 'member',
  group: null,
  joined_at: '2026-01-01T00:00:00',
  ...overrides,
});

const viceCaptainSelf = makeMember({ id: 10, user_id: 100, nickname: '부회장본인', role: 'vice_captain' });
const otherMember = makeMember({ id: 11, user_id: 101, nickname: '일반부원', role: 'member' });

describe('MemberList 본인 행 관리 컨트롤 제외', () => {
  beforeEach(() => {
    useUserStore.setState({ user: { id: 100 } as UserProfile });
  });

  it('부회장이 볼 때 본인 행에는 액션 메뉴가 없고 타인 행에는 있다', () => {
    const { container } = render(
      <MemberList
        members={[viceCaptainSelf, otherMember]}
        myRole="vice_captain"
        onChangeRole={vi.fn()}
        onRemoveMember={vi.fn()}
      />,
    );
    // 액션 메뉴 버튼(FiMoreVertical)은 타인 행 1개에만 렌더된다
    expect(container.querySelectorAll('button').length).toBe(1);
  });

  it('회장이 볼 때는 기존과 동일하게 회장 본인 행에 메뉴가 없다', () => {
    const captainSelf = makeMember({ id: 12, user_id: 100, nickname: '회장본인', role: 'captain' });
    const { container } = render(
      <MemberList
        members={[captainSelf, otherMember]}
        myRole="captain"
        onChangeRole={vi.fn()}
        onRemoveMember={vi.fn()}
      />,
    );
    expect(container.querySelectorAll('button').length).toBe(1);
  });
});
