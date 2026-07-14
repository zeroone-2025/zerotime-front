import { API_BASE_URL, authApi } from './client';
import {
  isNativeAuthPlatform,
  logoutNativeAuthSession,
  refreshNativeAuthSession,
} from '@/_lib/native/nativeAuth';
import {
  clearAccessToken,
  hasAccessToken,
  markLogoutPending,
  setAccessToken,
} from '@/_lib/auth/tokenStore';
import type { NativeOAuthProvider } from '@/_lib/native/nativeAuth';

let isAuthInitialized = false;
let initializationPromise: Promise<boolean> | null = null;

export type OAuthProvider = NativeOAuthProvider;

/** Web OAuth remains a redirect flow. Native OAuth uses nativeAuth.ts instead. */
export const getSocialLoginUrl = (provider: OAuthProvider, redirectTo?: string) => {
  const redirectParam = redirectTo ? encodeURIComponent(redirectTo) : 'user';
  return `${API_BASE_URL}/auth/${provider}/login?redirect_to=${redirectParam}`;
};

export const getGoogleLoginUrl = (redirectTo?: string) => getSocialLoginUrl('google', redirectTo);

export const isAuthReady = () => isAuthInitialized;

export const checkHasToken = () => hasAccessToken();

export const refreshAccessToken = async (): Promise<string | null> => {
  if (isNativeAuthPlatform()) {
    try {
      return await refreshNativeAuthSession();
    } catch {
      clearAccessToken();
      return null;
    }
  }

  try {
    const response = await authApi.post<{ access_token: string }>('/auth/refresh');
    const newToken = response.data.access_token;
    if (newToken) {
      setAccessToken(newToken);
      return newToken;
    }
    return null;
  } catch (error) {
    clearAccessToken();
    const status = responseStatus(error);
    if (typeof window !== 'undefined' && (status === 401 || status === 403)) {
      localStorage.removeItem('session_hint');
    }
    return null;
  }
};

export const initializeAuth = async (): Promise<boolean> => {
  if (initializationPromise) {
    return initializationPromise;
  }
  if (isAuthInitialized) {
    return hasAccessToken();
  }

  const promise = (async () => {
    try {
      if (isNativeAuthPlatform()) {
        return !!(await refreshNativeAuthSession());
      }

      const hasSessionHint = typeof window !== 'undefined' && localStorage.getItem('session_hint') !== null;
      return hasSessionHint && !!(await refreshAccessToken());
    } catch {
      clearAccessToken();
      return false;
    } finally {
      isAuthInitialized = true;
    }
  })();

  initializationPromise = promise;
  try {
    return await promise;
  } finally {
    if (initializationPromise === promise) {
      initializationPromise = null;
    }
  }
};

async function clearSensitiveWebCaches(): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return;
  }
  await Promise.all(['api-cache', 'pages-cache'].map((name) => window.caches.delete(name)));
}

/**
 * A failed acknowledgement intentionally rejects: callers must not render a
 * successful logout or account switch while logout_pending remains active.
 */
export const logoutUser = async (): Promise<void> => {
  markLogoutPending();

  if (isNativeAuthPlatform()) {
    await logoutNativeAuthSession('logout');
  } else {
    await authApi.post('/auth/logout');
    clearAccessToken();
    await clearSensitiveWebCaches();
  }

  if (typeof window !== 'undefined') {
    localStorage.removeItem('session_hint');
  }
  isAuthInitialized = false;
};

export const resetAuthState = (): void => {
  isAuthInitialized = false;
  initializationPromise = null;
  clearAccessToken();
  if (typeof window !== 'undefined') {
    localStorage.removeItem('session_hint');
    void clearSensitiveWebCaches();
  }
};

function responseStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object' || !('response' in error)) {
    return null;
  }
  const response = (error as { response?: unknown }).response;
  if (!response || typeof response !== 'object' || !('status' in response)) {
    return null;
  }
  const status = (response as { status?: unknown }).status;
  return typeof status === 'number' ? status : null;
}
