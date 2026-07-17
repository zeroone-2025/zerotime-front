'use client';

import { Suspense, useEffect, useRef, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';


import AuthPageShell from '@/_components/layout/AuthPageShell';
import { ToastProvider, useToast } from '@/_context/ToastContext';
import { useUser } from '@/_lib/hooks/useUser';
import {
  clearPendingOnboarding,
  loadPendingOnboarding,
  submitPendingOnboarding,
} from '@/_lib/onboarding/pendingSubmission';
import { useUserStore } from '@/_lib/store/useUserStore';

import OnboardingModal from '../../(main)/(home)/_components/OnboardingModal';

interface OnboardingCompleteOptions {
  redirectTo?: string;
}

const ONBOARDING_DRAFT_STORAGE_KEY = 'onboarding_draft_v1';

function OnboardingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { isAuthLoaded, isLoggedIn, user } = useUser();
  const setUser = useUserStore((state) => state.setUser);

  const [isResumingSubmit, setIsResumingSubmit] = useState(false);
  const [seniorCongratsBoards, setSeniorCongratsBoards] = useState<string[] | null>(null);
  const didTryResumeRef = useRef(false);
  const onboardingCompletedRef = useRef(false);

  // auth/callback에서 선배님 온보딩 완료 후 리다이렉트된 경우 축하 화면 표시
  useEffect(() => {
    const isCompleted =
      searchParams.get('senior_completed') === 'true' || searchParams.get('mentor_completed') === 'true';
    if (!isCompleted) return;
    onboardingCompletedRef.current = true;
    try {
      const stored = localStorage.getItem('my_subscribed_categories');
      setSeniorCongratsBoards(stored ? JSON.parse(stored) : []);
    } catch {
      setSeniorCongratsBoards([]);
    }
  }, [searchParams]);

  // 이미 온보딩 완료한 유저는 홈으로 리다이렉트 (축하 화면 표시 중이면 제외)
  useEffect(() => {
    if (!isAuthLoaded) return;
    if (onboardingCompletedRef.current) return;
    if (isLoggedIn && user?.user_type) {
      router.replace('/');
    }
  }, [isAuthLoaded, isLoggedIn, user?.user_type, router]);

  useEffect(() => {
    if (!isAuthLoaded || !isLoggedIn || didTryResumeRef.current) return;
    if (searchParams.get('resume_onboarding') !== 'true') return;

    didTryResumeRef.current = true;
    const pendingData = loadPendingOnboarding();
    if (!pendingData) return;
    if (pendingData.seniorCareer && !pendingData.seniorPrivacyConsent) {
      showToast('개인정보 동의 후 다시 완료해 주세요.', 'error');
      router.replace('/onboarding');
      return;
    }

    setIsResumingSubmit(true);
    (async () => {
      try {
        const payloadToSubmit = pendingData.seniorCareer
          ? {
              ...pendingData,
              seniorCareer: {
                ...pendingData.seniorCareer,
                contact: {
                  ...pendingData.seniorCareer.contact,
                  name: pendingData.seniorCareer.contact.name || user?.nickname || null,
                  email: pendingData.seniorCareer.contact.email || user?.email || null,
                },
              },
            }
          : pendingData;

        const result = await submitPendingOnboarding(payloadToSubmit);
        setUser(result.user);
        // useUpdateUser와 동일 패턴: 프로필이 실제로 읽는 ['user','init']와 구독/공지 캐시를
        // 무효화해, stale 캐시가 방금 저장한 학교/학과를 되덮지 않게 한다.
        queryClient.invalidateQueries({ queryKey: ['user', 'init'] });
        queryClient.invalidateQueries({ queryKey: ['user', 'subscriptions'] });
        queryClient.invalidateQueries({ queryKey: ['notices', 'infinite'] });
        localStorage.setItem('my_subscribed_categories', JSON.stringify(result.subscribedBoards));
        clearPendingOnboarding();
        localStorage.removeItem(ONBOARDING_DRAFT_STORAGE_KEY);

        if (pendingData.seniorCareer) {
          onboardingCompletedRef.current = true;
          setSeniorCongratsBoards(result.subscribedBoards);
        } else {
          showToast('온보딩 정보가 저장되었습니다.', 'success');
          router.replace('/');
        }
      } catch (error) {
        console.error('온보딩 재저장 실패:', error);
        showToast('저장에 실패했습니다. 온보딩에서 다시 완료해 주세요.', 'error');
      } finally {
        setIsResumingSubmit(false);
      }
    })();
  }, [isAuthLoaded, isLoggedIn, queryClient, router, searchParams, setUser, showToast, user?.email, user?.nickname]);

  const handleOnboardingComplete = (categories: string[], options?: OnboardingCompleteOptions) => {
    localStorage.setItem('my_subscribed_categories', JSON.stringify(categories));
    clearPendingOnboarding();
    localStorage.removeItem(ONBOARDING_DRAFT_STORAGE_KEY);
    // useUpdateUser와 동일 패턴: 프로필이 실제로 읽는 ['user','init']와 구독/공지 캐시를
    // 무효화해, 완료 후 이동한 화면이 stale 캐시로 이전 학교/학과를 되살리지 않게 한다.
    queryClient.invalidateQueries({ queryKey: ['user', 'init'] });
    queryClient.invalidateQueries({ queryKey: ['user', 'subscriptions'] });
    queryClient.invalidateQueries({ queryKey: ['notices', 'infinite'] });
    router.replace(options?.redirectTo || '/');
  };

  const handleRequireLogin = () => {
    const redirectTo = '/onboarding?resume_onboarding=true';
    router.push(`/login?redirect_to=${encodeURIComponent(redirectTo)}`);
  };

  const handleSeniorOnboardingCompleted = () => {
    onboardingCompletedRef.current = true;
  };

  if (!isAuthLoaded || isResumingSubmit) {
    return (
      <AuthPageShell center>
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-gray-900" />
      </AuthPageShell>
    );
  }

  if (seniorCongratsBoards) {
    return (
      <AuthPageShell center>
        <div className="flex flex-col items-center px-5 py-12">
          <div className="mb-6 text-7xl">🎉</div>
          <h2 className="mb-3 text-2xl font-bold text-gray-900">환영합니다, 선배님!</h2>
          <p className="mb-2 text-center text-sm leading-relaxed text-gray-500">
            지금은 선배님 정보 수집만 진행하고 있습니다.
            <br />
            현재 이력은 공개되지 않으며, 정식 런칭 후 공유 기능이 추가될 예정입니다.
          </p>
          <p className="mb-10 text-center text-xs text-gray-400">
            FLOW &gt; 내 이력에서 언제든지 수정할 수 있습니다.
          </p>
          <button
            onClick={() => handleOnboardingComplete(seniorCongratsBoards, { redirectTo: '/flow/career' })}
            className="w-full max-w-xs rounded-xl bg-gray-900 py-4 font-bold text-white transition-all hover:bg-gray-800"
          >
            이력관리로 이동
          </button>
        </div>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell>
      <OnboardingModal
        isOpen
        onComplete={handleOnboardingComplete}
        onShowToast={showToast}
        isLoggedIn={isLoggedIn}
        onRequireLogin={handleRequireLogin}
        onSeniorCompleted={handleSeniorOnboardingCompleted}
      />
    </AuthPageShell>
  );
}

function OnboardingFallback() {
  return (
    <AuthPageShell center>
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-gray-900" />
    </AuthPageShell>
  );
}

export default function OnboardingPage() {
  return (
    <ToastProvider>
      <Suspense fallback={<OnboardingFallback />}>
        <OnboardingPageContent />
      </Suspense>
    </ToastProvider>
  );
}
