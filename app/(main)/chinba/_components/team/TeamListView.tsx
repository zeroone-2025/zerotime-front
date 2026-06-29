'use client';

import { useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';
import { FiUsers } from 'react-icons/fi';

import LoadingSpinner from '@/_components/ui/LoadingSpinner';
import TeamStatsBanner from '@/_components/ui/TeamStatsBanner';
import { useMyTeams } from '@/_lib/hooks/useTeam';
import { clearLastTeamId, getLastTeamId } from '@/_lib/utils/chinbaSelection';
import { useAuthInitialized } from '@/providers';

export default function TeamListView() {
  const router = useRouter();
  const isAuthReady = useAuthInitialized();
  const { data, isLoading } = useMyTeams();
  const teams = data?.teams ?? [];

  // localStorage는 클라이언트에서만 읽어 hydration mismatch 방지
  const [lastId, setLastId] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    setLastId(getLastTeamId());
    setChecked(true);
  }, []);

  // 마지막 선택 동아리가 여전히 내 동아리 목록에 있으면 그 상세로 이동
  const redirectId = checked && lastId && teams.some((t) => t.id === lastId) ? lastId : null;

  useEffect(() => {
    if (!checked || !isAuthReady || isLoading) return;
    if (redirectId) {
      router.replace(`/chinba/team/detail?id=${redirectId}`);
    } else if (lastId) {
      clearLastTeamId(); // 이미 나간 동아리 등 → 기억 초기화
    }
  }, [checked, isAuthReady, isLoading, redirectId, lastId, router]);

  // 로딩 중이거나 리다이렉트 예정이면 스피너 (안내 화면 깜빡임 방지)
  if (!checked || !isAuthReady || isLoading || redirectId) {
    return (
      <div className="flex h-full items-center justify-center bg-white">
        <LoadingSpinner />
      </div>
    );
  }

  // 선택된 동아리가 없으면 홈에서 고르도록 안내
  return (
    <div className="flex h-full flex-col bg-white">
      <TeamStatsBanner />
      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-16 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-50">
          <FiUsers size={28} className="text-gray-300" />
        </div>
        <p className="mb-1 text-sm font-bold text-gray-700">선택된 동아리가 없어요</p>
        <p className="mb-4 text-xs leading-relaxed text-gray-400 break-keep">
          홈에서 동아리를 선택하면 여기로 바로 들어와요.
        </p>
        <button
          onClick={() => router.push('/chinba')}
          className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-bold text-white transition active:scale-95"
        >
          홈에서 동아리 선택
        </button>
      </div>
    </div>
  );
}
