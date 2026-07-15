'use client';

import { useMemo } from 'react';

import { LuTrophy, LuUser, LuCalendar } from 'react-icons/lu';

import LoadingSpinner from '@/_components/ui/LoadingSpinner';
import { useActivities } from '@/_lib/hooks/useActivities';
import { useGroupSets } from '@/_lib/hooks/useGroups';
import { useRankings, useMyRanking } from '@/_lib/hooks/useRankings';
import { buildGroupSetNameMap, groupDisplayName } from '@/_lib/utils/teamDisplay';
import type { TeamRole, RankingItem, Activity } from '@/_types/team';

interface JababwaTabProps {
  teamId: number;
  myRole: TeamRole;
  selectedSetId?: number | null;
  selectedGroupId?: number | null;
  selectedCategoryId?: number | null;
}

export default function JababwaTab({ teamId, selectedSetId, selectedGroupId, selectedCategoryId }: JababwaTabProps) {
  const categoryParam = selectedCategoryId ?? undefined;
  const { data: rankingsData, isLoading: rankingsLoading } = useRankings(teamId, {
    period: 'semester',
    group_set_id: selectedSetId ?? undefined,
    category_id: categoryParam,
  });
  const { data: myRanking, isLoading: myRankingLoading } = useMyRanking(teamId, {
    group_set_id: selectedSetId ?? undefined,
    category_id: categoryParam,
  });
  const { data: activitiesData } = useActivities(teamId, { limit: 5, category_id: categoryParam });
  const { data: groupSetsData } = useGroupSets(teamId);
  const groupSetNameMap = useMemo(() => buildGroupSetNameMap(groupSetsData?.group_sets ?? []), [groupSetsData]);

  if (rankingsLoading || myRankingLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner />
      </div>
    );
  }

  const rankings = rankingsData?.rankings ?? [];
  const activities = activitiesData?.activities ?? [];
  const maxScore = rankings.length > 0 ? Math.max(...rankings.map((r) => r.total_score), 1) : 1;

  return (
    <div className="space-y-6">
      {/* Section 1: Ranking Board */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <LuTrophy size={16} className="text-yellow-500" />
          <h2 className="text-sm font-bold text-gray-800">
            조별 랭킹
          </h2>
        </div>

        {rankings.length === 0 ? (
          <div className="rounded-xl bg-gray-50 p-6 text-center">
            <p className="text-xs text-gray-400">아직 점수 데이터가 없습니다</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rankings.map((item) => (
              <RankingBar
                key={item.group_id}
                item={item}
                maxScore={maxScore}
                isSelected={selectedGroupId === item.group_id}
                groupSetNameMap={groupSetNameMap}
              />
            ))}
          </div>
        )}
      </section>

      {/* Section 2: Recent Activities Timeline */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <LuCalendar size={16} className="text-blue-500" />
          <h2 className="text-sm font-bold text-gray-800">
            최근 활동
          </h2>
        </div>

        {activities.length === 0 ? (
          <div className="rounded-xl bg-gray-50 p-6 text-center">
            <p className="text-xs text-gray-400">아직 활동 기록이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activities.map((activity: Activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 rounded-lg border border-gray-100 bg-white p-3"
              >
                <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-gray-300" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-700 truncate">{activity.title}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{activity.activity_date}</p>
                  {activity.scores.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {activity.scores.map((score) => (
                        <span
                          key={score.group_id}
                          className="inline-flex items-center gap-0.5 rounded-full bg-gray-50 px-2 py-0.5 text-[10px]"
                        >
                          <span className="text-gray-500">{groupDisplayName(score.group_name, score.group_id, groupSetNameMap)}</span>
                          <span className="font-bold text-gray-700">{score.score}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section 3: My Stats */}
      {myRanking && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <LuUser size={16} className="text-green-500" />
            <h2 className="text-sm font-bold text-gray-800">
              내 참여 현황
            </h2>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">닉네임</span>
              <span className="text-sm font-medium text-gray-800">
                {myRanking.nickname ?? '미설정'}
              </span>
            </div>

            {myRanking.group ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">소속 조</span>
                  <span className="text-sm font-medium text-gray-800">{groupDisplayName(myRanking.group.name, myRanking.group.id, groupSetNameMap)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">조 순위</span>
                  <span className="text-sm font-bold text-gray-800">
                    {myRanking.group.current_rank}위
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">조 총 점수</span>
                  <span className="text-sm font-bold text-gray-800">
                    {myRanking.group.total_score}점
                  </span>
                </div>
              </>
            ) : (
              <div className="text-center py-2">
                <p className="text-xs text-gray-400">아직 조에 배정되지 않았습니다</p>
              </div>
            )}

            <div className="border-t border-gray-100 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">내 참여 횟수</span>
                <span className="text-sm font-medium text-gray-800">
                  {myRanking.my_participation_count} / {myRanking.total_activities}
                </span>
              </div>
              {myRanking.total_activities > 0 && (
                <div className="mt-2">
                  <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-green-400 transition-all"
                      style={{
                        width: `${Math.min(
                          (myRanking.my_participation_count / myRanking.total_activities) * 100,
                          100,
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}


function RankingBar({ item, maxScore, isSelected, groupSetNameMap }: { item: RankingItem; maxScore: number; isSelected?: boolean; groupSetNameMap: Map<number, string> }) {
  const barWidth = maxScore > 0 ? Math.max((item.total_score / maxScore) * 100, 2) : 2;

  const rankColors: Record<number, string> = {
    1: 'bg-yellow-400',
    2: 'bg-gray-400',
    3: 'bg-amber-600',
  };
  const barColor = rankColors[item.rank] ?? 'bg-gray-300';

  const rankChangeIndicator = () => {
    if (item.rank_change > 0) return <span className="text-[10px] text-green-500 font-medium ml-1">{'\u2191'}{item.rank_change}</span>;
    if (item.rank_change < 0) return <span className="text-[10px] text-red-500 font-medium ml-1">{'\u2193'}{Math.abs(item.rank_change)}</span>;
    return null;
  };

  return (
    <div className={`rounded-lg border bg-white p-3 ${isSelected ? 'border-gray-900 ring-2 ring-gray-900' : 'border-gray-100'}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-400 w-5 text-center">{item.rank}</span>
          <span className="text-sm font-semibold text-gray-800">{groupDisplayName(item.group_name, item.group_id, groupSetNameMap)}</span>
          {rankChangeIndicator()}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{item.activity_count}회</span>
          <span className="text-sm font-bold text-gray-800">{item.total_score}점</span>
        </div>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor} transition-all duration-500`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
    </div>
  );
}
