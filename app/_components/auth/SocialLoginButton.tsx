'use client';

import { useEffect } from 'react';

import { Capacitor } from '@capacitor/core';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

import { getSocialLoginUrl } from '@/_lib/api';
import type { OAuthProvider } from '@/_lib/api';
import {
  isNativeAuthPlatform,
  startNativeOAuthLogin,
  subscribeToNativeAuthCallbacks,
} from '@/_lib/native/nativeAuth';

interface ProviderConfig {
  label: string;
  bg: string;
  text: string;
  icon: string;
}

const PROVIDER_CONFIGS: Record<OAuthProvider, ProviderConfig> = {
  google: {
    label: 'Google',
    bg: 'bg-white border border-gray-200',
    text: 'text-gray-700',
    icon: '/icons/google.svg',
  },
  apple: {
    label: 'Apple',
    bg: 'bg-black',
    text: 'text-white',
    icon: '/icons/apple.svg',
  },
  naver: {
    label: '네이버',
    bg: 'bg-[#03C75A]',
    text: 'text-white',
    icon: '/icons/naver.svg',
  },
  kakao: {
    label: '카카오',
    bg: 'bg-[#FEE500]',
    text: 'text-[#191919]',
    icon: '/icons/kakao.svg',
  },
};

interface SocialLoginButtonProps {
  provider: OAuthProvider;
  onLoginStart?: () => void;
  redirectTo?: string;
}

export default function SocialLoginButton({
  provider,
  onLoginStart,
  redirectTo,
}: SocialLoginButtonProps) {
  const router = useRouter();
  const config = PROVIDER_CONFIGS[provider];

  const getRedirectTo = () => {
    if (redirectTo?.startsWith('/')) return redirectTo;
    if (typeof window === 'undefined') return undefined;
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    return currentPath.startsWith('/') ? currentPath : undefined;
  };

  useEffect(() => {
    if (!isNativeAuthPlatform()) return;

    return subscribeToNativeAuthCallbacks(
      ({ redirectTo: safeRedirectTo }) => router.replace(safeRedirectTo),
      () => console.error('Native OAuth callback was rejected.'),
    );
  }, [router]);

  const handleLogin = async () => {
    onLoginStart?.();
    const target = getRedirectTo();

    if (isNativeAuthPlatform()) {
      try {
        await startNativeOAuthLogin(provider, target);
      } catch {
        console.error('Native OAuth could not be started.');
      }
      return;
    }

    const platform = Capacitor.getPlatform();
    const baseUrl = getSocialLoginUrl(provider, target);
    const separator = baseUrl.includes('?') ? '&' : '?';
    window.location.href = `${baseUrl}${separator}platform=${encodeURIComponent(platform)}`;
  };

  return (
    <button
      onClick={handleLogin}
      className={`flex w-full items-center justify-center gap-2 px-3 py-3 rounded-xl transition-colors ${config.bg} hover:opacity-90`}
    >
      <Image src={config.icon} alt={provider} width={18} height={18} />
      <span className={`text-sm font-medium ${config.text}`}>{config.label}</span>
    </button>
  );
}
