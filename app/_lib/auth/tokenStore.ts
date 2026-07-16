/**
 * Access tokens are process-memory only. Web session recovery uses a non-secret
 * hint; native refresh credentials are never stored here or in web storage.
 */

export type AuthSessionState = 'anonymous' | 'active' | 'logout_pending';

let accessToken: string | null = null;
let authSessionState: AuthSessionState = 'anonymous';

export function getAccessToken(): string | null {
  return accessToken;
}

export function getAuthSessionState(): AuthSessionState {
  return authSessionState;
}

export function isLogoutPending(): boolean {
  return authSessionState === 'logout_pending';
}

/**
 * Prevents an acknowledgement race from presenting a successful logout before
 * server revocation and native notification cleanup have both completed.
 */
export function markLogoutPending(): void {
  authSessionState = 'logout_pending';
}

export function setAccessToken(
  token: string | null,
  options?: { persistSessionHint?: boolean },
): void {
  if (!token) {
    clearAccessToken();
    return;
  }
  if (authSessionState === 'logout_pending') {
    throw new Error('Cannot replace an access token while logout is pending.');
  }

  accessToken = token;
  authSessionState = 'active';
  if (options?.persistSessionHint ?? shouldPersistWebSessionHint()) {
    localStorage.setItem('session_hint', 'active');
  }
}

export function clearAccessToken(): void {
  accessToken = null;
  authSessionState = 'anonymous';
}

export function hasAccessToken(): boolean {
  return accessToken !== null && accessToken.length > 0;
}

function shouldPersistWebSessionHint(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const capacitor = (window as Window & {
    Capacitor?: { isNativePlatform?: () => boolean };
  }).Capacitor;
  return !capacitor?.isNativePlatform?.();
}
