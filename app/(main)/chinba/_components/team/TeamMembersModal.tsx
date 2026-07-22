'use client';

import { useEffect, useMemo, useState } from 'react';

import { FiX, FiSearch, FiUsers } from 'react-icons/fi';

import MemberList from '@/(main)/teams/_components/MemberList';
import ConfirmModal from '@/_components/ui/ConfirmModal';
import LoadingSpinner from '@/_components/ui/LoadingSpinner';
import { useToast } from '@/_context/ToastContext';
import {
  useTeamMembers,
  useChangeRole,
  useRemoveMember,
} from '@/_lib/hooks/useTeam';
import { canChangeRole } from '@/_lib/utils/teamPermissions';
import type { TeamRole } from '@/_types/team';

interface TeamMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: number;
  myRole: TeamRole;
}

/**
 * 가운데 뜨는 멤버 관리 모달.
 * 설정 페이지로 이동하지 않고 동아리 상세 화면에서 바로 멤버·권한을 다룬다.
 * 권한 변경/내보내기 로직은 설정 페이지와 동일한 훅(useChangeRole/useRemoveMember)을 재사용.
 */
export default function TeamMembersModal({ isOpen, onClose, teamId, myRole }: TeamMembersModalProps) {
  const { showToast } = useToast();
  const { data: membersData, isLoading } = useTeamMembers(isOpen ? teamId : undefined);
  const changeRole = useChangeRole(teamId);
  const removeMember = useRemoveMember(teamId);

  const [query, setQuery] = useState('');
  const [removeTargetId, setRemoveTargetId] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const members = membersData?.members ?? [];
  const filtered = useMemo(() => {
    const list = membersData?.members ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((m) => (m.nickname ?? '').toLowerCase().includes(q));
  }, [membersData, query]);

  if (!isOpen) return null;

  const handleChangeRole = async (memberId: number, role: TeamRole) => {
    try {
      await changeRole.mutateAsync({ memberId, role });
      showToast('역할이 변경되었습니다', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.detail || '역할 변경에 실패했습니다', 'error');
    }
  };

  const confirmRemove = async () => {
    if (removeTargetId === null) return;
    try {
      await removeMember.mutateAsync(removeTargetId);
      showToast('멤버를 내보냈습니다', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.detail || '내보내기에 실패했습니다', 'error');
    }
    setRemoveTargetId(null);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        onClick={onClose}
      >
        <div
          className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
              <FiUsers size={18} className="text-gray-500" />
              멤버 관리
              <span className="text-xs font-normal text-gray-400">{members.length}명</span>
            </h2>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 active:scale-95"
              aria-label="닫기"
            >
              <FiX size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="flex min-h-0 flex-1 flex-col px-5 py-4">
            <div className="relative mb-3">
              <FiSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="이름 검색"
                className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-3 text-sm text-gray-800 outline-none transition-colors focus:border-gray-900"
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <LoadingSpinner size="sm" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-400">
                  {query ? '검색 결과가 없습니다' : '멤버가 없습니다'}
                </div>
              ) : (
                <MemberList
                  members={filtered}
                  myRole={myRole}
                  teamId={teamId}
                  terminology="club"
                  onChangeRole={handleChangeRole}
                  onRemoveMember={(memberId) => setRemoveTargetId(memberId)}
                />
              )}
            </div>

            {!canChangeRole(myRole) && (
              <p className="mt-3 border-t border-gray-100 pt-3 text-center text-xs text-gray-400">
                권한 변경·내보내기는 회장만 할 수 있습니다.
              </p>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={removeTargetId !== null}
        onConfirm={confirmRemove}
        onCancel={() => setRemoveTargetId(null)}
        title="멤버 내보내기"
        confirmLabel="내보내기"
        cancelLabel="취소"
        variant="danger"
      >
        <p>이 멤버를 동아리에서 내보내시겠습니까?</p>
      </ConfirmModal>
    </>
  );
}
