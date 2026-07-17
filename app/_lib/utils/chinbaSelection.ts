// 홈에서 선택(또는 마지막으로 본) 친바 동아리 id를 기억한다.
// 하단 `동아리` 탭(/chinba/team)이 이 값을 읽어 해당 동아리 상세로 바로 들어간다.

const KEY = 'chinba:lastTeamId';

export function setLastTeamId(id: number): void {
  try {
    if (typeof window !== 'undefined' && id > 0) {
      window.localStorage.setItem(KEY, String(id));
    }
  } catch {
    /* localStorage 접근 불가(프라이빗 모드 등) 시 무시 */
  }
}

export function getLastTeamId(): number | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function clearLastTeamId(): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.removeItem(KEY);
  } catch {
    /* 무시 */
  }
}
