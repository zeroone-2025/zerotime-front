'use client';

interface MoneyInputProps {
  value: number | null | undefined;
  onChange: (value: number | undefined) => void;
  placeholder?: string;
  'aria-label'?: string;
}

/** 문자열에서 숫자만 남긴다 (콤마·공백·한글 단위 등 제거) */
export function parseMoney(raw: string): number | undefined {
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits === '') return undefined;
  return Number(digits);
}

/** 12345 -> "12,345" */
export function formatMoney(value: number | null | undefined): string {
  if (value == null) return '';
  return value.toLocaleString('ko-KR');
}

/**
 * 천단위 콤마를 보여주는 금액 입력.
 * type="number"는 콤마를 못 보여줘 text + inputMode="numeric"으로 쓴다.
 */
export default function MoneyInput({
  value,
  onChange,
  placeholder = '사용 금액 (선택)',
  'aria-label': ariaLabel = '사용 금액',
}: MoneyInputProps) {
  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={formatMoney(value)}
        onChange={(e) => onChange(parseMoney(e.target.value))}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 pr-8 text-sm focus:border-gray-400 focus:outline-none"
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
        원
      </span>
    </div>
  );
}
