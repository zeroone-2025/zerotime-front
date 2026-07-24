'use client';

import { useRouter, usePathname } from 'next/navigation';

import { useCallback, useMemo } from 'react';

import type { IconType } from 'react-icons';
import { FiPlus, FiCalendar, FiUsers, FiLayers } from 'react-icons/fi';

import LoadingSpinner from '@/_components/ui/LoadingSpinner';
import { useGroupSets } from '@/_lib/hooks/useGroups';
import { useTeamEvents } from '@/_lib/hooks/useTeamEvents';
import { formatDateRanges } from '@/_lib/utils/dateRange';
import { buildGroupSetNameMap, groupDisplayName } from '@/_lib/utils/teamDisplay';
import type { TeamRole, TeamEvent } from '@/_types/team';

import TeamSetupGuide from './TeamSetupGuide';
interface MannajaTabProps {
  teamId: number;
  myRole: TeamRole;
  memberCount: number;
  inviteCode: string | null;
  selectedSetId?: number | null;
  selectedGroupId?: number | null;
  selectedCategoryId?: number | null;
  terminology?: 'team' | 'club';
}

export default function MannajaTab({
  teamId,
  myRole,
  memberCount,
  inviteCode,
  selectedSetId,
  selectedGroupId,
  selectedCategoryId,
  terminology = 'team',
}: MannajaTabProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data, isLoading } = useTeamEvents(teamId);
  const { data: groupSetsData } = useGroupSets(teamId);

  // 이벤트 상세로 이동하면서, 완료 처리 후 돌아올 "기록(뭐했니)" 탭 경로를 넘긴다.
  // 현재 위치(pathname)를 그대로 쓰므로 /teams/detail·/chinba/team/detail 어디서든 동작.
  const openEvent = useCallback(
    (eventId: string) => {
      const returnTo = encodeURIComponent(`${pathname}?id=${teamId}&tab=mwoheni`);
      router.push(`/chinba/event?id=${eventId}&returnTo=${returnTo}`);
    },
    [router, pathname, teamId],
  );

  const canCreate = myRole === 'captain' || myRole === 'executive';
  const groupSets = groupSetsData?.group_sets ?? [];
  const groupSetNameMap = useMemo(() => buildGroupSetNameMap(groupSets), [groupSets]);

  // 선택된 세트에 속하는 group_id 집합
  const selectedGroupIds = useMemo(() => {
    if (!selectedSetId) return null;
    const set = groupSets.find((s) => s.id === selectedSetId);
    if (!set) return null;
    return new Set(set.groups.map((g) => g.id));
  }, [selectedSetId, groupSets]);

  // 이벤트 필터링
  const allEvents = data?.events ?? [];
  const events = useMemo(() => {
    let list = allEvents;
    if (selectedCategoryId) {
      list = list.filter((event) => event.category?.id === selectedCategoryId);
    }
    if (!selectedGroupIds && !selectedGroupId) return list;
    return list.filter((event) => {
      if (event.target_groups.length === 0) return false;
      if (selectedGroupId) {
        return event.target_groups.some((g) => g.id === selectedGroupId);
      }
      if (selectedGroupIds) {
        return event.target_groups.some((g) => selectedGroupIds.has(g.id));
      }
      return true;
    });
  }, [allEvents, selectedGroupIds, selectedGroupId, selectedCategoryId]);

  // 팀 전체 / 조별 이벤트 분리
  const { teamWideEvents, groupEvents } = useMemo(() => {
    const teamWide: TeamEvent[] = [];
    const group: TeamEvent[] = [];
    for (const event of events) {
      if (event.target_groups.length === 0) {
        teamWide.push(event);
      } else {
        group.push(event);
      }
    }
    return { teamWideEvents: teamWide, groupEvents: group };
  }, [events]);

  const hasGroups = groupSets.length > 0;
  const isFilterActive = !!selectedSetId || !!selectedGroupId;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 팀 셋업 가이드 (captain/executive만) */}
      {canCreate && (!hasGroups || memberCount <= 1) && (
        <TeamSetupGuide
          teamId={teamId}
          memberCount={memberCount}
          inviteCode={inviteCode}
          hasGroups={hasGroups}
          terminology={terminology}
        />
      )}

      {/* Create button for captain/executive */}
      {canCreate && (
        <button
          onClick={() => {
            const params = new URLSearchParams({ id: String(teamId) });
            if (selectedSetId) params.set('setId', String(selectedSetId));
            if (selectedGroupId) params.set('groupId', String(selectedGroupId));
            if (selectedCategoryId) params.set('categoryId', String(selectedCategoryId));
            router.push(`/chinba/team/event-create?${params.toString()}`);
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-4 text-sm font-medium text-gray-400 transition-colors hover:border-gray-300 hover:text-gray-500 active:scale-[0.98]"
        >
          <FiPlus size={18} />
          <span>{terminology === 'club' ? '동아리 친바 만들기' : '팀 친바 만들기'}</span>
        </button>
      )}

      {hasGroups ? (
        /* 섹션 분리 레이아웃 */
        <>
          {!isFilterActive && (
            <>
              <SectionHeader icon={FiUsers} label={terminology === 'club' ? '동아리 전체 일정' : '팀 전체 일정'} />
              {teamWideEvents.length > 0 ? (
                teamWideEvents.map((event) => (
                  <EventCard
                    key={event.event_id}
                    event={event}
                    groupSetNameMap={groupSetNameMap}
                    onClick={() => openEvent(event.event_id)}
                  />
                ))
              ) : (
                <SectionEmptyState message={terminology === 'club' ? '동아리 전체 일정이 없습니다' : '팀 전체 일정이 없습니다'} />
              )}
            </>
          )}

          {!isFilterActive && <SectionHeader icon={FiLayers} label="조별 일정" />}
          {groupEvents.length > 0 ? (
            groupEvents.map((event) => (
              <EventCard
                key={event.event_id}
                event={event}
                groupSetNameMap={groupSetNameMap}
                onClick={() => openEvent(event.event_id)}
              />
            ))
          ) : (
            <SectionEmptyState
              message="아직 조별 일정이 없습니다"
              submessage={canCreate ? '조별 일정을 만들어 보세요' : undefined}
            />
          )}
        </>
      ) : events.length === 0 ? (
        /* 기존 빈 상태 유지 */
        <div className="flex flex-col items-center justify-center py-16">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gray-50">
            <FiCalendar size={24} className="text-gray-300" />
          </div>
          <p className="text-sm font-medium text-gray-500 mb-1">아직 일정이 없습니다</p>
          <p className="text-xs text-gray-400 text-center">
            {canCreate
              ? '위의 버튼을 눌러 일정 조율을 시작하세요'
              : terminology === 'club'
                ? '회장 또는 운영진이 일정 조율을 생성할 수 있습니다'
                : '팀장 또는 임원이 일정 조율을 생성할 수 있습니다'}
          </p>
        </div>
      ) : (
        /* 플랫 리스트 (조 없을 때) */
        events.map((event) => (
          <EventCard
            key={event.event_id}
            event={event}
            groupSetNameMap={groupSetNameMap}
            onClick={() => openEvent(event.event_id)}
          />
        ))
      )}
    </div>
  );
}

