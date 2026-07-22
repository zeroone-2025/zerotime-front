'use client';

import { useState } from 'react';

import { FiPlus } from 'react-icons/fi';

import ConfirmModal from '@/_components/ui/ConfirmModal';
import { useToast } from '@/_context/ToastContext';
import {
  useEventCategories,
  useCreateEventCategory,
  useUpdateEventCategory,
  useDeleteEventCategory,
} from '@/_lib/hooks/useCategories';

interface EventCategorySectionProps {
  teamId: number;
  canManage: boolean;
  /** 모달 등에 임베드될 때 자체 제목/외부 여백을 숨긴다 */
  embedded?: boolean;
}

export default function EventCategorySection({ teamId, canManage, embedded = false }: EventCategorySectionProps) {
  const { showToast } = useToast();
  const { data: categoriesData } = useEventCategories(teamId);
  const createCategory = useCreateEventCategory(teamId);
  const updateCategory = useUpdateEventCategory(teamId);
  const deleteCategoryMutation = useDeleteEventCategory(teamId);

  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const categories = categoriesData?.categories ?? [];
  const deleteTarget = categories.find((c) => c.id === deleteConfirmId);

  const handleAdd = async () => {
    const trimmed = addName.trim();
    if (!trimmed) {
      showToast('이름을 입력해주세요', 'error');
      return;
    }
    try {
      await createCategory.mutateAsync({ name: trimmed });
      showToast('카테고리가 추가되었습니다', 'success');
      setAddName('');
      setShowAdd(false);
    } catch (err: any) {
      showToast(err.response?.data?.detail || '카테고리 추가에 실패했습니다', 'error');
    }
  };

  const handleCancelAdd = () => {
    setShowAdd(false);
    setAddName('');
  };

  const handleStartEdit = (categoryId: number, currentName: string) => {
    setEditingId(categoryId);
    setEditName(currentName);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleSaveEdit = async () => {
    if (editingId === null) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      showToast('이름을 입력해주세요', 'error');
      return;
    }
    try {
      await updateCategory.mutateAsync({ categoryId: editingId, data: { name: trimmed } });
      showToast('이름이 변경되었습니다', 'success');
      handleCancelEdit();
    } catch (err: any) {
      showToast(err.response?.data?.detail || '이름 변경에 실패했습니다', 'error');
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmId === null) return;
    try {
      await deleteCategoryMutation.mutateAsync(deleteConfirmId);
      showToast('카테고리가 삭제되었습니다', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.detail || '삭제에 실패했습니다', 'error');
    }
    setDeleteConfirmId(null);
  };

  return (
    <section className={embedded ? 'p-4' : 'mb-6'}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {!embedded && <h2 className="text-sm font-bold text-gray-800">일정 카테고리</h2>}
          {categories.length > 0 && (
            <span className="text-xs text-gray-400">{categories.length}개</span>
          )}
        </div>
        {canManage && !showAdd && categories.length > 0 && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
          >
            <FiPlus size={14} />
            추가
          </button>
        )}
      </div>

      <div className="rounded-xl border border-gray-100 bg-white">
        {showAdd && (
          <div className="flex items-center gap-2 p-4 border-b border-gray-100">
            <input
              type="text"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              maxLength={30}
              autoFocus
              placeholder="카테고리 이름"
              className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-gray-900 transition-colors"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
                if (e.key === 'Escape') handleCancelAdd();
              }}
            />
            <button
              onClick={handleCancelAdd}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-50"
            >
              취소
            </button>
            <button
              onClick={handleAdd}
              disabled={createCategory.isPending}
              className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
            >
              추가
            </button>
          </div>
        )}

        {categories.length === 0 && !showAdd ? (
          <div className="flex flex-col items-center justify-center py-10">
            <p className="text-sm text-gray-400 mb-3">아직 카테고리가 없습니다</p>
            {canManage && (
              <button
                onClick={() => setShowAdd(true)}
                className="rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 active:scale-95"
              >
                카테고리 추가
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {categories.map((category) => (
              <div key={category.id} className="flex items-center justify-between gap-2 p-4">
                {editingId === category.id ? (
                  <>
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
                      disabled={updateCategory.isPending}
                      className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
                    >
                      저장
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-sm font-medium text-gray-800">#{category.name}</span>
                    {canManage && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleStartEdit(category.id, category.name)}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 transition-colors hover:bg-gray-50"
                        >
                          이름변경
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(category.id)}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-400 border border-red-100 transition-colors hover:bg-red-50"
                        >
                          삭제
                        </button>
                      </div>
                    )}
                  </>
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
        title="카테고리 삭제"
        confirmLabel="삭제"
        cancelLabel="취소"
        variant="danger"
      >
        <p>&ldquo;{deleteTarget?.name}&rdquo; 카테고리를 삭제하시겠습니까?</p>
        <p className="mt-1 text-xs text-gray-400">
          이 카테고리를 쓰는 일정·활동 기록에서는 카테고리만 해제되고 기록은 유지됩니다
        </p>
      </ConfirmModal>
    </section>
  );
}
