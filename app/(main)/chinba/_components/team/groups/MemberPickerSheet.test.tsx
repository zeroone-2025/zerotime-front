import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import MemberPickerSheet, { type PickableMember } from './MemberPickerSheet';

const MEMBERS: PickableMember[] = [
  { member_id: 1, nickname: '김민수', role: 'captain' },
  { member_id: 2, nickname: '박지현', role: 'member' },
  { member_id: 3, nickname: '이태호', role: 'executive' },
];

function setup(members: PickableMember[] = MEMBERS) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <MemberPickerSheet
      title="1조에 추가할 멤버"
      members={members}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  );
  return { onConfirm, onCancel };
}

describe('MemberPickerSheet', () => {
  it('선택한 멤버의 member_id만 확인 시 전달한다', () => {
    const { onConfirm } = setup();

    fireEvent.click(screen.getByText('김민수'));
    fireEvent.click(screen.getByText('이태호'));
    fireEvent.click(screen.getByRole('button', { name: '2명 추가' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0].sort()).toEqual([1, 3]);
  });

  it('다시 누르면 선택이 해제된다', () => {
    const { onConfirm } = setup();

    fireEvent.click(screen.getByText('김민수'));
    fireEvent.click(screen.getByText('김민수'));

    const confirm = screen.getByRole('button', { name: '추가' });
    expect(confirm).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('검색어로 닉네임을 걸러내되 이미 선택한 멤버는 유지한다', () => {
    const { onConfirm } = setup();

    fireEvent.click(screen.getByText('김민수'));
    fireEvent.change(screen.getByLabelText('이름 검색'), { target: { value: '태호' } });

    expect(screen.queryByText('김민수')).not.toBeInTheDocument();
    expect(screen.getByText('이태호')).toBeInTheDocument();

    fireEvent.click(screen.getByText('이태호'));
    fireEvent.click(screen.getByRole('button', { name: '2명 추가' }));

    expect(onConfirm.mock.calls[0][0].sort()).toEqual([1, 3]);
  });

  it('검색 결과가 없으면 안내를 보여준다', () => {
    setup();

    fireEvent.change(screen.getByLabelText('이름 검색'), { target: { value: '없는이름' } });

    expect(screen.getByText('검색 결과가 없습니다')).toBeInTheDocument();
  });

  it('후보가 없으면 빈 상태를 보여주고 검색창을 숨긴다', () => {
    setup([]);

    expect(screen.getByText('추가할 멤버가 없습니다')).toBeInTheDocument();
    expect(screen.queryByLabelText('이름 검색')).not.toBeInTheDocument();
  });

  it('취소를 누르면 onCancel이 호출된다', () => {
    const { onCancel, onConfirm } = setup();

    fireEvent.click(screen.getByRole('button', { name: '취소' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('singleSelect면 뒤에 고른 한 명만 남는다', () => {
    const onConfirm = vi.fn();
    render(
      <MemberPickerSheet
        title="회장을 위임할 멤버"
        members={MEMBERS}
        singleSelect
        confirmLabel="선택"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('김민수'));
    fireEvent.click(screen.getByText('박지현'));
    fireEvent.click(screen.getByRole('button', { name: '선택' }));

    expect(onConfirm).toHaveBeenCalledWith([2]);
  });

  it('initialSelected로 준 멤버는 선택된 채로 열린다', () => {
    const onConfirm = vi.fn();
    render(
      <MemberPickerSheet
        title="참여 인원 선택"
        members={MEMBERS}
        initialSelected={[1, 3]}
        confirmLabel="선택 완료"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    // 아무것도 안 누르고 확인해도 초기 선택이 그대로 넘어간다
    fireEvent.click(screen.getByRole('button', { name: '선택 완료' }));
    expect(onConfirm.mock.calls[0][0].sort()).toEqual([1, 3]);
  });

  it('initialSelected로 준 멤버를 다시 누르면 선택이 해제된다', () => {
    const onConfirm = vi.fn();
    render(
      <MemberPickerSheet
        title="참여 인원 선택"
        members={MEMBERS}
        initialSelected={[1, 3]}
        confirmLabel="선택 완료"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('김민수'));
    fireEvent.click(screen.getByRole('button', { name: '선택 완료' }));

    expect(onConfirm).toHaveBeenCalledWith([3]);
  });
});
