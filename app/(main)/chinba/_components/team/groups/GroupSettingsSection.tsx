'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';
import { FiPlus } from 'react-icons/fi';

import ConfirmModal from '@/_components/ui/ConfirmModal';
import { useToast } from '@/_context/ToastContext';
import { useGroupSets, useUpdateGroupSet, useDeleteGroupSet } from '@/_lib/hooks/useGroups';

interface GroupSettingsSectionProps {
  teamId: number;
  canManage: boolean;
  /** 모달 등에 임베드될 때 자체 제목/외부 여백을 숨긴다 */
  embedded?: boolean;
}

export default function GroupSettingsSection({ teamId, canManage, embedded = false }: GroupSettingsSectionProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const { data: groupSetsData } = useGroupSets(teamId);
  const updateGroupSet = useUpdateGroupSet(teamId);
  const deleteGroupSetMutation = useDeleteGroupSet(teamId);

  const [editingSetId, setEditingSetId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const groupSets = groupSetsData?.group_sets ?? [];
  const showActions = canManage;
  const deleteTarget = groupSets.find((s) => s.id === deleteConfirmId);

  const handleStartEdit = (setId: number, currentName: string) => {
    setEditingSetId(setId);
    setEditName(currentName);
  };

  const handleCancelEdit = () => {
    setEditingSetId(null);
    setEditName('');
  };

  const handleSaveEdit = async () => {
    if (editingSetId === null) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      showToast('이름을 입력해주세요', 'error');
      return;
    }
    try {
      await updateGroupSet.mutateAsync({ setId: editingSetId, data: { name: trimmed } });
      showToast('이름이 변경되었습니다', 'success');
      handleCancelEdit();
    } catch (err: any) {
      showToast(err.response?.data?.detail || '이름 변경에 실패했습니다', 'error');
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmId === null) return;
    try {
      await deleteGroupSetMutation.mutateAsync(deleteConfirmId);
      showToast('그룹이 삭제되었습니다', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.detail || '삭제에 실패했습니다', 'error');
    }
    setDeleteConfirmId(null);
  };

  const navigateToGroups = () => {
    router.push(`/chinba/team/groups?id=${teamId}`);
  };

  return (
    <section className={embedded ? 'p-4' : 'mb-6'}>
      <div className="flex items-center justify-between mb-3">
        {!embedded && <h2 className="text-sm font-bold text-gray-800">그룹/조 관리</h2>}
        {showActions && groupSets.length > 0 && (
          <button
            onClick={navigateToGroups}
            className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
          >
            <FiPlus size={14} />
            새 조 편성
          </button>
        )}
      </div>

      <div className="rounded-xl border border-gray-100 bg-white">
        {groupSets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10">
            <p className="text-sm text-gray-400 mb-3">아직 조가 편성되지 않았습니다</p>
            {showActions && (
              <button
                onClick={navigateToGroups}
                className="rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 active:scale-95"
              >
                조 편성하기
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {groupSets.map((set) => (
              <div key={set.id} className="p-4">
                {/* Set header */}
                {editingSetId === set.id ? (
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      maxLength={30}
                      autoFocus
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-gray-900 transition-colors"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit();
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                    />
                    <button
                      onClick={handleCancelEdit}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-50"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      disabled={updateGroupSet.isPending}
                      className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
                    >
                      저장
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-800">{set.name}</span>
                      <span className="text-xs text-gray-400">{set.group_count}개 조</span>
                    </div>
                  </div>
                )}

                {/* Group chips */}
                {set.groups.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {set.groups.map((group) => (
                      <span
                        key={group.id}
                        className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700"
                      >
                        {group.name}({group.member_count})
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 mb-3">아직 조가 없습니다</p>
                )}

                {/* Action buttons */}
                {showActions && editingSetId !== set.id && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleStartEdit(set.id, set.name)}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 transition-colors hover:bg-gray-50"
                    >
                      이름변경
                    </button>
                    {set.groups.length > 0 && (
                      <button
                        onClick={() => router.push(`/chinba/team/groups?id=${teamId}&mode=edit&setId=${set.id}`)}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 transition-colors hover:bg-gray-50"
                      >
                        조 수정
                      </button>
                    )}
                    <button
                      onClick={() => router.push(`/chinba/team/groups?id=${teamId}&mode=recompose&setId=${set.id}`)}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 transition-colors hover:bg-gray-50"
                    >
                      재편성
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(set.id)}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-400 border border-red-100 transition-colors hover:bg-red-50"
                    >
                      삭제
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirm Modal */}
      <ConfirmModal
        isOpen={deleteConfirmId !== null}
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirmId(null)}
        title="그룹 삭제"
        confirmLabel="삭제"
        cancelLabel="취소"
        variant="danger"
      >
        <p>&ldquo;{deleteTarget?.name}&rdquo; 그룹을 삭제하시겠습니까?</p>
        <p className="mt-1 text-xs text-gray-400">소속 조와 편성이 모두 삭제됩니다</p>
      </ConfirmModal>
    </section>
  );
}
