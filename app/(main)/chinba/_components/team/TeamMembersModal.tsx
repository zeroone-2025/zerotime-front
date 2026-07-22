'use client';

import { useMemo, useState } from 'react';

import { FiUser, FiUsers, FiSearch } from 'react-icons/fi';

import ConfirmModal from '@/_components/ui/ConfirmModal';
import LoadingSpinner from '@/_components/ui/LoadingSpinner';
import Modal from '@/_components/ui/Modal';
import { useToast } from '@/_context/ToastContext';
import { useGroupSets } from '@/_lib/hooks/useGroups';
import {
  useTeamMembers,
  useChangeRole,
  useRemoveMember,
} from '@/_lib/hooks/useTeam';
import { buildGroupSetNameMap, groupDisplayName } from '@/_lib/utils/teamDisplay';
import { canChangeRole, canRemoveMember } from '@/_lib/utils/teamPermissions';
import type { TeamMember, TeamRole } from '@/_types/team';

interface TeamMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: number;
  myRole: TeamRole;
}

const CLUB_ROLE_LABELS: Record<TeamRole, string> = {
  captain: '회장',
  executive: '운영진',
  member: '회원',
};

const ROLE_BADGE_STYLES: Record<TeamRole, string> = {
  captain: 'bg-red-100 text-red-700',
  executive: 'bg-blue-100 text-blue-700',
  member: 'bg-gray-100 text-gray-500',
};

// 지정 가능한 역할(회장은 위임 API 전용이라 제외)
const ASSIGNABLE_ROLES: TeamRole[] = ['member', 'executive'];

/**
 * 가운데 모달로 여는 멤버 관리. 목록만 보는 게 아니라 인라인으로 관리한다.
 * - 역할 변경: 회장만 조작(각 행 역할 드롭다운). 운영진에겐 읽기전용 배지.
 * - 내보내기: 서버 규칙(canRemoveMember)대로 회장/운영진에게 노출.
 * 훅(useChangeRole/useRemoveMember)은 설정 페이지와 동일하게 재사용.
 */
export default function TeamMembersModal({ isOpen, onClose, teamId, myRole }: TeamMembersModalProps) {
  const { showToast } = useToast();
  const { data: membersData, isLoading } = useTeamMembers(isOpen ? teamId : undefined);
  const { data: groupSetsData } = useGroupSets(isOpen ? teamId : undefined);
  const changeRole = useChangeRole(teamId);
  const removeMember = useRemoveMember(teamId);

  const [query, setQuery] = useState('');
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);

  const groupSetNameMap = useMemo(
    () => buildGroupSetNameMap(groupSetsData?.group_sets ?? []),
    [groupSetsData],
  );

  const members = membersData?.members ?? [];
  const filtered = useMemo(() => {
    const list = membersData?.members ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((m) => (m.nickname ?? '').toLowerCase().includes(q));
  }, [membersData, query]);

  const canEditRoles = canChangeRole(myRole);

  const handleChangeRole = async (memberId: number, role: TeamRole) => {
    try {
      await changeRole.mutateAsync({ memberId, role });
      showToast('역할이 변경되었습니다', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.detail || '역할 변경에 실패했습니다', 'error');
    }
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    try {
      await removeMember.mutateAsync(removeTarget.id);
      showToast('멤버를 내보냈습니다', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.detail || '내보내기에 실패했습니다', 'error');
    }
    setRemoveTarget(null);
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={
          <>
            멤버 관리
            <span className="text-xs font-normal text-gray-400">{members.length}명</span>
          </>
        }
        titleIcon={<FiUsers size={18} className="text-gray-500" />}
      >
        <div className="flex flex-col px-5 py-4">
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

          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <LoadingSpinner size="sm" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-400">
              {query ? '검색 결과가 없습니다' : '멤버가 없습니다'}
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((member) => {
                const roleEditable = canEditRoles && member.role !== 'captain';
                const removable = canRemoveMember(myRole, member.role);
                return (
                  <div key={member.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-gray-50">
                    {member.profile_image ? (
                      <img
                        src={member.profile_image}
                        alt={member.nickname || ''}
                        className="h-9 w-9 rounded-full border border-gray-100 object-cover"
                      />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-100 bg-gray-50 text-gray-400">
                        <FiUser size={16} />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-800">
                        {member.nickname || '사용자'}
                      </p>
                      {member.group && (
                        <p className="mt-0.5 truncate text-[11px] text-gray-400">
                          {groupDisplayName(member.group.name, member.group.id, groupSetNameMap)}
                          {member.group.is_leader && ' (조장)'}
                        </p>
                      )}
                    </div>

                    {roleEditable ? (
                      <select
                        value={member.role}
                        onChange={(e) => handleChangeRole(member.id, e.target.value as TeamRole)}
                        disabled={changeRole.isPending}
                        className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 outline-none transition-colors focus:border-gray-900 disabled:opacity-50"
                        aria-label={`${member.nickname || '멤버'} 역할`}
                      >
                        {ASSIGNABLE_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {CLUB_ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${ROLE_BADGE_STYLES[member.role]}`}>
                        {CLUB_ROLE_LABELS[member.role]}
                      </span>
                    )}

                    {removable && (
                      <button
                        onClick={() => setRemoveTarget(member)}
                        className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-50 hover:text-red-500"
                      >
                        내보내기
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!canEditRoles && (
            <p className="mt-3 border-t border-gray-100 pt-3 text-center text-xs text-gray-400">
              역할 변경은 회장만 할 수 있습니다.
            </p>
          )}
        </div>
      </Modal>

      <ConfirmModal
        isOpen={removeTarget !== null}
        onConfirm={confirmRemove}
        onCancel={() => setRemoveTarget(null)}
        title="멤버 내보내기"
        confirmLabel="내보내기"
        cancelLabel="취소"
        variant="danger"
      >
        <p>{removeTarget?.nickname || '이 멤버'}님을 동아리에서 내보내시겠습니까?</p>
      </ConfirmModal>
    </>
  );
}
