// "YYYY-MM-DD" → UTC 기준 일(day) 정수. 연속성 판별용.
function toDayNumber(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

// "YYYY-MM-DD" → "YYYY. M. D." / "M. D." (withYear로 연도 노출 여부 결정)
function formatDate(iso: string, withYear: boolean): string {
  const [y, m, d] = iso.split('-').map(Number);
  return withYear ? `${y}. ${m}. ${d}.` : `${m}. ${d}.`;
}

/**
 * 정렬된(혹은 정렬 안 된) "YYYY-MM-DD" 날짜 배열을 사람이 읽기 좋은 구간 문자열로 압축한다.
 * 연속 구간은 "YYYY. M. D. ~ M. D.", 단일 날짜는 "YYYY. M. D."로, 구간 사이는 " / "로 연결한다.
 *
 * 연도는 반복하지 않는다 — 처음 나올 때와 직전에 출력한 연도에서 바뀔 때만 붙인다.
 * 카드 안 좁은 폭(truncate)에 들어가야 해서 길이를 줄이는 쪽을 택했다.
 *
 * 예: ['2026-08-01','2026-08-02','2026-08-03','2026-08-07','2026-08-10','2026-08-11']
 *   → "2026. 8. 1. ~ 8. 3. / 8. 7. / 8. 10. ~ 8. 11."
 * 예: ['2026-12-30','2026-12-31','2027-01-01','2027-01-02']
 *   → "2026. 12. 30. ~ 2027. 1. 2."
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

  let lastYear = ''; // 직전에 출력한 연도 — 바뀔 때만 다시 붙인다
  const render = (iso: string): string => {
    const year = iso.slice(0, 4);
    const withYear = year !== lastYear;
    lastYear = year;
    return formatDate(iso, withYear);
  };

  return groups
    .map((g) => (g.length === 1 ? render(g[0]) : `${render(g[0])} ~ ${render(g[g.length - 1])}`))
    .join(' / ');
}
