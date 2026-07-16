'use client';

import { Suspense, useEffect, useRef, useState } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

import { authApi, getUserProfile } from '@/_lib/api';
import { setAccessToken } from '@/_lib/auth/tokenStore';
import { createIdempotencyKey, MOBILE_RELEASE_CONTRACT } from '@/_lib/native/mobileRelease';
import { useUserStore } from '@/_lib/store/useUserStore';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const processedRef = useRef(false);
  const [status, setStatus] = useState('로그인 처리 중...');
  const setUser = useUserStore((state) => state.setUser);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    const error = searchParams.get('error');
    const redirectTo = searchParams.get('redirect_to');
    const safeRedirect = redirectTo?.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : null;
    const shouldResumeOnboarding = safeRedirect?.includes('resume_onboarding=true') ?? false;
    const shouldPreserveDeletionRedirect = safeRedirect === '/account-deletion/';

    // 사용자가 로그인을 취소한 경우
    if (error === 'access_denied') {
      setStatus('로그인이 취소되었습니다.');
      setTimeout(() => {
        router.replace(safeRedirect || '/');
      }, 800);
      return;
    }

    // 이메일 미제공 에러 (Kakao 등)
    if (error === 'email_required') {
      setStatus('이메일 정보가 필요합니다. 카카오 계정에 이메일을 등록해주세요.');
      setTimeout(() => {
        router.replace(safeRedirect || '/');
      }, 3000);
      return;
    }

    // 기타 에러가 있는 경우
    if (error) {
      setStatus('로그인 중 문제가 발생했습니다. 다시 시도해주세요.');
      setTimeout(() => {
        router.replace(safeRedirect || '/');
      }, 2000);
      return;
    }

    const processLogin = async () => {
      try {
        const refreshedAccessToken = (await authApi.post<{ access_token: string }>(
          '/auth/refresh',
          {},
          {
            headers: {
              'X-ZeroTime-Contract': MOBILE_RELEASE_CONTRACT,
              'Idempotency-Key': createIdempotencyKey(),
            },
          },
        )).data.access_token;
        if (!refreshedAccessToken) {
          throw new Error('MISSING_ACCESS_TOKEN');
        }

        setAccessToken(refreshedAccessToken);
        setStatus('로그인 성공! 사용자 정보를 확인하는 중...');

        const userProfile = await getUserProfile();
        setUser(userProfile);

        if (shouldResumeOnboarding) {
          setStatus('온보딩으로 이동하는 중...');
          setTimeout(() => {
            router.replace('/onboarding?resume_onboarding=true');
          }, 300);
          return;
        }

        if (!userProfile.dept_code && !shouldPreserveDeletionRedirect) {
          setStatus('환영합니다! 온보딩 정보를 입력해주세요.');
          setTimeout(() => {
            router.replace('/onboarding?login=success');
          }, 500);
        } else {
          setStatus('로그인 성공! 홈으로 이동합니다.');
          setTimeout(() => {
            router.replace(safeRedirect || '/?login=success');
          }, 500);
        }
      } catch {
        setStatus('로그인 실패. 다시 시도해주세요.');

        setTimeout(() => {
          router.replace(safeRedirect || '/');
        }, 2000);
      }
    };

    void processLogin();
  }, [searchParams, router, setUser]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-4">
        {/* 로딩 스피너 */}
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-gray-900"></div>
        {/* 로딩 문구 */}
        <p className="text-sm text-gray-600">{status}</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen w-full items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-gray-900"></div>
          <p className="text-sm text-gray-600">로그인 중입니다...</p>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
