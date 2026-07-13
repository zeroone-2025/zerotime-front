/**
 * DEV 전용 목업 인증 게이트 + 페르소나 영속.
 *
 * 이 파일은 프로덕션 번들에 포함될 수 있으나(픽스처 없음, 순수 함수),
 * `isMockAuthEnabled()`가 프로덕션 빌드에서 `false`로 상수 폴딩되어
 * 목업 관련 코드(폼/어댑터/픽스처)는 죽은 분기로 제거된다.
 */

/**
 * 목업 로그인 활성 여부.
 * - 두 피연산자 모두 빌드 시 리터럴로 인라인된다.
 * - 프로덕션(`next build`)에서는 `NODE_ENV === 'production'`이므로 항상 `false`.
 *   `NEXT_PUBLIC_MOCK_AUTH=true`를 프로덕션에 줘도 켜지지 않는다.
 */
export function isMockAuthEnabled(): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    process.env.NEXT_PUBLIC_MOCK_AUTH === 'true'
  );
}

// 새로고침에도 살아남도록 활성 페르소나를 localStorage에 보관 (메모리 토큰은 리로드 시 소실).
const PERSONA_KEY = 'mock_persona';

export function getActivePersonaId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(PERSONA_KEY);
}

export function setActivePersonaId(id: string): void {
  if (typeof window !== 'undefined') localStorage.setItem(PERSONA_KEY, id);
}

export function clearActivePersonaId(): void {
  if (typeof window !== 'undefined') localStorage.removeItem(PERSONA_KEY);
}

/** 목업 접근 토큰 — 마커일 뿐이며 "어느 페르소나인지"의 근거는 getActivePersonaId(). */
export function makeMockToken(personaId: string): string {
  return `mock-${personaId}`;
}
