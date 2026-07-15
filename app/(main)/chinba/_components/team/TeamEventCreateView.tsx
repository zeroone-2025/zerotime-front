'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FiPlus, FiXCircle } from 'react-icons/fi';

import Button from '@/_components/ui/Button';
import FullPageModal from '@/_components/layout/FullPageModal';
import { useCreateEventCategory, useEventCategories } from '@/_lib/hooks/useCategories';
import { useGroups, useGroupSets } from '@/_lib/hooks/useGroups';
import { useSmartBack } from '@/_lib/hooks/useSmartBack';
import { useTeamDetail } from '@/_lib/hooks/useTeam';
import { useCreateTeamEvent } from '@/_lib/hooks/useTeamEvents';
import { canEditTeam } from '@/_lib/utils/teamPermissions';
import DateSelector from '@/(main)/chinba/create/_components/DateSelector';

export default function TeamEventCreateView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const teamId = Number(searchParams.get('id'));
  const preSetId = searchParams.get('setId') ? Number(searchParams.get('setId')) : null;
  const preGroupId = searchParams.get('groupId') ? Number(searchParams.get('groupId')) : null;
  const preCategoryIdRaw = searchParams.get('categoryId');
  const preCategoryId =
    preCategoryIdRaw && Number.isFinite(Number(preCategoryIdRaw)) ? Number(preCategoryIdRaw) : null;
  const goBack = useSmartBack(`/chinba/team/detail?id=${teamId}&tab=mannaja`);

  const { data: groupsData } = useGroups(teamId);
  const { data: groupSetsData } = useGroupSets(teamId);
  const { data: team } = useTeamDetail(teamId || undefined);
  const { data: categoriesData } = useEventCategories(teamId || undefined);
  const createEvent = useCreateTeamEvent(teamId);
  const createCategory = useCreateEventCategory(teamId);

  const categories = categoriesData?.categories ?? [];
  const canManageCategory = team ? canEditTeam(team.my_role) : false;

  const allGroups = groupsData?.groups ?? [];
  const groupSets = groupSetsData?.group_sets ?? [];
  const preSetName = preSetId ? groupSets.find((s) => s.id === preSetId)?.name : null;

  // 필터에서 넘어온 setId에 따라 보여줄 그룹 필터링
  // preSetId 없으면(전체): 빈 배열 → 조 선택 UI 숨김
  // preSetId 있으면: 해당 세트의 조만 표시
  const visibleGroups = useMemo(() => {
    if (!preSetId) return [];
    const set = groupSets.find((s) => s.id === preSetId);
    if (set) {
      const setGroupIds = new Set(set.groups.map((g) => g.id));
      return allGroups.filter((g) => setGroupIds.has(g.id));
    }
    return [];
  }, [allGroups, groupSets, preSetId]);

  const hasGroups = visibleGroups.length > 0;

  const [title, setTitle] = useState('');
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(preCategoryId);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddError, setQuickAddError] = useState<string | null>(null);
  const [preselected, setPreselected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 필터에서 특정 조가 선택된 경우만 미리 선택
  // preGroupId 있으면: 해당 조 1개만 선택
  // preSetId만 있고 preGroupId 없으면(조: 전체): 아무것도 선택 안 함
  useEffect(() => {
    if (preselected || visibleGroups.length === 0) return;
    if (preGroupId) {
      setSelectedGroupIds([preGroupId]);
    }
    setPreselected(true);
  }, [visibleGroups, preGroupId, preselected]);

  const canSubmit = title.trim().length > 0 && selectedDates.length > 0 && !createEvent.isPending;

  const toggleGroup = (groupId: number) => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  };

  const handleQuickAdd = async () => {
    const name = quickAddName.trim();
    if (!name) return;
    try {
      const created = await createCategory.mutateAsync({ name });
      setSelectedCategoryId(created.id);
      setQuickAddName('');
      setShowQuickAdd(false);
      setQuickAddError(null);
    } catch (err: any) {
      setQuickAddError(err.response?.data?.detail || '카테고리 추가에 실패했습니다');
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError(null);

    try {
      await createEvent.mutateAsync({
        title: title.trim(),
        dates: selectedDates,
        target_group_ids: selectedGroupIds.length > 0 ? selectedGroupIds : undefined,
        category_id: selectedCategoryId ?? undefined,
      });
      router.replace(`/chinba/team/detail?id=${teamId}&tab=mannaja`);
    } catch (err: any) {
      setError(err.response?.data?.detail || '이벤트 생성에 실패했습니다');
    }
  };

  return (
    <FullPageModal isOpen={true} onClose={goBack} title="동아리 친바 만들기">
      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* 전체 동아리 대상 안내 (그룹세트 미선택) */}
        {!preSetId && (
          <div className="mb-6 rounded-xl bg-gray-50 px-4 py-3">
            <p className="text-sm text-gray-500">
              전체 동아리 대상으로 생성됩니다
            </p>
          </div>
        )}

        {/* Target group selection */}
        {hasGroups && (
          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2">
              대상 조 선택
              {preSetId && groupSets.find((s) => s.id === preSetId) && (
                <span className="ml-1 text-xs font-normal text-gray-400">
                  — {groupSets.find((s) => s.id === preSetId)!.name}
                </span>
              )}
            </label>
            <p className="text-xs text-gray-400 mb-3">
              여러 조를 선택하면 합동 일정도 잡을 수 있어요
            </p>
            <div className="grid grid-cols-3 gap-2">
              {visibleGroups.map((group) => {
                const isSelected = selectedGroupIds.includes(group.id);
                return (
                  <button
                    key={group.id}
                    onClick={() => toggleGroup(group.id)}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                      isSelected
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {preSetName ? `${preSetName} - ${group.name}` : group.name}
                  </button>
                );
              })}
            </div>
            {selectedGroupIds.length === 0 && (
              <p className="mt-2 text-[11px] text-gray-400">
                선택하지 않으면 전체 동아리 대상으로 생성됩니다
              </p>
            )}
          </div>
        )}

        {/* Category */}
        {(categories.length > 0 || canManageCategory) && (
          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2">
              카테고리 <span className="text-xs font-normal text-gray-400">(선택)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => {
                const isSelected = selectedCategoryId === category.id;
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setSelectedCategoryId(isSelected ? null : category.id)}
                    className={`rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
                      isSelected
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {category.name}
                  </button>
                );
              })}
              {canManageCategory && !showQuickAdd && (
                <button
                  type="button"
                  onClick={() => setShowQuickAdd(true)}
                  className="flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-400 transition-colors hover:border-gray-400 hover:text-gray-500"
                >
                  <FiPlus size={14} />
                  카테고리 추가
                </button>
              )}
            </div>
            {showQuickAdd && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="text"
                  value={quickAddName}
                  maxLength={30}
                  autoFocus
                  placeholder="카테고리 이름"
                  onChange={(e) => setQuickAddName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleQuickAdd();
                    if (e.key === 'Escape') {
                      setShowQuickAdd(false);
                      setQuickAddName('');
                      setQuickAddError(null);
                    }
                  }}
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-gray-900"
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowQuickAdd(false);
                    setQuickAddName('');
                    setQuickAddError(null);
                  }}
                  className="rounded-lg px-3 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleQuickAdd}
                  disabled={createCategory.isPending || !quickAddName.trim()}
                  className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
                >
                  추가
                </button>
              </div>
            )}
            {quickAddError && <p className="mt-1 text-xs text-red-500">{quickAddError}</p>}
          </div>
        )}

        {/* Title */}
        <div className="mb-6">
          <label className="block text-sm font-bold text-gray-700 mb-2">
            모임 이름
          </label>
          <div className="relative">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 조별과제 회의, 동아리 정기모임"
              maxLength={100}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 pr-10 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-gray-900 transition-colors"
            />
            {title.length > 0 && (
              <button
                type="button"
                onClick={() => setTitle('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
              >
                <FiXCircle size={18} />
              </button>
            )}
          </div>
          <p className="mt-1 text-[11px] text-gray-400 text-right">{title.length}/100</p>
        </div>

        {/* Date selector */}
        <div className="mb-6">
          <label className="block text-sm font-bold text-gray-700 mb-2">
            날짜 선택
          </label>
          <p className="text-xs text-gray-400 mb-3">
            후보 날짜를 클릭하거나 드래그하여 선택하세요
          </p>
          <div className="rounded-xl border border-gray-200 p-4">
            <DateSelector selectedDates={selectedDates} onChange={setSelectedDates} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 py-3 pb-safe border-t border-gray-100">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="mb-2"
        >
          {createEvent.isPending ? '만드는 중...' : '만들기'}
        </Button>
      </div>
    </FullPageModal>
  );
}
