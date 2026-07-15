import { API_BASE_URL, authApi } from './client';
import { setAccessToken, clearAccessToken, hasAccessToken } from '@/_lib/auth/tokenStore';

// 인증 초기화 상태
let isAuthInitialized = false;
let initializationPromise: Promise<boolean> | null = null;

// OAuth 프로바이더 타입
export type OAuthProvider = 'google' | 'apple' | 'naver' | 'kakao';

// 범용 소셜 로그인 URL 생성 (리다이렉트용)
export const getSocialLoginUrl = (provider: OAuthProvider, redirectTo?: string) => {
    const redirectParam = redirectTo ? encodeURIComponent(redirectTo) : 'user';
    return `${API_BASE_URL}/auth/${provider}/login?redirect_to=${redirectParam}`;
};

// 범용 소셜 로그인 URL 가져오기 (비동기) - iOS 외부 브라우저용
export const fetchSocialLoginUrl = async (
    provider: OAuthProvider,
    platform: string,
    redirectTo?: string
): Promise<string> => {
    const redirectParam = redirectTo ? `&redirect_to=${encodeURIComponent(redirectTo)}` : '';
    const response = await authApi.get<{ url: string }>(`/auth/${provider}/login/url?platform=${platform}${redirectParam}`);
    return response.data.url;
};

// 하위 호환: 기존 함수 유지
export const getGoogleLoginUrl = (redirectTo?: string) => getSocialLoginUrl('google', redirectTo);
export const fetchGoogleLoginUrl = async (platform: string, redirectTo?: string) =>
    fetchSocialLoginUrl('google', platform, redirectTo);

// 인증 초기화 여부 확인
export const isAuthReady = () => isAuthInitialized;

// 토큰 존재 여부 확인
export const checkHasToken = () => hasAccessToken();

// Refresh Token으로 새 Access Token 발급
export const refreshAccessToken = async (): Promise<string | null> => {
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
        if (
            typeof window !== 'undefined' &&
            error instanceof Error &&
            'response' in (error as unknown as Record<string, unknown>)
        ) {
            const status = (error as {response?: {status?: number}}).response?.status;
            if (status === 401 || status === 403) {
                localStorage.removeItem('session_hint');
            }
        }
        return null;
    }
};

// 앱 시작 시 세션 복구 (refresh token으로 access token 재발급)
export const initializeAuth = async (): Promise<boolean> => {
    // 이미 초기화 중이면 기존 Promise 반환
    if (initializationPromise) {
        return initializationPromise;
    }

    // 이미 초기화 완료면 토큰 존재 여부 반환
    if (isAuthInitialized) {
        return hasAccessToken();
    }

    initializationPromise = (async () => {
        // session_hint 없으면 게스트 — refresh 시도 없이 조기 반환
        const hasSessionHint = typeof window !== 'undefined' &&
                                localStorage.getItem('session_hint') !== null;
        if (!hasSessionHint) {
            isAuthInitialized = true;
            return false;
        }
        try {
            const token = await refreshAccessToken();
            isAuthInitialized = true;
            return !!token;
        } catch {
            isAuthInitialized = true;
            return false;
        } finally {
            initializationPromise = null;
        }
    })();

    return initializationPromise;
};

// 로그아웃 (백엔드에 요청 + 메모리 토큰 삭제)
export const logoutUser = async (): Promise<void> => {
    try {
        await authApi.post('/auth/logout');
    } catch {
        // 로그아웃 요청 실패해도 로컬 상태는 정리
    } finally {
        clearAccessToken();
        if (typeof window !== 'undefined') {
            localStorage.removeItem('session_hint');
        }
        isAuthInitialized = false;
    }
};

// 인증 상태 초기화 (테스트용)
export const resetAuthState = (): void => {
    isAuthInitialized = false;
    initializationPromise = null;
    clearAccessToken();
    if (typeof window !== 'undefined') {
        localStorage.removeItem('session_hint');
    }
};
