// '지금은 무료 이벤트 기간' 안내 팝업(UpgradeModal)을 (사용자, 동아리)당 한 번만 띄우기 위한 기억.
// 서버 저장이 아니라 기기 로컬 기억이다 — 기기를 바꾸면 한 번 다시 뜬다.

const keyOf = (userId: number | undefined, teamId: number) =>
  `chinba:freeNoticeSeen:${userId ?? 0}:${teamId}`;

export function hasSeenFreeNotice(userId: number | undefined, teamId: number): boolean {
  try {
    if (typeof window === 'undefined' || !teamId) return false;
    return window.localStorage.getItem(keyOf(userId, teamId)) === '1';
  } catch {
    return false;
  }
}

export function markFreeNoticeSeen(userId: number | undefined, teamId: number): void {
  try {
    if (typeof window !== 'undefined' && teamId) {
      window.localStorage.setItem(keyOf(userId, teamId), '1');
    }
  } catch {
    /* localStorage 접근 불가(프라이빗 모드 등) 시 무시 */
  }
}
