import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import ChinbaScheduleList from './ChinbaScheduleList';
import { getSlotKey } from './chinbaSlotRanges';

const DATES = ['2026-08-02', '2026-08-03']; // 일, 월
const slotsOf = (dateStr: string, ...times: string[]) =>
  new Set(times.map((t) => getSlotKey(dateStr, t)));

function renderList(selectedSlots: Set<string>, onSlotsChange = vi.fn()) {
  render(
    <ChinbaScheduleList
      dates={DATES}
      startHour={8}
      endHour={24}
      selectedSlots={selectedSlots}
      onSlotsChange={onSlotsChange}
    />
  );
  return onSlotsChange;
}

describe('ChinbaScheduleList', () => {
  it('드래그로 칠한 슬롯이 병합된 구간으로 보인다', () => {
    renderList(slotsOf('2026-08-02', '09:00', '09:30', '10:00'));

    expect(screen.getByText('09:00 ~ 10:30')).toBeInTheDocument();
    expect(screen.getByText('8/2 (일)')).toBeInTheDocument();
  });

  it('구간이 없는 날짜는 빈 상태를 보여준다', () => {
    renderList(new Set());

    expect(screen.getAllByText('등록된 시간 없음')).toHaveLength(2);
  });

  it('✕을 누르면 그 구간의 슬롯만 빠진 Set을 올려준다', () => {
    const slots = new Set([
      ...slotsOf('2026-08-02', '09:00', '09:30'),
      ...slotsOf('2026-08-03', '14:00'),
    ]);
    const onSlotsChange = renderList(slots);

    fireEvent.click(screen.getByLabelText('8/2 (일) 09:00~10:00 삭제'));

    const next: Set<string> = onSlotsChange.mock.calls[0][0];
    expect([...next]).toEqual(['2026-08-03T14:00:00']);
  });

  it('추가 모달로 구간을 넣으면 30분 슬롯으로 펼쳐 올려준다', () => {
    const onSlotsChange = renderList(new Set());

    fireEvent.click(screen.getByRole('button', { name: '8/2 (일) 시간 추가' }));

    const start = screen.getByRole('listbox', { name: '시작' });
    const end = screen.getByRole('listbox', { name: '종료' });
    fireEvent.click(within(start).getByRole('option', { name: '09:00' }));
    fireEvent.click(within(end).getByRole('option', { name: '10:30' }));
    fireEvent.click(screen.getByRole('button', { name: '추가' }));

    const next: Set<string> = onSlotsChange.mock.calls.at(-1)![0];
    expect([...next].sort()).toEqual([
      '2026-08-02T09:00:00',
      '2026-08-02T09:30:00',
      '2026-08-02T10:00:00',
    ]);
  });

  it('이벤트 범위 밖 시각은 선택지에 없다', () => {
    render(
      <ChinbaScheduleList
        dates={DATES}
        startHour={10}
        endHour={14}
        selectedSlots={new Set()}
        onSlotsChange={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: '8/2 (일) 시간 추가' }));

    const start = screen.getByRole('listbox', { name: '시작' });
    expect(within(start).queryByRole('option', { name: '09:30' })).not.toBeInTheDocument();
    expect(within(start).getByRole('option', { name: '10:00' })).toBeInTheDocument();

    const end = screen.getByRole('listbox', { name: '종료' });
    expect(within(end).queryByRole('option', { name: '14:30' })).not.toBeInTheDocument();
    expect(within(end).getByRole('option', { name: '14:00' })).toBeInTheDocument();
  });

  it('날짜 헤더를 누르면 접히고 다시 누르면 펼쳐진다', () => {
    renderList(slotsOf('2026-08-02', '09:00'));

    const header = screen.getByRole('button', { name: '8/2 (일) 시간 목록' });
    expect(screen.getByText('09:00 ~ 09:30')).toBeInTheDocument();

    fireEvent.click(header);
    expect(screen.queryByText('09:00 ~ 09:30')).not.toBeInTheDocument();

    fireEvent.click(header);
    expect(screen.getByText('09:00 ~ 09:30')).toBeInTheDocument();
  });
});
