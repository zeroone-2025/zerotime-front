import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  useGroups,
  useGroupSets,
  useParseGroups,
  useSaveGroups,
  useCreateGroupSet,
} from '@/_lib/hooks/useGroups';
import type { Group, GroupSet } from '@/_types/team';

import GroupManageView from './GroupManageView';

let searchParams = new URLSearchParams('id=1');

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => searchParams,
}));
vi.mock('@/_lib/hooks/useSmartBack', () => ({ useSmartBack: () => vi.fn() }));
vi.mock('@/_lib/hooks/useGroups', () => ({
  useGroups: vi.fn(),
  useGroupSets: vi.fn(),
  useParseGroups: vi.fn(),
  useSaveGroups: vi.fn(),
  useCreateGroupSet: vi.fn(),
}));
vi.mock('@/_components/layout/FullPageModal', () => ({
  default: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));
vi.mock('./groups/GroupInlineEditor', () => ({
  default: ({ groupSetId, mode }: { groupSetId?: number; mode?: string }) => (
    <div data-testid="inline-editor" data-set-id={groupSetId ?? ''} data-mode={mode ?? 'edit'} />
  ),
}));
vi.mock('./groups/GroupTextInput', () => ({ default: () => <div data-testid="text-input" /> }));
vi.mock('./groups/GroupParsePreview', () => ({ default: () => <div data-testid="parse-preview" /> }));

const mockedUseGroups = vi.mocked(useGroups);
const mockedUseGroupSets = vi.mocked(useGroupSets);
const mockedUseParseGroups = vi.mocked(useParseGroups);
const mockedUseSaveGroups = vi.mocked(useSaveGroups);
const mockedUseCreateGroupSet = vi.mocked(useCreateGroupSet);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asHook = (value: object) => value as any;

const GROUP: Group = {
  id: 10,
  name: '1조',
  display_order: 1,
  member_count: 1,
  leader: { member_id: 1, nickname: '김민수' },
  members: [],
  group_set_id: 5,
};

const GROUP_SET: GroupSet = {
  id: 5,
  name: '친바',
  display_order: 0,
  group_count: 1,
  groups: [GROUP],
};

const createMutateAsync = vi.fn();

function setState({ groups = [] as Group[], groupSets = [] as GroupSet[] } = {}) {
  mockedUseGroups.mockReturnValue(
    asHook({ data: { groups, unassigned_members: [] }, isLoading: false }),
  );
  mockedUseGroupSets.mockReturnValue(
    asHook({ data: { group_sets: groupSets }, isLoading: false }),
  );
}

beforeEach(() => {
  searchParams = new URLSearchParams('id=1');
  createMutateAsync.mockReset().mockResolvedValue({ ...GROUP_SET, id: 99, name: '스터디' });
  setState();
  mockedUseParseGroups.mockReturnValue(asHook({ mutateAsync: vi.fn(), isPending: false }));
  mockedUseSaveGroups.mockReturnValue(asHook({ mutateAsync: vi.fn(), isPending: false }));
  mockedUseCreateGroupSet.mockReturnValue(
    asHook({ mutateAsync: createMutateAsync, isPending: false }),
  );
});

describe('GroupManageView — 그룹세트 추가 경로', () => {
  it('세트와 조가 있으면 현황 화면에 "새 그룹세트 추가" 버튼이 있고, 누르면 세트 선택으로 간다', async () => {
    setState({ groups: [GROUP], groupSets: [GROUP_SET] });
    render(<GroupManageView />);

    expect(await screen.findByText('현재 조 편성')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '새 그룹세트 추가' }));
    expect(screen.getByText('그룹세트 선택')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('예: 친바, 스터디, 프로젝트')).toBeInTheDocument();
  });

  it('mode=new로 진입하면 조가 있어도 세트 선택 화면으로 바로 간다', async () => {
    searchParams = new URLSearchParams('id=1&mode=new');
    setState({ groups: [GROUP], groupSets: [GROUP_SET] });
    render(<GroupManageView />);

    expect(await screen.findByText('그룹세트 선택')).toBeInTheDocument();
  });

  it('새 세트 이름을 입력하고 다음을 누르면 createGroupSet을 호출하고 편성 방식으로 간다', async () => {
    searchParams = new URLSearchParams('id=1&mode=new');
    setState({ groups: [GROUP], groupSets: [GROUP_SET] });
    render(<GroupManageView />);

    fireEvent.change(await screen.findByPlaceholderText('예: 친바, 스터디, 프로젝트'), {
      target: { value: '스터디' },
    });
    fireEvent.click(screen.getByRole('button', { name: '다음' }));

    expect(await screen.findByText('편성 방식 선택')).toBeInTheDocument();
    expect(createMutateAsync).toHaveBeenCalledWith({ name: '스터디' });
  });

  it('조가 있으면 세트 선택 화면에 돌아가기가 보이고, 누르면 현황으로 복귀한다', async () => {
    searchParams = new URLSearchParams('id=1&mode=new');
    setState({ groups: [GROUP], groupSets: [GROUP_SET] });
    render(<GroupManageView />);

    fireEvent.click(await screen.findByRole('button', { name: '돌아가기' }));
    expect(screen.getByText('현재 조 편성')).toBeInTheDocument();
  });

  it('조가 없는 첫 방문 세트 선택 화면에는 돌아가기가 없다', async () => {
    render(<GroupManageView />);

    expect(await screen.findByText('그룹세트 선택')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '돌아가기' })).not.toBeInTheDocument();
  });

  it('mode=edit인데 setId가 없고 세트가 존재하면 에디터 대신 현황으로 폴백한다', async () => {
    searchParams = new URLSearchParams('id=1&mode=edit');
    setState({ groups: [GROUP], groupSets: [GROUP_SET] });
    render(<GroupManageView />);

    expect(await screen.findByText('현재 조 편성')).toBeInTheDocument();
    expect(screen.queryByTestId('inline-editor')).not.toBeInTheDocument();
  });

  it('mode=edit&setId=5면 에디터에 해당 세트 id를 넘긴다', async () => {
    searchParams = new URLSearchParams('id=1&mode=edit&setId=5');
    setState({ groups: [GROUP], groupSets: [GROUP_SET] });
    render(<GroupManageView />);

    const editor = await screen.findByTestId('inline-editor');
    expect(editor).toHaveAttribute('data-set-id', '5');
  });
});
