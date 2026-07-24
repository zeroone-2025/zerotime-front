import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { useGroups } from '@/_lib/hooks/useGroups';
import { useTeamMembers } from '@/_lib/hooks/useTeam';

import GroupInlineEditor from './GroupInlineEditor';

vi.mock('@/_lib/hooks/useGroups', () => ({ useGroups: vi.fn() }));
vi.mock('@/_lib/hooks/useTeam', () => ({ useTeamMembers: vi.fn() }));

const mockedUseGroups = vi.mocked(useGroups);
const mockedUseTeamMembers = vi.mocked(useTeamMembers);

const UNASSIGNED = [
  { member_id: 1, user_id: 11, nickname: '김민수' },
  { member_id: 2, user_id: 12, nickname: '박지현' },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asHook = (value: object) => value as any;

beforeEach(() => {
  mockedUseGroups.mockReturnValue(
    asHook({ data: { groups: [], unassigned_members: UNASSIGNED }, isLoading: false }),
  );
  mockedUseTeamMembers.mockReturnValue(
    asHook({
      data: {
        members: [
          { id: 1, user_id: 11, nickname: '김민수', profile_image: null, role: 'captain' },
          { id: 2, user_id: 12, nickname: '박지현', profile_image: null, role: 'member' },
        ],
        total: 2,
      },
    }),
  );
});

function renderCompose(onSave = vi.fn()) {
  render(
    <GroupInlineEditor
      teamId={1}
      groupSetId={7}
      mode="compose"
      onSave={onSave}
      onBack={vi.fn()}
      isSaving={false}
    />,
  );
  return { onSave };
}

describe('GroupInlineEditor — compose 모드', () => {
  it('조가 없으면 1조를 만들어 두고, 빈 조 상태에서는 저장을 막는다', () => {
    renderCompose();

    // 정확히 일치로 찾는다 — 삭제 버튼의 aria-label("1조 삭제")과 겹치지 않게
    expect(screen.getByRole('button', { name: '1조' })).toBeInTheDocument();
    expect(screen.getByText('멤버 필요')).toBeInTheDocument();
    expect(screen.getByText('멤버가 없는 조가 있습니다')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '저장하기' })).toBeDisabled();
  });

  it('멤버를 클릭해 넣고 조장을 지정하면 저장 payload를 만든다', () => {
    const { onSave } = renderCompose();

    // 멤버 추가 시트에서 클릭으로 배정
    fireEvent.click(screen.getByRole('button', { name: /멤버 추가/ }));
    const sheet = screen.getByRole('dialog');
    fireEvent.click(within(sheet).getByText('김민수'));
    fireEvent.click(within(sheet).getByRole('button', { name: '1명 추가' }));

    // 조장이 없으면 아직 저장 불가
    expect(screen.getByText('조장을 지정해주세요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '저장하기' })).toBeDisabled();

    // 멤버 칩 → 조장 지정
    fireEvent.click(screen.getByRole('button', { name: '김민수' }));
    fireEvent.click(screen.getByRole('button', { name: '조장 지정' }));

    const save = screen.getByRole('button', { name: '저장하기' });
    expect(save).toBeEnabled();
    fireEvent.click(save);

    expect(onSave).toHaveBeenCalledWith([
      { name: '1조', display_order: 1, members: [{ member_id: 1, is_leader: true }] },
    ]);
  });

  it('조에 들어간 멤버는 추가 시트 후보에서 빠진다', () => {
    renderCompose();

    fireEvent.click(screen.getByRole('button', { name: /멤버 추가/ }));
    const first = screen.getByRole('dialog');
    fireEvent.click(within(first).getByText('김민수'));
    fireEvent.click(within(first).getByRole('button', { name: '1명 추가' }));

    fireEvent.click(screen.getByRole('button', { name: /멤버 추가/ }));
    const second = screen.getByRole('dialog');
    // 시트 후보에는 박지현만 남는다 (김민수는 이미 조에 들어갔다)
    expect(within(second).queryByText('김민수')).not.toBeInTheDocument();
    expect(within(second).getByText('박지현')).toBeInTheDocument();
  });

  it('중간 조를 삭제하면 뒤 조들의 번호가 앞당겨진다', () => {
    renderCompose();

    // 1조(자동 생성) + 2조 + 3조
    fireEvent.click(screen.getByRole('button', { name: /새 조 추가/ }));
    fireEvent.click(screen.getByRole('button', { name: /새 조 추가/ }));
    expect(screen.getByRole('button', { name: '3조' })).toBeInTheDocument();

    // 2조 삭제 → 3조가 2조로 당겨진다
    fireEvent.click(screen.getByRole('button', { name: '2조 삭제' }));
    fireEvent.click(screen.getByRole('button', { name: '삭제' }));

    expect(screen.getByRole('button', { name: '1조' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2조' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '3조' })).not.toBeInTheDocument();
  });

  it('직접 지은 조 이름은 삭제 후에도 그대로 둔다', () => {
    renderCompose();

    fireEvent.click(screen.getByRole('button', { name: /새 조 추가/ }));
    fireEvent.click(screen.getByRole('button', { name: /새 조 추가/ }));

    // 3조 → "친목조"로 이름 변경
    fireEvent.click(screen.getByRole('button', { name: '3조' }));
    const input = screen.getByDisplayValue('3조');
    fireEvent.change(input, { target: { value: '친목조' } });
    fireEvent.blur(input);

    // 2조 삭제 → 1조는 그대로, 친목조는 이름 유지
    fireEvent.click(screen.getByRole('button', { name: '2조 삭제' }));
    fireEvent.click(screen.getByRole('button', { name: '삭제' }));

    expect(screen.getByRole('button', { name: '1조' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '친목조' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '2조' })).not.toBeInTheDocument();
  });
});
