'use client';

/**
 * DEV 전용 목업 로그인 폼.
 *
 * 아이디/비밀번호로 페르소나(회장/운영진/회원)를 골라 친바 클럽 권한별 플로우를 테스트한다.
 * 제출 시 페르소나+토큰을 저장하고 **하드 내비게이션**으로 이동한다 — 리로드가
 * initializeAuth → /auth/refresh(목업) → 페르소나 복구 경로를 그대로 타므로 결정적이다.
 *
 * 이 파일은 login/page.tsx에서 dead-branch 동적 import로만 로드된다(프로덕션 미로드).
 */

import { useState } from 'react';

import { setAccessToken } from '@/_lib/auth/tokenStore';
import {
  isMockAuthEnabled,
  setActivePersonaId,
  makeMockToken,
} from '@/_lib/mock/mockConfig';
import { MOCK_CREDENTIALS, MOCK_PERSONA_LIST } from '@/_lib/mock/personas';

const DEFAULT_TARGET = '/chinba/team/detail?id=1';

export default function MockLoginForm({ redirectTo }: { redirectTo?: string }) {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  // 이중 방어: 프로덕션/비목업 모드에서는 렌더 자체를 막는다.
  if (!isMockAuthEnabled()) return null;

  const login = (idValue: string, pwValue: string) => {
    const personaId = MOCK_CREDENTIALS[`${idValue}:${pwValue}`];
    if (!personaId) {
      setError('목업 자격증명이 올바르지 않습니다.');
      return;
    }
    setActivePersonaId(personaId);
    setAccessToken(makeMockToken(personaId)); // session_hint 기록 → 리로드 시 세션 복구
    const target = redirectTo && redirectTo.startsWith('/') ? redirectTo : DEFAULT_TARGET;
    window.location.href = target;
  };

  return (
    <div className="mt-6 rounded-lg border-2 border-dashed border-amber-400 bg-amber-50 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-amber-700">
          DEV MOCK LOGIN
        </span>
        <span className="text-[11px] text-amber-600">권한별 플로우 테스트용</span>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          login(id, password);
        }}
        className="space-y-2"
      >
        <input
          type="text"
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder="아이디 (captain / exec / member)"
          autoCapitalize="none"
          autoCorrect="off"
          className="w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-amber-500"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호"
          className="w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-amber-500"
        />
        {error && <p className="text-xs font-medium text-red-600">{error}</p>}
        <button
          type="submit"
          className="w-full rounded-md bg-amber-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-600 active:scale-[0.99]"
        >
          목업 로그인
        </button>
      </form>

      <div className="mt-3 flex gap-2">
        {MOCK_PERSONA_LIST.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => login(p.credential.id, p.credential.password)}
            className="flex-1 rounded-md border border-amber-400 bg-white px-2 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100"
          >
            {p.label}
          </button>
        ))}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-amber-700">
        · 쓰기(역할 변경·삭제 등)는 성공하지만 새로고침 시 원래 상태로 되돌아갑니다(비영속 목업).
        <br />· 백엔드 없이 동작하며 프로덕션 빌드에는 포함되지 않습니다.
      </p>
    </div>
  );
}
