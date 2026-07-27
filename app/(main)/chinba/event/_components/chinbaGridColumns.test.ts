import { describe, it, expect } from 'vitest';

import { buildChinbaGridLayout, type ChinbaGridColumn } from './chinbaGridColumns';

const days = (columns: ChinbaGridColumn[]) =>
  columns.filter((c): c is Extract<ChinbaGridColumn, { type: 'day' }> => c.type === 'day');

const shape = (columns: ChinbaGridColumn[]) =>
  columns.map((c) => (c.type === 'gap' ? '|' : `${c.dateStr.slice(5)}${c.selectable ? '*' : ''}`));

describe('buildChinbaGridLayout', () => {
  it('빈 입력이면 빈 레이아웃', () => {
    expect(buildChinbaGridLayout([])).toEqual({ columns: [], isScroll: false });
  });

  it('하루만 선택해도 7일 프레임으로 패딩된다', () => {
    const { columns, isScroll } = buildChinbaGridLayout(['2026-07-01']);
    expect(isScroll).toBe(false);
    expect(days(columns)).toHaveLength(7);
    expect(shape(columns)).toEqual(['06-28', '06-29', '06-30', '07-01*', '07-02', '07-03', '07-04']);
  });

  it('범위 7일 이내: 범위를 통째로 깔고 남는 칸은 앞뒤 패딩 (7/1·7/4·7/5)', () => {
    const { columns, isScroll } = buildChinbaGridLayout(['2026-07-01', '2026-07-04', '2026-07-05']);
    expect(isScroll).toBe(false);
    expect(shape(columns)).toEqual(['06-30', '07-01*', '07-02', '07-03', '07-04*', '07-05*', '07-06']);
  });

  it('주 경계를 걸쳐도 날짜 범위 기준으로 7일을 만든다 (토~화 → 금...목)', () => {
    // 2026-07-25(토) ~ 2026-07-28(화)
    const { columns } = buildChinbaGridLayout(['2026-07-25', '2026-07-26', '2026-07-27', '2026-07-28']);
    expect(shape(columns)).toEqual(['07-24', '07-25*', '07-26*', '07-27*', '07-28*', '07-29', '07-30']);
  });

  it('멀리 떨어진 두 날짜는 클러스터 + 구분선으로 7일을 채운다 (7/1·7/10)', () => {
    const { columns, isScroll } = buildChinbaGridLayout(['2026-07-01', '2026-07-10']);
    expect(isScroll).toBe(false);
    expect(days(columns)).toHaveLength(7);
    expect(shape(columns)).toEqual([
      '06-29', '06-30', '07-01*', '07-02',
      '|',
      '07-09', '07-10*', '07-11',
    ]);
  });

  it('사이를 채워도 7일 이내면 클러스터를 병합한다 (7/1·7/3·7/10 → 7/1~7/3 병합)', () => {
    const { columns } = buildChinbaGridLayout(['2026-07-01', '2026-07-03', '2026-07-10']);
    const selectable = days(columns).filter((c) => c.selectable).map((c) => c.dateStr);
    expect(selectable).toEqual(['2026-07-01', '2026-07-03', '2026-07-10']);
    // 7/1~7/3이 한 클러스터(7/2는 비활성)로 연속 배치되고 구분선은 1개
    expect(columns.filter((c) => c.type === 'gap')).toHaveLength(1);
    expect(days(columns)).toHaveLength(7);
  });

  it('후보 7개 초과면 스크롤 모드: 후보일만 나열, 비연속 구간엔 구분선', () => {
    const input = [
      '2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04',
      '2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09',
    ];
    const { columns, isScroll } = buildChinbaGridLayout(input);
    expect(isScroll).toBe(true);
    expect(days(columns)).toHaveLength(8);
    expect(days(columns).every((c) => c.selectable)).toBe(true);
    expect(columns.filter((c) => c.type === 'gap')).toHaveLength(1);
  });

  it('중복·시간 포함 입력도 정규화된다', () => {
    const { columns } = buildChinbaGridLayout(['2026-07-01T00:00:00', '2026-07-01']);
    expect(days(columns).filter((c) => c.selectable)).toHaveLength(1);
  });
});
