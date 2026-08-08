/** 친바 '다가오는 일정' 선별 — MY 탭과 타임라인 홈 카드가 같은 기준을 쓴다. */

/** dates 배열에서 오늘(자정) 이후의 가장 이른 날짜를 ms로 반환. 없으면 null. */
export function earliestUpcoming(dates: string[], todayMs: number): number | null {
  let min: number | null = null;
  for (const d of dates) {
    const t = new Date(d).getTime();
    if (Number.isNaN(t) || t < todayMs) continue;
    if (min === null || t < min) min = t;
  }
  return min;
}

export interface UpcomingEntry<T> {
  event: T;
  /** 가장 이른 예정 날짜 (자정 기준 ms) */
  when: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** 다가오는 일정으로 치는 기간 — 가장 이른 예정 날짜가 오늘부터 7일 이내(7일째 포함) */
const UPCOMING_WINDOW_DAYS = 7;

/**
 * active 일정 중 가장 이른 예정 날짜가 오늘~7일 이내인 것을 날짜 오름차순으로 반환.
 * 홈 카드와 MY 탭 '다가오는 일정'이 함께 쓴다.
 */
export function selectUpcoming<T extends { status: string; dates: string[] }>(
  events: T[],
): UpcomingEntry<T>[] {
  const todayMs = new Date(new Date().toDateString()).getTime();
  const limitMs = todayMs + UPCOMING_WINDOW_DAYS * DAY_MS;
  return events
    .filter((e) => e.status === 'active')
    .map((event) => ({ event, when: earliestUpcoming(event.dates, todayMs) }))
    .filter((x): x is UpcomingEntry<T> => x.when !== null && x.when <= limitMs)
    .sort((a, b) => a.when - b.when);
}

/** 예정 날짜 표시용 라벨 — 오늘/내일/M월 D일 */
export function formatUpcomingDate(whenMs: number): string {
  const todayMs = new Date(new Date().toDateString()).getTime();
  if (whenMs < todayMs + DAY_MS) return '오늘';
  if (whenMs < todayMs + DAY_MS * 2) return '내일';
  const d = new Date(whenMs);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}
