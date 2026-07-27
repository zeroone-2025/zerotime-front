'use client';

import { FiUsers } from 'react-icons/fi';

import { getRoleBadgeLabel, getRoleBadgeColor, formatMemberCount, CLUB_ROLE_LABELS } from '@/_lib/utils/teamDisplay';
import type { TeamListItem } from '@/_types/team';

interface TeamCardProps {
  team: TeamListItem;
  onClick: () => void;
  terminology?: 'team' | 'club';
}

export default function TeamCard({ team, onClick, terminology = 'team' }: TeamCardProps) {
  const defaultRoleLabel = getRoleBadgeLabel(team.my_role);
  const roleLabel =
    terminology === 'club' ? CLUB_ROLE_LABELS[team.my_role] : defaultRoleLabel;
  const roleColor = getRoleBadgeColor(team.my_role);

  const roleBadgeStyles: Record<string, string> = {
    red: 'bg-red-100 text-red-700',
    orange: 'bg-orange-100 text-orange-700',
    blue: 'bg-blue-100 text-blue-700',
    gray: 'bg-gray-100 text-gray-500',
  };

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border border-gray-100 bg-white p-4 transition-all hover:border-gray-200 active:scale-[0.98] cursor-pointer"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <h3 className="text-sm font-bold text-gray-800 truncate">
              {team.name}
            </h3>
            {team.is_paid && (
              <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                프리미엄
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <FiUsers size={12} />
              <span>{formatMemberCount(team.member_count)}</span>
            </div>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${roleBadgeStyles[roleColor] || roleBadgeStyles.gray}`}>
              {roleLabel}
            </span>
            {team.category && (
              <span className="text-[10px] text-gray-400">
                {team.category}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
