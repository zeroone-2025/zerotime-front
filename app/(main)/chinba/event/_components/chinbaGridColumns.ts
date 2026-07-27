// 친바 시간 그리드(내 일정/전체 일정 공용)의 열 구성 알고리즘.
//
// 원칙: 열 폭은 항상 "컨테이너 ÷ 7"로 고정하고, 날짜 수에 따라 열 폭이 널뛰지 않게 한다.
// - 전체 범위(첫날~마지막날)가 7일 이하: 범위를 통째로 깔고(사이의 비후보일은 비활성),
//   남는 칸은 앞뒤 패딩(비활성 실제 날짜)으로 채워 정확히 7일을 만든다.
// - 범위가 7일 초과, 후보 수 7개 이하: 가까운 날짜끼리 클러스터로 묶고(사이를 채워도
//   총 7칸 이내면 사이도 채움), 클러스터 사이에 구분선 열을 넣고 남는 칸을 패딩으로 분배.
// - 후보 수 7개 초과: 후보일만 나열(비연속 구간엔 구분선), 가로 스크롤.

export type ChinbaGridColumn =
  | { type: 'day'; dateStr: string; selectable: boolean }
  | { type: 'gap' };

export interface ChinbaGridLayout {
  columns: ChinbaGridColumn[];
  // 후보 수 7개 초과 → 열 폭은 ÷7 유지한 채 가로 스크롤
  isScroll: boolean;
}

const DAY_MS = 86_400_000;

// 'YYYY-MM-DD' → epoch 일수 (UTC 기준이라 타임존 영향 없음)
function toDayNum(dateStr: string): number {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

function toDateStr(dayNum: number): string {
  const dt = new Date(dayNum * DAY_MS);
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${m}-${d}`;
}

export function buildChinbaGridLayout(dates: string[]): ChinbaGridLayout {
  const dayNums = [...new Set(dates.map((d) => toDayNum(d.slice(0, 10))))].sort((a, b) => a - b);
  if (dayNums.length === 0) return { columns: [], isScroll: false };

  const candidateSet = new Set(dayNums);
  const first = dayNums[0];
  const last = dayNums[dayNums.length - 1];
  const span = last - first + 1;

  const dayColumn = (n: number): ChinbaGridColumn => ({
    type: 'day',
    dateStr: toDateStr(n),
    selectable: candidateSet.has(n),
  });

  // 스크롤 모드: 후보일만, 비연속 구간엔 구분선
  if (dayNums.length > 7) {
    const columns: ChinbaGridColumn[] = [];
    dayNums.forEach((n, i) => {
      if (i > 0 && n - dayNums[i - 1] > 1) columns.push({ type: 'gap' });
      columns.push(dayColumn(n));
    });
    return { columns, isScroll: true };
  }

  // 범위가 7일 이내: 범위 전체 + 앞뒤 패딩으로 정확히 7일
  if (span <= 7) {
    const padTotal = 7 - span;
    const start = first - Math.floor(padTotal / 2);
    const columns: ChinbaGridColumn[] = [];
    for (let i = 0; i < 7; i++) columns.push(dayColumn(start + i));
    return { columns, isScroll: false };
  }

  // 클러스터 모드: 연속 런으로 묶은 뒤, 사이를 채워도 총 7일 이내면 인접 클러스터 병합
  const clusters: { start: number; end: number }[] = [];
  for (const n of dayNums) {
    const lastCluster = clusters[clusters.length - 1];
    if (lastCluster && n - lastCluster.end === 1) lastCluster.end = n;
    else clusters.push({ start: n, end: n });
  }

  const totalDays = () => clusters.reduce((sum, c) => sum + (c.end - c.start + 1), 0);
  let mergedSomething = true;
  while (mergedSomething && clusters.length > 1) {
    mergedSomething = false;
    let bestIdx = -1;
    let bestGap = Infinity;
    for (let i = 0; i < clusters.length - 1; i++) {
      const gap = clusters[i + 1].start - clusters[i].end - 1;
      if (gap < bestGap) {
        bestGap = gap;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0 && totalDays() + bestGap <= 7) {
      clusters[bestIdx].end = clusters[bestIdx + 1].end;
      clusters.splice(bestIdx + 1, 1);
      mergedSomething = true;
    }
  }

  // 남는 칸을 클러스터별 패딩으로 분배 (앞쪽 클러스터 우선,
  // 첫 클러스터는 앞쪽 우선·나머지는 뒤쪽 우선으로 바깥 방향에 배치)
  let leftover = 7 - totalDays();
  const shares = clusters.map(() => 0);
  for (let i = 0; leftover > 0; i++, leftover--) {
    shares[i % clusters.length]++;
  }

  const columns: ChinbaGridColumn[] = [];
  clusters.forEach((cluster, idx) => {
    const share = shares[idx];
    const front = idx === 0 ? Math.ceil(share / 2) : Math.floor(share / 2);
    const back = share - front;
    if (idx > 0) columns.push({ type: 'gap' });
    for (let n = cluster.start - front; n <= cluster.end + back; n++) {
      columns.push(dayColumn(n));
    }
  });
  return { columns, isScroll: false };
}
