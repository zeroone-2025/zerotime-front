// "YYYY-MM-DD" → UTC 기준 일(day) 정수. 연속성 판별용.
function toDayNumber(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

// "YYYY-MM-DD" → "M/D" (연도 생략, 기존 표기 관례 유지)
function formatMonthDay(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${m}/${d}`;
}

/**
 * 정렬된(혹은 정렬 안 된) "YYYY-MM-DD" 날짜 배열을 사람이 읽기 좋은 구간 문자열로 압축한다.
 * 연속 구간은 "M/D ~ M/D", 단일 날짜는 "M/D"로, 구간 사이는 " / "로 연결한다.
 *
 * 예: ['2026-08-01','2026-08-02','2026-08-03','2026-08-07','2026-08-10','2026-08-11']
 *   → "8/1 ~ 8/3 / 8/7 / 8/10 ~ 8/11"
 */
export function formatDateRanges(dates: string[]): string {
  if (dates.length === 0) return '';
  const sorted = [...dates].sort(); // ISO 문자열 정렬 = 날짜순
  const groups: string[][] = [];
  for (const d of sorted) {
    const last = groups[groups.length - 1];
    if (last && toDayNumber(d) === toDayNumber(last[last.length - 1]) + 1) {
      last.push(d); // 직전 날짜와 연속 → 같은 구간
    } else {
      groups.push([d]); // 끊김(또는 첫 원소) → 새 구간
    }
  }
  return groups
    .map((g) =>
      g.length === 1
        ? formatMonthDay(g[0])
        : `${formatMonthDay(g[0])} ~ ${formatMonthDay(g[g.length - 1])}`
    )
    .join(' / ');
}
