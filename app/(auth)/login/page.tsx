'use client';

import { Suspense, useEffect, useState, type ComponentType } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import LoginButtonGroup from '@/_components/auth/LoginButtonGroup';
import Logo from '@/_components/ui/Logo';
import AuthPageShell from '@/_components/layout/AuthPageShell';
import { useUser } from '@/_lib/hooks/useUser';

const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google',
  apple: 'Apple',
  naver: '네이버',
  kakao: '카카오',
};

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthLoaded, isLoggedIn } = useUser();
  const [recentProviderLabel, setRecentProviderLabel] = useState<string | null>(null);
  const [MockForm, setMockForm] = useState<ComponentType<{ redirectTo?: string }> | null>(null);
  const redirectTo = searchParams.get('redirect_to');
  const safeRedirectTo = redirectTo?.startsWith('/') ? redirectTo : undefined;

  // DEV 전용 목업 로그인 폼: 조건을 process.env 리터럴로 인라인해야 webpack이 프로덕션에서
  // 이 동적 import(와 MockLoginForm 청크·픽스처)를 통째로 제거한다 — 함수로 감싸면 안 됨.
  useEffect(() => {
    if (
      process.env.NODE_ENV !== 'production' &&
      process.env.NEXT_PUBLIC_MOCK_AUTH === 'true'
    ) {
      let active = true;
      import('./_components/MockLoginForm').then((m) => {
        if (active) setMockForm(() => m.default);
      });
      return () => {
        active = false;
      };
    }
  }, []);

  useEffect(() => {
    if (!isAuthLoaded) return;
    if (isLoggedIn) {
      router.replace(safeRedirectTo || '/');
    }
  }, [isAuthLoaded, isLoggedIn, router, safeRedirectTo]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const recentProvider = localStorage.getItem('last_login_provider');
    if (!recentProvider) return;
    const providerLabel = PROVIDER_LABELS[recentProvider];
    if (providerLabel) {
      setRecentProviderLabel(providerLabel);
    }
  }, []);

  if (!isAuthLoaded || isLoggedIn) {
    return (
      <AuthPageShell center>
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-gray-900" />
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell>
      <div className="flex min-h-dvh w-full flex-1 px-6 py-10 md:px-10 md:py-12">
        <div className="flex w-full flex-1 flex-col">
          <div className="pt-6">
            <div className="mb-6 flex justify-center">
              <Logo className="h-8 w-auto text-gray-900" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">로그인</h1>
            <p className="mt-2 text-base text-gray-900">
              소셜 계정으로 간편하게 시작하세요.
            </p>
          </div>
          <div className="mt-auto space-y-2 pb-safe">
            <div className="relative pt-5">
              {recentProviderLabel && (
                <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-full">
                  <p className="relative whitespace-nowrap rounded-md border border-[#3B82F6] bg-[#EFF6FF] px-2.5 py-1 text-center text-xs font-semibold text-[#3B82F6] shadow-sm">
                    최근에 {recentProviderLabel} 로그인을 사용했어요.
                  </p>
                  <span className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-[7px] border-t-[8px] border-x-transparent border-t-[#3B82F6]" />
                  <span className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 -mt-px border-x-[6px] border-t-[7px] border-x-transparent border-t-[#EFF6FF]" />
                </div>
              )}
              <LoginButtonGroup layout="stack" redirectTo={safeRedirectTo} />
            </div>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="w-full pt-2 text-sm font-medium text-gray-400 transition-colors hover:text-gray-600"
            >
              로그인 없이 둘러보기
            </button>
            {MockForm && <MockForm redirectTo={safeRedirectTo} />}
          </div>
        </div>
      </div>
    </AuthPageShell>
  );
}

function LoginFallback() {
  return (
    <AuthPageShell center>
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-gray-900" />
    </AuthPageShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginPageContent />
    </Suspense>
  );
}
