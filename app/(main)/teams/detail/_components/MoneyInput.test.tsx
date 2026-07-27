import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import MoneyInput, { parseMoney, formatMoney } from './MoneyInput';

describe('parseMoney', () => {
  it('숫자만 남긴다', () => {
    expect(parseMoney('155,000')).toBe(155000);
    expect(parseMoney('12원')).toBe(12);
    expect(parseMoney(' 3 000 ')).toBe(3000);
  });

  it('숫자가 없으면 undefined', () => {
    expect(parseMoney('')).toBeUndefined();
    expect(parseMoney('원')).toBeUndefined();
  });
});

describe('formatMoney', () => {
  it('천단위 콤마를 넣는다', () => {
    expect(formatMoney(155000)).toBe('155,000');
    expect(formatMoney(0)).toBe('0');
  });

  it('null/undefined는 빈 문자열', () => {
    expect(formatMoney(null)).toBe('');
    expect(formatMoney(undefined)).toBe('');
  });
});

describe('MoneyInput', () => {
  it('값을 콤마로 포맷해 보여준다', () => {
    render(<MoneyInput value={155000} onChange={vi.fn()} />);
    expect(screen.getByLabelText('사용 금액')).toHaveValue('155,000');
  });

  it('입력하면 숫자만 뽑아 올려준다', () => {
    const onChange = vi.fn();
    render(<MoneyInput value={null} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('사용 금액'), { target: { value: '12,3a4' } });
    expect(onChange).toHaveBeenCalledWith(1234);
  });

  it('비우면 undefined를 올려준다', () => {
    const onChange = vi.fn();
    render(<MoneyInput value={1000} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('사용 금액'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
