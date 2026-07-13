'use client';

import { useState, useMemo, useEffect } from 'react';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { LuPlus, LuClock, LuCalendar, LuTrash2, LuPencil } from 'react-icons/lu';

import LoadingSpinner from '@/_components/ui/LoadingSpinner';
import {
  useActivities,
  useCreateActivity,
  useUpdateActivity,
  useDeleteActivity,
} from '@/_lib/hooks/useActivities';
import { useGroups, useGroupSets } from '@/_lib/hooks/useGroups';
import { getRoleBadgeLabel, buildGroupSetNameMap, groupDisplayName } from '@/_lib/utils/teamDisplay';
import type { TeamRole, Activity, ActivityCreateRequest } from '@/_types/team';

interface ActivityTabProps {
  teamId: number;
  myRole: TeamRole;
  selectedSetId?: number | null;
  selectedGroupId?: number | null;
  terminology?: 'team' | 'club';
}

export default function ActivityTab({
  teamId,
  myRole,
  selectedSetId,
  selectedGroupId,
  terminology = 'team',
}: ActivityTabProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const { data, isLoading } = useActivities(teamId);
  const { data: groupsData } = useGroups(teamId);
  const createMutation = useCreateActivity(teamId);
  const updateMutation = useUpdateActivity(teamId);
  const deleteMutation = useDeleteActivity(teamId);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<ActivityCreateRequest>({
    title: '',
    activity_date: new Date().toISOString().slice(0, 10),
  });
  const [formScores, setFormScores] = useState<{ group_id: number; score: number }[]>([]);

  const hasRole = myRole === 'captain' || myRole === 'executive';
  const isGroupSelected = selectedGroupId !== null && selectedGroupId !== undefined;
  const canRecord = hasRole && isGroupSelected;
  const canDelete = hasRole;
  const canEdit = hasRole;
  const isEditing = editingId !== null;

  const { data: groupSetsData } = useGroupSets(teamId);
  const groupSets = groupSetsData?.group_sets ?? [];
  const groupSetNameMap = useMemo(() => buildGroupSetNameMap(groupSets), [groupSets]);

  // 선택된 세트의 group_id 집합
  const selectedGroupIds = useMemo(() => {
    if (!selectedSetId) return null;
    const set = groupSets.find((s) => s.id === selectedSetId);
    if (!set) return null;
    return new Set(set.groups.map((g) => g.id));
  }, [selectedSetId, groupSets]);

  // 조별 점수 입력 시 보여줄 그룹 필터링
  const visibleGroups = useMemo(() => {
    const allGroups = groupsData?.groups ?? [];
    if (selectedGroupId) return allGroups.filter((g) => g.id === selectedGroupId);
    if (selectedGroupIds) return allGroups.filter((g) => selectedGroupIds.has(g.id));
    return allGroups;
  }, [groupsData, selectedGroupId, selectedGroupIds]);

  // 조 선택 해제 시 폼 닫기
  useEffect(() => {
    setShowForm(false);
    setEditingId(null);
  }, [selectedGroupId]);

  // 일정 완료 처리에서 넘어온 경우: 활동 기록 폼을 완료된 일정 정보로 미리 채워 자동 오픈.
  // (URL의 recordTitle/recordDate 파라미터를 1회 소비하고 즉시 제거해 재오픈 방지)
  useEffect(() => {
    const recordTitle = searchParams.get('recordTitle');
    if (recordTitle === null) return;

    if (hasRole) {
      const recordDate = searchParams.get('recordDate');
      setEditingId(null);
      setFormData({
        title: recordTitle,
        activity_date: recordDate || new Date().toISOString().slice(0, 10),
      });
      setFormScores([]);
      setShowForm(true);
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete('recordTitle');
    params.delete('recordDate');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // 활동 필터링
  const allActivities = data?.activities ?? [];
  const activities = useMemo(() => {
    if (!selectedGroupIds && !selectedGroupId) return allActivities;
    return allActivities.filter((a) => {
      if (a.scores.length === 0) return true;
      if (selectedGroupId) return a.scores.some((s) => s.group_id === selectedGroupId);
      if (selectedGroupIds) return a.scores.some((s) => selectedGroupIds.has(s.group_id));
      return true;
    });
  }, [allActivities, selectedGroupIds, selectedGroupId]);

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ title: '', activity_date: new Date().toISOString().slice(0, 10) });
    setFormScores([]);
  };

  const handleEdit = (activity: Activity) => {
    setEditingId(activity.id);
    setFormData({
      title: activity.title,
      activity_date: activity.activity_date,
      start_time: activity.start_time ?? undefined,
      end_time: activity.end_time ?? undefined,
      description: activity.description ?? undefined,
      highlight: activity.highlight ?? undefined,
    });
    // 화면에 보이지 않는 조의 점수도 유지해야 하므로 전체 점수를 그대로 담는다
    // (수정 요청의 scores는 기존 점수를 통째로 대체한다)
    setFormScores(activity.scores.map((s) => ({ group_id: s.group_id, score: s.score })));
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) return;
    try {
      if (editingId !== null) {
        await updateMutation.mutateAsync({
          activityId: editingId,
          data: {
            ...formData,
            // 비워둔 항목은 빈 문자열로 보내야 서버에서 지워진다 (undefined는 기존 값 유지)
            description: formData.description ?? '',
            highlight: formData.highlight ?? '',
            start_time: formData.start_time ?? '',
            end_time: formData.end_time ?? '',
            scores: formScores,
          },
        });
      } else {
        await createMutation.mutateAsync({
          ...formData,
          scores: formScores.length > 0 ? formScores : undefined,
        });
      }
      closeForm();
    } catch {
      // error handled by mutation
    }
  };

  const handleDelete = async (activityId: number) => {
    if (!confirm('활동 기록을 삭제하시겠습니까?')) return;
    try {
      await deleteMutation.mutateAsync(activityId);
      if (editingId === activityId) closeForm();
    } catch {
      // error handled by mutation
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Create Button */}
      {canRecord && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-3 text-sm font-medium text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-700"
        >
          <LuPlus size={16} />
          활동 기록하기
        </button>
      )}

      {/* 조 미선택 안내 */}
      {hasRole && !isGroupSelected && !showForm && (
        <p className="text-center text-xs text-gray-400 py-2">
          조를 선택하면 활동을 기록할 수 있습니다
        </p>
      )}

      {/* Create / Edit Form */}
      {showForm && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
          <p className="text-xs font-medium text-gray-500">
            {isEditing ? '활동 기록 수정' : '활동 기록하기'}
          </p>
          <input
            type="text"
            placeholder="활동 제목"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
            maxLength={100}
          />
          <input
            type="date"
            value={formData.activity_date}
            onChange={(e) => setFormData({ ...formData, activity_date: e.target.value })}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
          />
          <div className="flex gap-2">
            <input
              type="time"
              placeholder="시작"
              value={formData.start_time ?? ''}
              onChange={(e) => setFormData({ ...formData, start_time: e.target.value || undefined })}
              className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
            />
            <input
              type="time"
              placeholder="종료"
              value={formData.end_time ?? ''}
              onChange={(e) => setFormData({ ...formData, end_time: e.target.value || undefined })}
              className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
            />
          </div>
          <textarea
            placeholder="활동 설명 (선택)"
            value={formData.description ?? ''}
            onChange={(e) => setFormData({ ...formData, description: e.target.value || undefined })}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none resize-none"
            rows={2}
          />
          <input
            type="text"
            placeholder="하이라이트 (선택)"
            value={formData.highlight ?? ''}
            onChange={(e) => setFormData({ ...formData, highlight: e.target.value || undefined })}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
          />

          {/* Group Scores */}
          {visibleGroups.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500">조별 점수</p>
              {visibleGroups.map((group) => {
                const existing = formScores.find((s) => s.group_id === group.id);
                return (
                  <div key={group.id} className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 shrink-0">{groupDisplayName(group.name, group.id, groupSetNameMap)}</span>
                    <input
                      type="number"
                      min={0}
                      value={existing?.score ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '') {
                          setFormScores(formScores.filter((s) => s.group_id !== group.id));
                        } else {
                          const score = parseInt(val, 10);
                          setFormScores(
                            existing
                              ? formScores.map((s) =>
                                  s.group_id === group.id ? { ...s, score } : s,
                                )
                              : [...formScores, { group_id: group.id, score }],
                          );
                        }
                      }}
                      className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:border-gray-400 focus:outline-none"
                      placeholder="점수"
                    />
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={closeForm}
              className="flex-1 rounded-lg bg-gray-200 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-300"
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              disabled={
                !formData.title.trim() || createMutation.isPending || updateMutation.isPending
              }
              className="flex-1 rounded-lg bg-gray-900 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
            >
              {isEditing
                ? updateMutation.isPending
                  ? '수정 중...'
                  : '수정하기'
                : createMutation.isPending
                  ? '기록 중...'
                  : '기록하기'}
            </button>
          </div>
        </div>
      )}

      {/* Activity List */}
      {activities.length === 0 && !showForm ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gray-50">
            <span className="text-2xl">{'\uD83D\uDCDD'}</span>
          </div>
          <p className="text-sm font-medium text-gray-500 mb-1">아직 활동 기록이 없습니다</p>
          <p className="text-xs text-gray-400 text-center">
            {terminology === 'club' ? '동아리 활동을 기록하고 공유하세요' : '팀 활동을 기록하고 공유하세요'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((activity: Activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              canEdit={canEdit}
              canDelete={canDelete}
              isEditing={editingId === activity.id}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}


function ActivityCard({
  activity,
  canEdit,
  canDelete,
  isEditing,
  onEdit,
  onDelete,
}: {
  activity: Activity;
  canEdit: boolean;
  canDelete: boolean;
  isEditing: boolean;
  onEdit: (activity: Activity) => void;
  onDelete: (id: number) => void;
}) {
  const timeStr =
    activity.start_time && activity.end_time
      ? `${activity.start_time} - ${activity.end_time}`
      : activity.start_time ?? '';

  return (
    <div
      className={`rounded-xl border bg-white p-4 transition-shadow hover:shadow-sm ${
        isEditing ? 'border-gray-400' : 'border-gray-100'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-800 truncate">{activity.title}</h3>
          <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <LuCalendar size={12} />
              {activity.activity_date}
            </span>
            {timeStr && (
              <span className="flex items-center gap-1">
                <LuClock size={12} />
                {timeStr}
              </span>
            )}
          </div>
        </div>
        <div className="ml-2 flex shrink-0 items-center gap-0.5">
          {canEdit && (
            <button
              onClick={() => onEdit(activity)}
              className="rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-gray-100 hover:text-gray-600"
              aria-label="수정"
              title="수정"
            >
              <LuPencil size={14} />
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => onDelete(activity.id)}
              className="rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-400"
              aria-label="삭제"
            >
              <LuTrash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Highlight */}
      {activity.highlight && (
        <p className="mt-2 text-xs text-gray-500 bg-yellow-50 rounded-lg px-2.5 py-1.5 border border-yellow-100">
          {activity.highlight}
        </p>
      )}

      {/* Description */}
      {activity.description && (
        <p className="mt-2 text-xs text-gray-500 line-clamp-2">{activity.description}</p>
      )}

      {/* Scores */}
      {activity.scores.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {activity.scores.map((score) => (
            <span
              key={score.group_id}
              className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2.5 py-1 text-xs"
            >
              <span className="font-medium text-gray-600">{score.group_name}</span>
              <span className="text-gray-900 font-bold">{score.score}</span>
            </span>
          ))}
        </div>
      )}

      {/* Recorder */}
      <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-400">
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
          {getRoleBadgeLabel(activity.recorder.role_badge)}
        </span>
        <span>{activity.recorder.nickname ?? '알 수 없음'}</span>
      </div>
    </div>
  );
}
