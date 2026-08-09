import { describe, it, expect } from 'vitest';

import {
  addRange,
  buildEndOptions,
  buildStartOptions,
  getSlotKey,
  rangeToSlotKeys,
  removeRange,
  slotsToRangesByDate,
} from './chinbaSlotRanges';

const D = '2026-08-02';
const OTHER = '2026-08-03';

// 구간 목록을 "09:00~11:00" 문자열 배열로 — 기대값을 눈으로 읽기 쉽게
const fmt = (map: Map<string, { start: string; end: string }[]>, dateStr: string) =>
  (map.get(dateStr) ?? []).map((r) => `${r.start}~${r.end}`);

const setOf = (dateStr: string, ...times: string[]) =>
  new Set(times.map((t) => getSlotKey(dateStr, t)));

describe('rangeToSlotKeys', () => {
  it('end는 exclusive — 09:00~10:00은 슬롯 두 개', () => {
    expect(rangeToSlotKeys(D, { start: '09:00', end: '10:00' })).toEqual([
      `${D}T09:00:00`,
      `${D}T09:30:00`,
    ]);
  });

  it('start === end면 슬롯 없음', () => {
    expect(rangeToSlotKeys(D, { start: '09:00', end: '09:00' })).toEqual([]);
  });

  it('자정 넘김 없이 24:00까지 만든다', () => {
    expect(rangeToSlotKeys(D, { start: '23:00', end: '24:00' })).toEqual([
      `${D}T23:00:00`,
      `${D}T23:30:00`,
    ]);
  });
});

describe('slotsToRangesByDate', () => {
  it('연속 슬롯은 한 구간으로 병합된다', () => {
    const slots = setOf(D, '09:00', '09:30', '10:00', '10:30');
    expect(fmt(slotsToRangesByDate(slots, [D]), D)).toEqual(['09:00~11:00']);
  });

  it('끊긴 슬롯은 별개 구간으로 나뉜다', () => {
    const slots = setOf(D, '09:00', '09:30', '14:00');
    expect(fmt(slotsToRangesByDate(slots, [D]), D)).toEqual(['09:00~10:00', '14:00~14:30']);
  });

  it('입력 순서와 무관하게 시각순으로 정렬된다', () => {
    const slots = setOf(D, '14:00', '09:30', '09:00');
    expect(fmt(slotsToRangesByDate(slots, [D]), D)).toEqual(['09:00~10:00', '14:00~14:30']);
  });

  it('날짜별로 분리된다', () => {
    const slots = new Set([...setOf(D, '09:00'), ...setOf(OTHER, '13:00', '13:30')]);
    const map = slotsToRangesByDate(slots, [D, OTHER]);
    expect(fmt(map, D)).toEqual(['09:00~09:30']);
    expect(fmt(map, OTHER)).toEqual(['13:00~14:00']);
  });

  it('dates 밖 날짜의 슬롯은 목록에서 빠지되 원본 Set은 그대로다', () => {
    const slots = new Set([...setOf(D, '09:00'), ...setOf('2026-01-01', '09:00')]);
    const map = slotsToRangesByDate(slots, [D]);
    expect([...map.keys()]).toEqual([D]);
    expect(slots.has('2026-01-01T09:00:00')).toBe(true); // 저장 시 보존돼야 한다
  });

  it('슬롯이 없으면 빈 맵', () => {
    expect(slotsToRangesByDate(new Set(), [D]).size).toBe(0);
  });
});

describe('addRange / removeRange', () => {
  it('겹치는 구간을 추가하면 한 구간으로 병합돼 보인다', () => {
    let slots = new Set<string>();
    slots = addRange(slots, D, { start: '09:00', end: '12:00' });
    slots = addRange(slots, D, { start: '11:00', end: '13:00' });
    expect(fmt(slotsToRangesByDate(slots, [D]), D)).toEqual(['09:00~13:00']);
  });

  it('붙어 있는(끝=시작) 구간도 한 구간이 된다', () => {
    let slots = new Set<string>();
    slots = addRange(slots, D, { start: '09:00', end: '10:00' });
    slots = addRange(slots, D, { start: '10:00', end: '11:00' });
    expect(fmt(slotsToRangesByDate(slots, [D]), D)).toEqual(['09:00~11:00']);
  });

  it('떨어진 구간을 추가하면 두 구간으로 남는다', () => {
    let slots = new Set<string>();
    slots = addRange(slots, D, { start: '09:00', end: '10:00' });
    slots = addRange(slots, D, { start: '14:00', end: '15:00' });
    expect(fmt(slotsToRangesByDate(slots, [D]), D)).toEqual(['09:00~10:00', '14:00~15:00']);
  });

  it('구간 중간을 지우면 두 구간으로 쪼개진다', () => {
    let slots = addRange(new Set<string>(), D, { start: '09:00', end: '13:00' });
    slots = removeRange(slots, D, { start: '11:00', end: '11:30' });
    expect(fmt(slotsToRangesByDate(slots, [D]), D)).toEqual(['09:00~11:00', '11:30~13:00']);
  });

  it('삭제는 같은 날짜에만 적용된다', () => {
    let slots = addRange(new Set<string>(), D, { start: '09:00', end: '10:00' });
    slots = addRange(slots, OTHER, { start: '09:00', end: '10:00' });
    slots = removeRange(slots, D, { start: '09:00', end: '10:00' });
    const map = slotsToRangesByDate(slots, [D, OTHER]);
    expect(fmt(map, D)).toEqual([]);
    expect(fmt(map, OTHER)).toEqual(['09:00~10:00']);
  });

  it('원본 Set을 변형하지 않는다', () => {
    const original = new Set<string>();
    const added = addRange(original, D, { start: '09:00', end: '10:00' });
    expect(original.size).toBe(0);
    expect(added.size).toBe(2);
  });
});

describe('buildStartOptions / buildEndOptions', () => {
  it('시작 선택지는 endHour 정각을 포함하지 않는다', () => {
    const options = buildStartOptions(8, 24);
    expect(options[0]).toBe('08:00');
    expect(options[options.length - 1]).toBe('23:30');
    expect(options).not.toContain('24:00');
  });

  it('종료 선택지는 endHour 정각까지 포함한다', () => {
    const options = buildEndOptions(8, 24);
    expect(options[0]).toBe('08:30');
    expect(options[options.length - 1]).toBe('24:00');
  });

  it('이벤트 범위 밖 시각은 선택지에 없다', () => {
    expect(buildStartOptions(10, 14)).not.toContain('09:30');
    expect(buildEndOptions(10, 14)).not.toContain('14:30');
  });

  it('after를 주면 그보다 늦은 종료 시각만 남는다', () => {
    const options = buildEndOptions(8, 24, '13:00');
    expect(options[0]).toBe('13:30');
    expect(options).not.toContain('13:00');
  });
});
