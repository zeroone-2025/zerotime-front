'use client';

import { useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';
import { FiPlus, FiUsers } from 'react-icons/fi';

import TeamCard from '@/(main)/teams/_components/TeamCard';
import LoadingSpinner from '@/_components/ui/LoadingSpinner';
import TeamStatsBanner from '@/_components/ui/TeamStatsBanner';
import { useMyTeams } from '@/_lib/hooks/useTeam';
import { useUser } from '@/_lib/hooks/useUser';
import { clearLastTeamId, getLastTeamId } from '@/_lib/utils/chinbaSelection';
import type { TeamListItem } from '@/_types/team';

export default function TeamListView() {
  const router = useRouter();
  const { isAuthLoaded, isLoggedIn } = useUser();
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
    if (!checked || !isAuthLoaded || (isLoggedIn && isLoading)) return;
    if (redirectId) {
      router.replace(`/chinba/team/detail?id=${redirectId}`);
    } else if (lastId) {
      clearLastTeamId(); // 이미 나간 동아리 등 → 기억 초기화
    }
  }, [checked, isAuthLoaded, isLoggedIn, isLoading, redirectId, lastId, router]);

  // 로딩 중이거나 리다이렉트 예정이면 스피너 (안내 화면 깜빡임 방지)
  if (!checked || !isAuthLoaded || (isLoggedIn && isLoading) || redirectId) {
    return (
      <div className="flex h-full items-center justify-center bg-white">
        <LoadingSpinner />
      </div>
    );
  }

  // 선택 기록이 없으면 탭 안에서 바로 고른다 — 비로그인/동아리 없음은 각각 안내
  return (
    <div className="flex h-full flex-col bg-white">
      <TeamStatsBanner />
      {!isLoggedIn ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 pb-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-50">
            <FiUsers size={28} className="text-gray-300" />
          </div>
          <p className="mb-1 text-sm font-bold text-gray-700">로그인이 필요해요</p>
          <p className="mb-4 text-xs leading-relaxed text-gray-400 break-keep">
            로그인하면 내 동아리를 골라 바로 들어갈 수 있어요.
          </p>
          <button
            onClick={() => router.push('/login?redirect=/chinba/team')}
            className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-bold text-white transition active:scale-95"
          >
            로그인
          </button>
        </div>
      ) : teams.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 pb-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-50">
            <FiUsers size={28} className="text-gray-300" />
          </div>
          <p className="mb-1 text-sm font-bold text-gray-700">아직 참여 중인 동아리가 없어요</p>
          <p className="mb-4 text-xs leading-relaxed text-gray-400 break-keep">
            동아리를 만들거나 초대코드로 참여하세요.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => router.push('/chinba/team/join')}
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-600 transition active:scale-95"
            >
              초대코드로 참여
            </button>
            <button
              onClick={() => router.push('/chinba/team/create')}
              className="flex items-center gap-1 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-bold text-white transition active:scale-95"
            >
              <FiPlus size={15} />
              만들기
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-gray-900">내 동아리</h2>
            <div className="flex shrink-0 gap-1.5">
              <button
                type="button"
                onClick={() => router.push('/chinba/team/join')}
                className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 active:scale-95"
              >
                초대코드
              </button>
              <button
                type="button"
                onClick={() => router.push('/chinba/team/create')}
                className="flex items-center gap-1 rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-800 active:scale-95"
              >
                <FiPlus size={13} />
                만들기
              </button>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {teams.map((team: TeamListItem) => (
              <TeamCard
                key={team.id}
                team={team}
                terminology="club"
                onClick={() => router.push(`/chinba/team/detail?id=${team.id}`)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
