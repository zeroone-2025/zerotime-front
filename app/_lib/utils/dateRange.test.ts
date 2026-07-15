import { describe, it, expect } from 'vitest';
import { formatDateRanges } from './dateRange';

describe('formatDateRanges', () => {
  it('returns empty string for empty input', () => {
    expect(formatDateRanges([])).toBe('');
  });

  it('formats a single date as M/D', () => {
    expect(formatDateRanges(['2026-08-01'])).toBe('8/1');
  });

  it('collapses a fully consecutive run into one range', () => {
    expect(formatDateRanges(['2026-08-01', '2026-08-02', '2026-08-03'])).toBe('8/1 ~ 8/3');
  });

  it('joins fully non-consecutive dates with slashes', () => {
    expect(formatDateRanges(['2026-08-01', '2026-08-03', '2026-08-05'])).toBe('8/1 / 8/3 / 8/5');
  });

  it('handles a mix of runs and single days', () => {
    expect(
      formatDateRanges([
        '2026-08-01',
        '2026-08-02',
        '2026-08-03',
        '2026-08-07',
        '2026-08-10',
        '2026-08-11',
      ])
    ).toBe('8/1 ~ 8/3 / 8/7 / 8/10 ~ 8/11');
  });

  it('sorts unsorted input before grouping', () => {
    expect(formatDateRanges(['2026-08-03', '2026-08-01', '2026-08-02'])).toBe('8/1 ~ 8/3');
  });

  it('treats a month boundary (7/31 → 8/1) as consecutive', () => {
    expect(formatDateRanges(['2026-07-31', '2026-08-01'])).toBe('7/31 ~ 8/1');
  });
});
