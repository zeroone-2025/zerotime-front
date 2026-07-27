import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { useTransferCaptain } from '@/_lib/hooks/useTeam';
import type { TeamMember } from '@/_types/team';

import CaptainTransferSection from './CaptainTransferSection';

vi.mock('@/_lib/hooks/useTeam', () => ({ useTransferCaptain: vi.fn() }));

const showToast = vi.fn();
vi.mock('@/_context/ToastContext', () => ({ useToast: () => ({ showToast }) }));

const mutateAsync = vi.fn();
const mockedUseTransferCaptain = vi.mocked(useTransferCaptain);

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

const MEMBERS: TeamMember[] = [
  makeMember({ id: 10, user_id: 100, nickname: '나회장', role: 'captain' }),
  makeMember({ id: 11, user_id: 101, nickname: '김부회장', role: 'vice_captain' }),
  makeMember({ id: 12, user_id: 102, nickname: '박부원', role: 'member' }),
];

const renderSection = (myRole: TeamMember['role'] = 'captain', members = MEMBERS) =>
  render(<CaptainTransferSection teamId={1} members={members} myRole={myRole} />);

describe('CaptainTransferSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutateAsync.mockResolvedValue({});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedUseTransferCaptain.mockReturnValue({ mutateAsync } as any);
  });

  it('회장에게만 노출된다', () => {
    const { unmount } = renderSection('captain');
    expect(screen.getByText('회장 위임하기')).toBeInTheDocument();
    unmount();

    renderSection('vice_captain');
    expect(screen.queryByText('회장 위임하기')).not.toBeInTheDocument();
  });

  it('대상 목록에서 회장 본인은 제외된다', () => {
    renderSection();
    fireEvent.click(screen.getByText('회장 위임하기'));

    expect(screen.getByText('김부회장')).toBeInTheDocument();
    expect(screen.getByText('박부원')).toBeInTheDocument();
    expect(screen.queryByText('나회장')).not.toBeInTheDocument();
  });

  it('대상을 고르면 운영진으로 강등된다는 경고와 함께 확인을 받는다', () => {
    renderSection();
    fireEvent.click(screen.getByText('회장 위임하기'));
    fireEvent.click(screen.getByText('김부회장'));
    fireEvent.click(screen.getByText('선택'));

    expect(screen.getByText(/운영진이 되며/)).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('확인하면 선택한 멤버의 member_id로 위임을 요청한다', async () => {
    renderSection();
    fireEvent.click(screen.getByText('회장 위임하기'));
    fireEvent.click(screen.getByText('박부원'));
    fireEvent.click(screen.getByText('선택'));
    fireEvent.click(screen.getByText('위임'));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({ new_captain_member_id: 12 }),
    );
  });

  it('위임할 멤버가 없으면 버튼이 비활성화된다', () => {
    renderSection('captain', [MEMBERS[0]]);
    expect(screen.getByText('위임할 멤버가 없습니다')).toBeDisabled();
  });
});
