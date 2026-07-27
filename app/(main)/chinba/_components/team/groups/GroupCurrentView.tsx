'use client';

import LoadingSpinner from '@/_components/ui/LoadingSpinner';
import Button from '@/_components/ui/Button';
import { useGroups } from '@/_lib/hooks/useGroups';
import type { GroupSet } from '@/_types/team';

interface GroupCurrentViewProps {
  teamId: number;
  groupSets?: GroupSet[];
  onRecompose: (setId?: number) => void;
  onEdit?: (setId?: number) => void;
}

export default function GroupCurrentView({ teamId, groupSets = [], onRecompose, onEdit }: GroupCurrentViewProps) {
  const { data, isLoading } = useGroups(teamId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner />
      </div>
    );
  }

  const groups = data?.groups ?? [];
  const unassigned = data?.unassigned_members ?? [];

  // 그룹세트가 있으면 세트별로 구분
  const hasGroupSets = groupSets.length > 0;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <h3 className="text-sm font-bold text-gray-800">현재 조 편성</h3>

        {hasGroupSets ? (
          // 그룹세트별로 구분 표시
          groupSets.map((gs) => (
            <div key={gs.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-gray-700">{gs.name}</h4>
                <div className="flex items-center gap-2">
                  {onEdit && gs.groups.length > 0 && (
                    <button
                      onClick={() => onEdit(gs.id)}
                      className="text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      수정
                    </button>
                  )}
                  <button
                    onClick={() => onRecompose(gs.id)}
                    className="text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    재편성
                  </button>
                </div>
              </div>
              {gs.groups.length === 0 ? (
                <p className="text-xs text-gray-400 pl-1">아직 조가 없습니다</p>
              ) : (
                gs.groups.map((group) => (
                  <div key={group.id} className="rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-bold text-gray-800">{gs.name} - {group.name}</h4>
                      <span className="text-xs text-gray-400">{group.member_count}명</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {group.leader && (
                        <span className="rounded-full bg-gray-900 text-white px-2.5 py-1 text-xs font-medium">
                          {group.leader.nickname} (조장)
                        </span>
                      )}
                      {group.members
                        ?.filter((m) => !m.is_leader)
                        .map((m) => (
                          <span
                            key={m.member_id}
                            className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700"
                          >
                            {m.nickname}
                          </span>
                        ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          ))
        ) : (
          // 기존 flat 표시
          groups.map((group) => (
            <div key={group.id} className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold text-gray-800">{group.name}</h4>
                <span className="text-xs text-gray-400">{group.member_count}명</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {group.leader && (
                  <span className="rounded-full bg-gray-900 text-white px-2.5 py-1 text-xs font-medium">
                    {group.leader.nickname} (조장)
                  </span>
                )}
                {group.members
                  ?.filter((m) => !m.is_leader)
                  .map((m) => (
                    <span
                      key={m.member_id}
                      className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700"
                    >
                      {m.nickname}
                    </span>
                  ))}
              </div>
            </div>
          ))
        )}

        {unassigned.length > 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 p-4">
            <h4 className="text-xs font-medium text-gray-500 mb-2">미배정 멤버</h4>
            <div className="flex flex-wrap gap-1.5">
              {unassigned.map((m) => (
                <span
                  key={m.member_id}
                  className="rounded-full bg-gray-50 px-2.5 py-1 text-xs text-gray-500"
                >
                  {m.nickname}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {hasGroupSets ? (
        <div className="shrink-0 px-4 py-3 pb-safe border-t border-gray-100">
          <Button variant="primary" size="md" onClick={() => onRecompose()} className="w-full">
            새 그룹세트 추가
          </Button>
        </div>
      ) : (
        <div className="shrink-0 px-4 py-3 pb-safe border-t border-gray-100 flex gap-2">
          {onEdit && groups.length > 0 && (
            <Button variant="secondary" size="md" onClick={() => onEdit()} className="flex-1">
              수정하기
            </Button>
          )}
          <Button variant="primary" size="md" onClick={() => onRecompose()} className="flex-1">
            재편성하기
          </Button>
        </div>
      )}
    </div>
  );
}
