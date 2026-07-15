'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { devPersonaLogin, type DevPersonaRole } from '@/_lib/api/auth';

const PERSONAS: { role: DevPersonaRole; label: string }[] = [
  { role: 'captain', label: '회장' },
  { role: 'executive', label: '운영진' },
  { role: 'member', label: '부원' },
];

/**
 * dev 전용 역할별 테스트 로그인 버튼 (회장/운영진/부원).
 *
 * NEXT_PUBLIC_DEV_PERSONA_LOGIN=true 빌드에서만 렌더된다 — dev 배포와 로컬 .env.local에서만
 * 켠다. 백엔드도 DEV_PERSONA_LOGIN_ENABLED 게이트가 있어 둘 다 켜져야 동작한다.
 * 발급받은 토큰은 실 소셜 로그인과 동일하게 /auth/callback 흐름으로 처리한다.
 */
export default function DevPersonaLoginButtons({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter();
  const [loadingRole, setLoadingRole] = useState<DevPersonaRole | null>(null);
  const [error, setError] = useState(false);

  if (process.env.NEXT_PUBLIC_DEV_PERSONA_LOGIN !== 'true') return null;

  const handleClick = async (role: DevPersonaRole) => {
    if (loadingRole) return;
    setLoadingRole(role);
    setError(false);
    try {
      const token = await devPersonaLogin(role);
      const redirectParam = redirectTo ? `&redirect_to=${encodeURIComponent(redirectTo)}` : '';
      router.replace(`/auth/callback?access_token=${encodeURIComponent(token)}${redirectParam}`);
    } catch {
      setError(true);
      setLoadingRole(null);
    }
  };

  return (
    <div className="pt-4">
      <p className="text-center text-xs text-gray-400">개발용 · 동아리 역할별 테스트 로그인</p>
      <div className="mt-2 flex justify-center gap-2">
        {PERSONAS.map(({ role, label }) => (
          <button
            key={role}
            type="button"
            onClick={() => handleClick(role)}
            disabled={loadingRole !== null}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50"
          >
            {loadingRole === role ? '로그인 중…' : label}
          </button>
        ))}
      </div>
      {error && (
        <p className="mt-2 text-center text-xs text-red-500">
          테스트 로그인 실패 — 백엔드 설정(DEV_PERSONA_LOGIN_ENABLED)을 확인하세요.
        </p>
      )}
    </div>
  );
}
