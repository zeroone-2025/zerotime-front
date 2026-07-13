'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState } from 'react';
import { useUser } from '@/_lib/hooks/useUser';
import { initializeAuth, isAuthReady } from '@/_lib/api';

// QueryClient 인스턴스를 외부에서 접근할 수 있도록 export
let globalQueryClient: QueryClient | null = null;

export function getQueryClient() {
  return globalQueryClient;
}

// 인증 초기화 상태 Context
const AuthInitContext = createContext<boolean>(false);

export function useAuthInitialized() {
  return useContext(AuthInitContext);
}

/**
 * 앱 시작 시 세션 복구를 담당하는 컴포넌트
 * - refresh token(HttpOnly 쿠키)으로 access token 재발급 시도
 */
function AuthInitializer({ children }: { children: React.ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);
  // DEV 목업 모드에서는 어댑터 설치 완료 전까지 자식 렌더를 막아, 인증 게이트 없는 쿼리
  // (통계 배너 등)가 설치 전에 실 백엔드로 새는 레이스를 없앤다. 비목업/프로덕션은 항상 true
  // (조건이 process.env 리터럴로 폴딩되어 프로덕션에선 !(false) = true).
  const [mockReady, setMockReady] = useState(
    !(process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_MOCK_AUTH === 'true'),
  );

  useEffect(() => {
    // 이미 초기화되었으면 스킵
    if (isAuthReady()) {
      setIsInitialized(true);
      setMockReady(true);
      return;
    }

    // 디버깅용 로그
    console.log('[Auth] Initializing... environment:', {
      href: window.location.href,
      origin: window.location.origin
    });

    // 세션 복구 시도 (안전장치 포함)
    const hideSplash = async () => {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        const { SplashScreen } = await import('@capacitor/splash-screen');
        await SplashScreen.hide().catch(() => { });
        console.log('[Capacitor] Splash screen hidden');
      }
    };

    const boot = async () => {
      // DEV 전용: 세션 복구(첫 /auth/refresh) 전에 목업 어댑터를 설치해야 새로고침 시
      // 페르소나가 복구된다. 조건은 반드시 process.env 리터럴로 인라인해야 webpack이
      // 프로덕션에서 이 분기(와 동적 import 청크)를 통째로 제거한다 — 함수로 감싸면 안 됨.
      if (
        process.env.NODE_ENV !== 'production' &&
        process.env.NEXT_PUBLIC_MOCK_AUTH === 'true'
      ) {
        try {
          const { installMockLayer } = await import('@/_lib/mock/installMock');
          installMockLayer();
        } catch (err) {
          console.error('[MockAuth] 목업 레이어 설치 실패:', err);
        } finally {
          setMockReady(true); // 설치가 끝나야(성공/실패 무관) 자식 렌더 허용
        }
      }

      // 1. 세션 복구 시작
      const authPromise = initializeAuth().then(() => {
        console.log('[Auth] Session recovery complete');
      }).catch(err => {
        console.error('[Auth] Session recovery failed:', err);
      });

      // 2. 안전장치: 5초 후에는 무조건 Splash 닫기 (네이티브 앱 전용)
      const timeoutPromise = new Promise(resolve => setTimeout(() => {
        console.log('[Auth] Initialization timeout (5s)');
        resolve(null);
      }, 5000));

      // 어느 쪽이먼저든 끝나면 UI 표시 및 스플래시 숨기기
      Promise.race([authPromise, timeoutPromise]).finally(() => {
        setIsInitialized(true);
        hideSplash();
      });
    };

    boot();
  }, []);

  // Deep Link 리스너 (OAuth 콜백 처리)
  useEffect(() => {
    let listener: any;

    const setupDeepLinkListener = async () => {
      const { Capacitor } = await import('@capacitor/core');

      if (!Capacitor.isNativePlatform()) return;

      const { App } = await import('@capacitor/app');
      const { Browser } = await import('@capacitor/browser');
      const { setAccessToken } = await import('@/_lib/auth/tokenStore');

      listener = await App.addListener('appUrlOpen', async (event) => {
        console.log('[Deep Link] Received:', event.url);

        try {
          const url = new URL(event.url);

          // OAuth 콜백 처리
          if (url.pathname.includes('auth/callback')) {
            const accessToken = url.searchParams.get('access_token');

            if (accessToken) {
              console.log('[Deep Link] Access token received, storing...');
              setAccessToken(accessToken);

              // 외부 브라우저 닫기
              await Browser.close();

              const redirectTo = url.searchParams.get('redirect_to');
              const safeRedirect = redirectTo?.startsWith('/') ? redirectTo : '/';
              // redirect_to가 있으면 해당 경로로 이동
              window.location.href = safeRedirect;
            }
          }
        } catch (error) {
          console.error('[Deep Link] Error processing URL:', error);
        }
      });
    };

    setupDeepLinkListener();

    return () => {
      if (listener) {
        listener.remove();
      }
    };
  }, []);

  return (
    <AuthInitContext.Provider value={isInitialized}>
      {mockReady ? children : null}
    </AuthInitContext.Provider>
  );
}

/**
 * 전역 유저 데이터를 초기화하고 동기화하는 컴포넌트
 */
function UserHydrator() {
  useUser();
  return null;
}

/**
 * Providers wrapper component
 * Includes React Query for data fetching and caching
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  // QueryClient는 컴포넌트 내부에서 생성 (SSR 이슈 방지)
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 1000 * 60, // 1분 동안 데이터를 fresh로 간주
          gcTime: 1000 * 60 * 5, // 5분 동안 캐시 유지
          refetchOnWindowFocus: false, // 윈도우 포커스 시 자동 재요청 비활성화
          retry: 1, // 실패 시 1번만 재시도
        },
      },
    });
    globalQueryClient = client;
    return client;
  });

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        registration.unregister().catch(() => { });
      });
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthInitializer>
        <UserHydrator />
        {children}
      </AuthInitializer>
    </QueryClientProvider>
  );
}
