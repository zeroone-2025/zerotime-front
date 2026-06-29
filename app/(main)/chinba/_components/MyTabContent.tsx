'use client';

import { useMemo, useState } from 'react';

import { useRouter } from 'next/navigation';
import { FiCalendar, FiCheckSquare, FiClock, FiUsers } from 'react-icons/fi';

import TeamCard from '@/(main)/teams/_components/TeamCard';
import FullPageModal from '@/_components/layout/FullPageModal';
import { TimetableTab } from '@/_components/timetable';
import LoadingSpinner from '@/_components/ui/LoadingSpinner';
import { useMyChinbaEvents } from '@/_lib/hooks/useChinba';
import { useMyTeams } from '@/_lib/hooks/useTeam';
import { useUser } from '@/_lib/hooks/useUser';

import { ChinbaEventListItem } from './ChinbaEventListItem';

/** dates 배열에서 오늘(자정) 이후의 가장 이른 날짜를 ms로 반환. 없으면 null. */
function earliestUpcoming(dates: string[], todayMs: number): number | null {
  let min: number | null = null;
  for (const d of dates) {
    const t = new Date(d).getTime();
    if (Number.isNaN(t) || t < todayMs) continue;
    if (min === null || t < min) min = t;
  }
  return min;
}

export default function MyTabContent() {
  const router = useRouter();
  const { isAuthLoaded, isLoggedIn, user } = useUser();
  const { data: events, isLoading: isEventsLoading } = useMyChinbaEvents(
    isAuthLoaded && isLoggedIn,
  );
  const { data: teamsData, isLoading: isTeamsLoading } = useMyTeams();

  const [showTimetable, setShowTimetable] = useState(false);

  // 내 할일: 미제출 + active
  const todos = useMemo(
    () => (events ?? []).filter((e) => !e.my_submitted && e.status === 'active'),
    [events],
  );

  // 다가오는 일정: 오늘 이후 날짜를 가진 active 일정, 가장 이른 날짜 오름차순
  const upcoming = useMemo(() => {
    const todayMs = new Date(new Date().toDateString()).getTime();
    return (events ?? [])
      .filter((e) => e.status === 'active')
      .map((e) => ({ event: e, when: earliestUpcoming(e.dates, todayMs) }))
      .filter((x): x is { event: (typeof x)['event']; when: number } => x.when !== null)
      .sort((a, b) => a.when - b.when)
      .map((x) => x.event);
  }, [events]);

  const teams = teamsData?.teams ?? [];
  const isLoading = !isAuthLoaded || (isLoggedIn && (isEventsLoading || isTeamsLoading));

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      {/* 헤더 + 시간표 진입 버튼 */}
      <div className="sticky top-0 z-10 flex items-center justify-between bg-gray-50/95 px-4 pt-4 pb-3 backdrop-blur">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-gray-900">MY</h2>
          {isLoggedIn && user?.nickname && (
            <p className="truncate text-xs text-gray-500">{user.nickname}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowTimetable(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-bold text-gray-700 shadow-sm transition active:scale-[0.98]"
        >
          <FiCalendar size={15} />내 시간표
        </button>
      </div>

      <div className="space-y-4 px-4 pb-10">
        {!isLoggedIn && isAuthLoaded ? (
          <div className="rounded-2xl bg-white px-4 py-8 text-center shadow-sm">
            <p className="text-sm font-bold text-gray-700 break-keep">
              로그인하면 내 정보를 모아볼 수 있어요
            </p>
            <p className="mt-1 text-xs leading-relaxed text-gray-400 break-keep">
              내 할일, 동아리, 다가오는 일정을 한 곳에서 확인하세요.
            </p>
            <button
              type="button"
              onClick={() => router.push('/login?redirect=/chinba/my')}
              className="mt-3 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition active:scale-[0.98]"
            >
              로그인하기
            </button>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner size="sm" />
          </div>
        ) : (
          <>
            {/* 내 할일 */}
            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <SectionTitle icon={<FiCheckSquare size={15} className="text-amber-500" />} title="내 할일" />
              {todos.length > 0 ? (
                <div className="space-y-2">
                  {todos.map((event) => (
                    <ChinbaEventListItem
                      key={event.event_id}
                      event={event}
                      compact
                      onClick={() => router.push(`/chinba/event?id=${event.event_id}&tab=my`)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyText message="제출할 일정이 없어요" />
              )}
            </section>

            {/* 나의 동아리 */}
            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <SectionTitle icon={<FiUsers size={15} className="text-blue-500" />} title="나의 동아리" />
              {teams.length > 0 ? (
                <div className="space-y-2">
                  {teams.map((team) => (
                    <TeamCard
                      key={team.id}
                      team={team}
                      terminology="club"
                      onClick={() => router.push(`/chinba/team/detail?id=${team.id}`)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyText message="아직 참여 중인 동아리가 없어요" />
              )}
            </section>

            {/* 다가오는 일정 */}
            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <SectionTitle icon={<FiClock size={15} className="text-emerald-500" />} title="다가오는 일정" />
              {upcoming.length > 0 ? (
                <div className="space-y-2">
                  {upcoming.map((event) => (
                    <ChinbaEventListItem
                      key={event.event_id}
                      event={event}
                      compact
                      onClick={() => router.push(`/chinba/event?id=${event.event_id}`)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyText message="예정된 일정이 없어요" />
              )}
            </section>
          </>
        )}
      </div>

      {/* 시간표 모달 (기존 TimetableTab 그대로 재사용) */}
      <FullPageModal
        isOpen={showTimetable}
        onClose={() => setShowTimetable(false)}
        title="내 시간표"
        mode="overlay"
      >
        <TimetableTab />
      </FullPageModal>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      {icon}
      <h3 className="text-sm font-bold text-gray-900">{title}</h3>
    </div>
  );
}

function EmptyText({ message }: { message: string }) {
  return <p className="py-3 text-center text-xs text-gray-400">{message}</p>;
}
