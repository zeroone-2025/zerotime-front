'use client';

import { useMemo } from 'react';

import { useRouter } from 'next/navigation';
import { FiCalendar, FiClock, FiGrid, FiLink, FiPlus, FiUsers } from 'react-icons/fi';

import { ChinbaEventListItem } from '@/(main)/chinba/_components/ChinbaEventListItem';
import TeamCard from '@/(main)/teams/_components/TeamCard';
import LoadingSpinner from '@/_components/ui/LoadingSpinner';
import { useMyChinbaEvents } from '@/_lib/hooks/useChinba';
import { useMyTeams } from '@/_lib/hooks/useTeam';
import { useTeamStats } from '@/_lib/hooks/useTeamStats';
import { useUser } from '@/_lib/hooks/useUser';
import { selectUpcoming, formatUpcomingDate } from '@/_lib/utils/chinbaUpcoming';
import type { TeamListItem } from '@/_types/team';

const CONCEPTS = [
  {
    title: '시간표 기반',
    description: '내 수업 시간을 반영해서 비는 시간을 빠르게 찾습니다.',
    icon: FiClock,
  },
  {
    title: '링크 공유',
    description: '카톡방에 링크만 보내면 멤버가 바로 참여합니다.',
    icon: FiLink,
  },
  {
    title: '동아리 운영',
    description: '동아리 전체, 조별, 활동별로 일정을 따로 조율합니다.',
    icon: FiUsers,
  },
];

const USE_CASES = ['동아리 정기모임', '조별과제 회의', '스터디 시간', 'MT/회식 날짜'];

