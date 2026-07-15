'use client';

import { useEffect } from 'react';

import { Capacitor } from '@capacitor/core';
import { useRouter } from 'next/navigation';
import { FiLogIn } from 'react-icons/fi';

import { getGoogleLoginUrl } from '@/_lib/api';
import {
  isNativeAuthPlatform,
  startNativeOAuthLogin,
  subscribeToNativeAuthCallbacks,
} from '@/_lib/native/nativeAuth';

interface GoogleLoginButtonProps {
  onLoginStart?: () => void;
  fullWidth?: boolean;
}

export default function GoogleLoginButton({
  onLoginStart,
  fullWidth = false,
}: GoogleLoginButtonProps) {
  const router = useRouter();

  const getRedirectTo = () => {
    if (typeof window === 'undefined') return undefined;
    const redirectTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    return redirectTo.startsWith('/') ? redirectTo : undefined;
  };

  useEffect(() => {
    if (!isNativeAuthPlatform()) return;

    return subscribeToNativeAuthCallbacks(
      ({ redirectTo }) => router.replace(redirectTo),
      () => console.error('Native OAuth callback was rejected.'),
    );
  }, [router]);

  const handleLogin = async () => {
    onLoginStart?.();
    const redirectTo = getRedirectTo();

    if (isNativeAuthPlatform()) {
      try {
        await startNativeOAuthLogin('google', redirectTo);
      } catch {
        console.error('Native OAuth could not be started.');
      }
      return;
    }

    const platform = Capacitor.getPlatform();
    const baseUrl = getGoogleLoginUrl(redirectTo);
    const separator = baseUrl.includes('?') ? '&' : '?';
    window.location.href = `${baseUrl}${separator}platform=${encodeURIComponent(platform)}`;
  };

  return (
    <button
      onClick={handleLogin}
      className={`flex items-center gap-3 px-4 py-3 text-blue-600 transition-colors rounded-xl bg-blue-50 hover:bg-blue-100 ${fullWidth ? 'w-full' : ''}`}
    >
      <div className="flex items-center justify-center w-8 h-8 text-blue-600 bg-white rounded-full">
        <FiLogIn size={16} />
      </div>
      <span className="font-medium">Google 계정으로 로그인</span>
    </button>
  );
}
