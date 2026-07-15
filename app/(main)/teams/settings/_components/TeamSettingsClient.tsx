'use client';

import { useState } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';
import { FiXCircle } from 'react-icons/fi';
import { LuChevronLeft } from 'react-icons/lu';

import ConfirmModal from '@/_components/ui/ConfirmModal';
import LoadingSpinner from '@/_components/ui/LoadingSpinner';
import { useToast } from '@/_context/ToastContext';
import { useSmartBack } from '@/_lib/hooks/useSmartBack';
import {
  useTeamDetail,
  useTeamMembers,
  useUpdateTeam,
  useDeleteTeam,
  useChangeRole,
  useRemoveMember,
  useRegenerateInviteCode,
} from '@/_lib/hooks/useTeam';
import { getCategoryOptions } from '@/_lib/utils/teamDisplay';
import {
  canEditTeam,
  canDeleteTeam,
  canRegenerateInvitation,
} from '@/_lib/utils/teamPermissions';
import type { TeamRole } from '@/_types/team';

import InviteSection from '../../_components/InviteSection';
import MemberList from '../../_components/MemberList';
import EventCategorySection from '@/(main)/chinba/_components/team/categories/EventCategorySection';
import GroupSettingsSection from '@/(main)/chinba/_components/team/groups/GroupSettingsSection';
import SubscriptionSection from '@/(main)/chinba/_components/team/SubscriptionSection';