export default function ChinbaHomePage() {
  const router = useRouter();
  const { isAuthLoaded, isLoggedIn } = useUser();
  const { data: stats } = useTeamStats();
  const { data: teamsData, isLoading: isTeamsLoading } = useMyTeams();
  // 다가오는 일정 카드 — my-events 기반이라 동아리 일정과 '동아리 없이 잡은' 개인 일정을 모두 포함
  const { data: myEvents } = useMyChinbaEvents(isAuthLoaded && isLoggedIn);
  const upcoming = useMemo(() => selectUpcoming(myEvents ?? []), [myEvents]);
  // 동아리 없이 잡은 개인 일정 — 완료 처리 전(진행중·지난 일정)까지 목록에 보여준다
  const personalEvents = useMemo(
    () => (myEvents ?? []).filter((e) => e.team_id == null && e.status !== 'completed'),
    [myEvents],
  );

  const teams = teamsData?.teams ?? [];

  // 신규/미가입자에게는 소개를, 단골에게는 바로 액션을
  const isNewcomer = !isLoggedIn || teams.length === 0;

  const requireLoginThen = (path: string) =>
    isLoggedIn ? router.push(path) : router.push('/login?redirect=/chinba');

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="space-y-5 px-5 pt-6 pb-10">
        {/* 제목 카드 + 다가오는 일정 카드 (로그인 시) */}
        <div className="flex items-stretch gap-3">
        <header className="min-w-0 flex-1 rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-bold tracking-tight text-emerald-500">TIMELINE</span>
            <span className="h-1.5 w-1.5 rounded-full bg-blue-700" />
          </div>

          {!isAuthLoaded ? (
            <div className="mt-1 h-16" />
          ) : isNewcomer ? (
            <>
              <h1 className="mt-1 text-2xl font-extrabold leading-snug text-gray-900 break-keep">
                단톡방 투표 없이,
                <br />
                시간표로 바로 만나는 시간 찾기
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-gray-500 break-keep">
                동아리 정모, 조별과제, 스터디 시간을 가장 빠르게 맞춰요.
              </p>
            </>
          ) : (
            <h1 className="mt-1 text-2xl font-extrabold leading-snug text-gray-900 break-keep">
              단톡방 투표 없이,
              <br />
              시간표로 바로 만나는 시간 찾기
            </h1>
          )}

          {typeof stats?.total_teams === 'number' && (
            <p className="mt-3 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
              {stats.total_teams.toLocaleString('ko-KR')}개의 동아리가 함께하고 있어요
            </p>
          )}
        </header>

        {/* 다가오는 일정 — 데스크톱 전용(모바일 홈에는 표시하지 않음).
            앱 폴더처럼 2×2 미니 타일: 일정 최대 3개는 각각 상세로, 남으면 +N이 MY로 이동 */}
        {isAuthLoaded && isLoggedIn && (
          <div className="hidden w-44 shrink-0 flex-col rounded-2xl bg-white p-3.5 shadow-sm md:flex">
            <button
              type="button"
              onClick={() => router.push('/chinba/my')}
              className="flex items-center gap-1 text-xs font-bold text-gray-900 transition active:scale-[0.98]"
            >
              <FiClock size={13} className="shrink-0 text-emerald-500" />
              다가오는 일정
            </button>
            {upcoming.length > 0 ? (
              <div className="mt-2 grid flex-1 grid-cols-2 gap-1.5">
                {upcoming.slice(0, 3).map(({ event, when }) => (
                  <button
                    key={event.event_id}
                    type="button"
                    onClick={() => router.push(`/chinba/event?id=${event.event_id}`)}
                    className="flex aspect-square flex-col rounded-lg bg-gray-50 p-1.5 text-left transition hover:bg-gray-100 active:scale-95"
                  >
                    <span className="line-clamp-2 text-[10px] font-semibold leading-tight text-gray-700 break-keep">
                      {event.title}
                    </span>
                    <span className="mt-auto text-[10px] font-semibold text-emerald-600">
                      {formatUpcomingDate(when)}
                    </span>
                  </button>
                ))}
                {upcoming.length > 3 ? (
                  <button
                    type="button"
                    onClick={() => router.push('/chinba/my')}
                    className="flex aspect-square items-center justify-center rounded-lg bg-gray-50 text-xs font-bold text-gray-500 transition hover:bg-gray-100 active:scale-95"
                  >
                    +{upcoming.length - 3}
                  </button>
                ) : (
                  Array.from({ length: 4 - upcoming.length }).map((_, i) => (
                    <div key={i} className="aspect-square rounded-lg bg-gray-50/60" />
                  ))
                )}
              </div>
            ) : (
              <p className="my-auto text-center text-[11px] leading-relaxed text-gray-400 break-keep">
                예정된 일정이 없어요
              </p>
            )}
          </div>
        )}
        </div>

        {/* 타임라인 동아리 선택 — 목록을 펼친 채로 + 만들기/참여 */}
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-gray-900">타임라인 동아리 선택</h2>
            <div className="flex shrink-0 gap-1.5">
              <button
                type="button"
                onClick={() => requireLoginThen('/chinba/team/join')}
                className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 active:scale-95"
              >
                초대코드
              </button>
              <button
                type="button"
                onClick={() => requireLoginThen('/chinba/team/create')}
                className="flex items-center gap-1 rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-800 active:scale-95"
              >
                <FiPlus size={13} />
                만들기
              </button>
            </div>
          </div>

          <div className="mt-3">
            {!isAuthLoaded || (isLoggedIn && isTeamsLoading) ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner size="sm" />
              </div>
            ) : !isLoggedIn ? (
              <p className="py-6 text-center text-xs text-gray-400 break-keep">
                로그인하면 내 동아리를 골라 바로 들어갈 수 있어요.
              </p>
            ) : teams.length === 0 ? (
              <p className="py-6 text-center text-xs text-gray-400 break-keep">
                아직 참여 중인 동아리가 없어요. 동아리를 만들거나 초대코드로 참여하세요.
              </p>
            ) : (
              <div className="space-y-2">
                {teams.map((team: TeamListItem) => (
                  <TeamCard
                    key={team.id}
                    team={team}
                    terminology="club"
                    onClick={() => router.push(`/chinba/team/detail?id=${team.id}`)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 동아리 없이 잡은 일정 — 동아리 선택 섹션과 같은 형태로 목록 노출 + 잡기 버튼 */}
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-gray-900">동아리 없이 잡은 일정</h2>
            <button
              type="button"
              onClick={() => router.push('/chinba/create')}
              className="flex shrink-0 items-center gap-1 rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-800 active:scale-95"
            >
              <FiPlus size={13} />
              일정 잡기
            </button>
          </div>

          <div className="mt-3">
            {!isAuthLoaded ? null : !isLoggedIn ? (
              <p className="py-6 text-center text-xs text-gray-400 break-keep">
                로그인하면 동아리 없이 잡은 일정을 모아볼 수 있어요.
              </p>
            ) : personalEvents.length === 0 ? (
              <p className="py-6 text-center text-xs text-gray-400 break-keep">
                동아리 없이 잡은 일정이 없어요. 링크 공유로 누구와도 시간을 맞출 수 있어요.
              </p>
            ) : (
              <div className="space-y-2">
                {personalEvents.map((event) => (
                  <ChinbaEventListItem
                    key={event.event_id}
                    event={event}
                    compact
                    onClick={() => router.push(`/chinba/event?id=${event.event_id}`)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 소개 모드일 때만: 친바가 하는 일 / 이럴 때 써요 */}
        {isAuthLoaded && isNewcomer && (
          <>
            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <FiGrid size={16} className="text-gray-500" />
                <h2 className="text-sm font-bold text-gray-900">타임라인이 하는 일</h2>
              </div>
              <div className="grid gap-2">
                {CONCEPTS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="flex gap-3 rounded-xl bg-gray-50 px-3 py-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-gray-700 shadow-sm">
                        <Icon size={17} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900">{item.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-gray-500 break-keep">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <FiCalendar size={16} className="text-gray-500" />
                <h2 className="text-sm font-bold text-gray-900">이럴 때 써요</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {USE_CASES.map((label) => (
                  <span
                    key={label}
                    className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