function EventCard({ event, groupSetNameMap, onClick }: { event: TeamEvent; groupSetNameMap: Map<number, string>; onClick: () => void }) {
  const progressPercent =
    event.total_participants > 0
      ? Math.round((event.submitted_count / event.total_participants) * 100)
      : 0;

  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md active:scale-[0.98]"
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-sm font-bold text-gray-800 truncate flex-1">{event.title}</h3>
        <span
          className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
            event.status === 'active'
              ? 'bg-green-50 text-green-600'
              : event.status === 'completed'
                ? 'bg-blue-50 text-blue-600'
                : 'bg-gray-50 text-gray-400'
          }`}
        >
          {event.status === 'active' ? '진행 중' : event.status === 'completed' ? '완료' : '만료'}
        </span>
      </div>

      {/* Dates */}
      <div className="flex items-center gap-1.5 mb-2">
        <FiCalendar size={12} className="text-gray-400" />
        <p className="text-xs text-gray-500 truncate">
          {formatDateRanges(event.dates)}
        </p>
      </div>

      {/* Target groups - 항상 표시 */}
      <div className="flex flex-wrap gap-1 mb-2">
        {event.category && (
          <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-medium text-gray-500">
            #{event.category.name}
          </span>
        )}
        {event.target_groups.length > 0 ? (
          event.target_groups.map((g) => (
            <span
              key={g.id}
              className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600"
            >
              {groupDisplayName(g.name, g.id, groupSetNameMap)}
            </span>
          ))
        ) : (
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">
            전체
          </span>
        )}
      </div>

      {/* Participant progress */}
      <div className="flex items-center gap-2">
        <FiUsers size={12} className="text-gray-400" />
        <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-gray-800 transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <span className="text-[10px] font-medium text-gray-500">
          {event.submitted_count}/{event.total_participants}
        </span>
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, label }: { icon: IconType; label: string }) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <Icon size={14} className="text-gray-500" />
      <span className="text-xs font-semibold text-gray-500">{label}</span>
      <div className="flex-1 border-t border-gray-100" />
    </div>
  );
}

function SectionEmptyState({ message, submessage }: { message: string; submessage?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10">
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-gray-50">
        <FiCalendar size={18} className="text-gray-300" />
      </div>
      <p className="text-xs font-medium text-gray-400">{message}</p>
      {submessage && (
        <p className="text-[11px] text-gray-300 mt-0.5">{submessage}</p>
      )}
    </div>
  );
}
