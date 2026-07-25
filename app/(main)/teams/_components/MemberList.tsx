'use client';

import { useState, useMemo } from 'react';

import { FiUser, FiMoreVertical } from 'react-icons/fi';

import { useGroupSets } from '@/_lib/hooks/useGroups';
import { useUserStore } from '@/_lib/store/useUserStore';
import { getRoleBadgeLabel, getRoleBadgeColor, buildGroupSetNameMap, groupDisplayName, CLUB_ROLE_LABELS } from '@/_lib/utils/teamDisplay';
import { canRemoveMember, canChangeRoleOf } from '@/_lib/utils/teamPermissions';
import type { TeamMember, TeamRole } from '@/_types/team';

interface MemberListProps {
  members: TeamMember[];
  myRole: TeamRole;
  teamId?: number;
  onChangeRole?: (memberId: number, role: TeamRole) => void;
  onRemoveMember?: (memberId: number) => void;
  terminology?: 'team' | 'club';
}

const ROLE_BADGE_STYLES: Record<string, string> = {
  red: 'bg-red-100 text-red-700',
  orange: 'bg-orange-100 text-orange-700',
  blue: 'bg-blue-100 text-blue-700',
  gray: 'bg-gray-100 text-gray-500',
};

const ROLE_OPTIONS: { value: TeamRole; label: string }[] = [
  { value: 'captain', label: '팀장' },
  { value: 'vice_captain', label: '부팀장' },
  { value: 'executive', label: '임원' },
  { value: 'member', label: '팀원' },
];

export default function MemberList({
  members,
  myRole,
  teamId,
  onChangeRole,
  onRemoveMember,
  terminology = 'team',
}: MemberListProps) {
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const myUserId = useUserStore((state) => state.user?.id);
  const { data: groupSetsData } = useGroupSets(teamId);
  const groupSetNameMap = useMemo(() => buildGroupSetNameMap(groupSetsData?.group_sets ?? []), [groupSetsData]);

  const handleMenuToggle = (memberId: number) => {
    setOpenMenuId((prev) => (prev === memberId ? null : memberId));
  };

  return (
    <div className="space-y-1">
      {members.map((member) => {
        const roleColor = getRoleBadgeColor(member.role);
        const defaultRoleLabel = getRoleBadgeLabel(member.role);
        const roleLabel =
          terminology === 'club'
            ? CLUB_ROLE_LABELS[member.role]
            : defaultRoleLabel;
        const canRemove = canRemoveMember(myRole, member.role);
        // 본인 행 제외 — 역할만으로 게이트하면 부회장이 자기 행의 관리 메뉴를 보게 된다
        const isSelf = member.user_id === myUserId;

        return (
          <div
            key={member.id}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-gray-50 transition-colors"
          >
            {/* Avatar */}
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

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-gray-800 truncate">
                  {member.nickname || '사용자'}
                </span>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${ROLE_BADGE_STYLES[roleColor] || ROLE_BADGE_STYLES.gray}`}>
                  {roleLabel}
                </span>
              </div>
              {member.group && (
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {groupDisplayName(member.group.name, member.group.id, groupSetNameMap)}
                  {member.group.is_leader && ' (조장)'}
                </p>
              )}
            </div>

            {/* Actions */}
            {!isSelf && canChangeRoleOf(myRole, member.role) && (
              <div className="relative">
                <button
                  onClick={() => handleMenuToggle(member.id)}
                  className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 transition-colors"
                >
                  <FiMoreVertical size={16} />
                </button>

                {openMenuId === member.id && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setOpenMenuId(null)}
                    />
                    <div className="absolute right-0 top-full z-20 mt-1 w-32 rounded-xl border border-gray-100 bg-white py-1 shadow-lg">
                      {ROLE_OPTIONS.filter((r) => r.value !== 'captain' && r.value !== member.role).map((role) => {
                        const label =
                          terminology === 'club'
                            ? CLUB_ROLE_LABELS[role.value]
                            : role.label;
                        return (
                        <button
                          key={role.value}
                          onClick={() => {
                            onChangeRole?.(member.id, role.value);
                            setOpenMenuId(null);
                          }}
                          className="w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          {label}으로 변경
                        </button>
                        );
                      })}
                      {canRemove && (
                        <button
                          onClick={() => {
                            onRemoveMember?.(member.id);
                            setOpenMenuId(null);
                          }}
                          className="w-full px-3 py-2 text-left text-xs text-red-500 hover:bg-red-50 transition-colors"
                        >
                          내보내기
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