export default function TeamSettingsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const teamId = searchParams.get('id') ? Number(searchParams.get('id')) : undefined;
  const smartBack = useSmartBack(`/teams/detail?id=${teamId}`);
  const { showToast } = useToast();

  const { data: team, isLoading: isLoadingTeam } = useTeamDetail(teamId);
  const { data: membersData, isLoading: isLoadingMembers } = useTeamMembers(teamId);
  const updateTeam = useUpdateTeam(teamId!);
  const deleteTeam = useDeleteTeam();
  const changeRole = useChangeRole(teamId!);
  const removeMember = useRemoveMember(teamId!);
  const regenerateCode = useRegenerateInviteCode(teamId!);

  const [editName, setEditName] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState<number | null>(null);

  const categoryOptions = getCategoryOptions();
  const members = membersData?.members ?? [];
  const myRole = team?.my_role ?? 'member';
  const isEditing = editName !== null;

  if (isLoadingTeam) {
    return (
      <div className="flex h-full items-center justify-center bg-white">
        <LoadingSpinner />
      </div>
    );
  }

  if (!team || !teamId) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-white">
        <p className="text-sm text-gray-400 mb-3">팀 정보를 불러오지 못했습니다</p>
        <button
          onClick={smartBack}
          className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200"
        >
          돌아가기
        </button>
      </div>
    );
  }

  const handleStartEdit = () => {
    setEditName(team.name);
    setEditCategory(team.category || '');
  };

  const handleCancelEdit = () => {
    setEditName(null);
    setEditCategory(null);
  };

  const handleSaveEdit = async () => {
    if (editName === null) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      showToast('팀 이름을 입력해주세요', 'error');
      return;
    }

    try {
      await updateTeam.mutateAsync({
        name: trimmed,
        category: editCategory || undefined,
      });
      showToast('팀 정보가 수정되었습니다', 'success');
      setEditName(null);
      setEditCategory(null);
    } catch (err: any) {
      showToast(err.response?.data?.detail || '수정에 실패했습니다', 'error');
    }
  };

  const handleDeleteTeam = async () => {
    try {
      await deleteTeam.mutateAsync(teamId);
      showToast('팀이 삭제되었습니다', 'success');
      router.replace('/teams');
    } catch (err: any) {
      showToast(err.response?.data?.detail || '삭제에 실패했습니다', 'error');
    }
    setShowDeleteConfirm(false);
  };

  const handleChangeRole = async (memberId: number, role: TeamRole) => {
    try {
      await changeRole.mutateAsync({ memberId, role });
      showToast('역할이 변경되었습니다', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.detail || '역할 변경에 실패했습니다', 'error');
    }
  };

  const handleRemoveMember = (memberId: number) => {
    setShowRemoveConfirm(memberId);
  };

  const confirmRemoveMember = async () => {
    if (showRemoveConfirm === null) return;
    try {
      await removeMember.mutateAsync(showRemoveConfirm);
      showToast('멤버를 내보냈습니다', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.detail || '내보내기에 실패했습니다', 'error');
    }
    setShowRemoveConfirm(null);
  };

  const handleRegenerateCode = async () => {
    try {
      await regenerateCode.mutateAsync();
      showToast('초대 코드가 재생성되었습니다', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.detail || '재생성에 실패했습니다', 'error');
    }
  };

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="shrink-0 px-4 pb-3">
        <div className="pt-safe md:pt-0" />
        <div className="relative mt-4 flex items-center justify-center">
          <button
            onClick={smartBack}
            className="absolute left-0 z-10 group -ml-1 rounded-full p-2 text-gray-600 transition-all hover:bg-gray-100 hover:text-gray-900 active:scale-95"
            aria-label="뒤로가기"
          >
            <LuChevronLeft size={24} strokeWidth={2.5} className="transition-transform group-hover:-translate-x-0.5" />
          </button>
          <h1 className="text-base font-bold text-gray-800">팀 설정</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-8">
        {/* Section 1: Team Info */}
        <section className="mb-6">
          <h2 className="text-sm font-bold text-gray-800 mb-3">팀 정보</h2>
          <div className="rounded-xl border border-gray-100 bg-white p-4 space-y-4">
            {isEditing ? (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">팀 이름</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={editName || ''}
                      onChange={(e) => setEditName(e.target.value)}
                      maxLength={50}
                      className="w-full rounded-xl border border-gray-200 px-4 py-2.5 pr-10 text-sm text-gray-800 outline-none focus:border-gray-900 transition-colors"
                    />
                    {(editName?.length ?? 0) > 0 && (
                      <button
                        type="button"
                        onClick={() => setEditName('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
                      >
                        <FiXCircle size={16} />
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">카테고리</label>
                  <div className="flex flex-wrap gap-1.5">
                    {categoryOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setEditCategory((prev) => (prev === opt.value ? '' : opt.value))}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors active:scale-95 ${
                          editCategory === opt.value
                            ? 'border-gray-900 bg-gray-900 text-white'
                            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCancelEdit}
                    className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={updateTeam.isPending}
                    className="flex-1 rounded-xl bg-gray-900 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
                  >
                    {updateTeam.isPending ? '저장 중...' : '저장'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">팀 이름</p>
                    <p className="text-sm font-medium text-gray-800">{team.name}</p>
                  </div>
                  {canEditTeam(myRole) && (
                    <button
                      onClick={handleStartEdit}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-50"
                    >
                      수정
                    </button>
                  )}
                </div>
                {team.category && (
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">카테고리</p>
                    <p className="text-sm text-gray-600">{team.category}</p>
                  </div>
                )}
              </>
            )}
          </div>

          {canDeleteTeam(myRole) && !isEditing && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="mt-3 w-full rounded-xl border border-red-100 py-2.5 text-sm font-medium text-red-500 transition-colors hover:bg-red-50"
            >
              팀 삭제
            </button>
          )}
        </section>

        {/* Section 2: Invite */}
        <section className="mb-6">
          <h2 className="text-sm font-bold text-gray-800 mb-3">초대 링크</h2>
          <InviteSection
            inviteCode={team.invite_code}
            canRegenerate={canRegenerateInvitation(myRole)}
            onRegenerate={handleRegenerateCode}
            isRegenerating={regenerateCode.isPending}
            onShowToast={showToast}
          />
        </section>

        {/* Section 3: Members */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-800">
              멤버 관리
              <span className="ml-1.5 text-xs font-normal text-gray-400">
                {members.length}명
              </span>
            </h2>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white">
            {isLoadingMembers ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner size="sm" />
              </div>
            ) : members.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">
                멤버가 없습니다
              </div>
            ) : (
              <MemberList
                members={members}
                myRole={myRole}
                teamId={teamId}
                onChangeRole={handleChangeRole}
                onRemoveMember={handleRemoveMember}
              />
            )}
          </div>
        </section>

        {/* Section 4: 그룹/조 관리 */}
        <GroupSettingsSection
          teamId={teamId}
          canManage={canEditTeam(myRole)}
        />

        {/* 일정 카테고리 관리 */}
        <EventCategorySection
          teamId={teamId}
          canManage={canEditTeam(myRole)}
        />

        {/* Section 5: 구독 관리 */}
        <SubscriptionSection
          teamId={teamId}
          canManage={canEditTeam(myRole)}
        />
      </div>

      {/* Delete Confirm Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onConfirm={handleDeleteTeam}
        onCancel={() => setShowDeleteConfirm(false)}
        title="팀 삭제"
        confirmLabel="삭제"
        cancelLabel="취소"
        variant="danger"
      >
        <p>정말 이 팀을 삭제하시겠습니까?</p>
        <p className="mt-1 text-xs text-gray-400">이 작업은 되돌릴 수 없습니다.</p>
      </ConfirmModal>

      {/* Remove Member Confirm Modal */}
      <ConfirmModal
        isOpen={showRemoveConfirm !== null}
        onConfirm={confirmRemoveMember}
        onCancel={() => setShowRemoveConfirm(null)}
        title="멤버 내보내기"
        confirmLabel="내보내기"
        cancelLabel="취소"
        variant="danger"
      >
        <p>이 멤버를 팀에서 내보내시겠습니까?</p>
      </ConfirmModal>
    </div>
  );
}
