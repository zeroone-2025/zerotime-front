'use client';

import { useState } from 'react';

import ConfirmModal from '@/_components/ui/ConfirmModal';
import { useToast } from '@/_context/ToastContext';
import { useTransferCaptain } from '@/_lib/hooks/useTeam';
import { canTransferCaptain } from '@/_lib/utils/teamPermissions';
import type { TeamMember, TeamRole } from '@/_types/team';
import MemberPickerSheet, { type PickableMember } from '@/(main)/chinba/_components/team/groups/MemberPickerSheet';

interface CaptainTransferSectionProps {
  teamId: number;
  members: TeamMember[];
  myRole: TeamRole;
}

/**
 * 회장 위임 — 대상 선택 시트 → 확인 모달 2단계.
 * 회장 전용(canTransferCaptain)이라 여기 보이는 role 'captain' 멤버는 곧 본인이며,
 * 자기 자신에게는 위임할 수 없으므로 후보에서 제외한다.
 */
export default function CaptainTransferSection({
  teamId,
  members,
  myRole,
}: CaptainTransferSectionProps) {
  const { showToast } = useToast();
  const transferCaptain = useTransferCaptain(teamId);

  const [showPicker, setShowPicker] = useState(false);
  const [target, setTarget] = useState<TeamMember | null>(null);

  if (!canTransferCaptain(myRole)) return null;

  const candidates: PickableMember[] = members
    .filter((m) => m.role !== 'captain')
    .map((m) => ({
      member_id: m.id,
      nickname: m.nickname || '사용자',
      profile_image: m.profile_image,
      role: m.role,
    }));

  const handlePick = (memberIds: number[]) => {
    const picked = members.find((m) => m.id === memberIds[0]);
    if (!picked) return;
    setShowPicker(false);
    setTarget(picked);
  };

  const handleConfirm = async () => {
    if (!target) return;
    try {
      await transferCaptain.mutateAsync({ new_captain_member_id: target.id });
      showToast(`${target.nickname || '사용자'}님에게 회장을 위임했습니다`, 'success');
    } catch (err: any) {
      showToast(err.response?.data?.detail || '위임에 실패했습니다', 'error');
    }
    setTarget(null);
  };

  return (
    <>
      <section className="mb-6 pt-4 border-t border-gray-100">
        <h2 className="text-sm font-bold text-gray-800 mb-1">회장 위임</h2>
        <p className="mb-3 text-xs text-gray-400">
          다른 멤버에게 회장을 넘깁니다. 위임하면 회원님은 운영진이 됩니다.
        </p>
        <button
          onClick={() => setShowPicker(true)}
          disabled={candidates.length === 0}
          className="w-full rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          {candidates.length === 0 ? '위임할 멤버가 없습니다' : '회장 위임하기'}
        </button>
      </section>

      {showPicker && (
        <MemberPickerSheet
          title="회장을 위임할 멤버"
          members={candidates}
          singleSelect
          confirmLabel="선택"
          onConfirm={handlePick}
          onCancel={() => setShowPicker(false)}
        />
      )}

      <ConfirmModal
        isOpen={target !== null}
        onConfirm={handleConfirm}
        onCancel={() => setTarget(null)}
        title="회장 위임"
        confirmLabel="위임"
        cancelLabel="취소"
        variant="danger"
      >
        <p>
          <span className="font-semibold text-gray-900">{target?.nickname || '사용자'}</span>
          님에게 회장을 위임하시겠습니까?
        </p>
        <p className="mt-1 text-xs text-gray-400">
          위임 후 회원님은 운영진이 되며, 되돌리려면 새 회장이 다시 위임해야 합니다.
        </p>
      </ConfirmModal>
    </>
  );
}
