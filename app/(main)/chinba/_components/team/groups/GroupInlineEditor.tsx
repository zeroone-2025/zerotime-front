'use client';

import { useState, useEffect, useMemo } from 'react';

import { FiTrash2, FiPlus } from 'react-icons/fi';

import LoadingSpinner from '@/_components/ui/LoadingSpinner';
import Button from '@/_components/ui/Button';
import ConfirmModal from '@/_components/ui/ConfirmModal';
import { useGroups } from '@/_lib/hooks/useGroups';
import { useTeamMembers } from '@/_lib/hooks/useTeam';
import type { GroupInput, Group, TeamRole } from '@/_types/team';

import EditableGroupName from './EditableGroupName';
import MemberActionBar from './MemberActionBar';
import MemberPickerSheet, { type PickableMember } from './MemberPickerSheet';
import MoveTargetSheet from './MoveTargetSheet';

// ── Editable types ──────────────────────────────────────────────

interface EditableMember {
  member_id: number;
  nickname: string;
  is_leader: boolean;
}

interface EditableGroup {
  name: string;
  members: EditableMember[];
}

interface SelectedMember {
  groupIdx: number;
  memberIdx: number;
}

// ── Helpers ─────────────────────────────────────────────────────

function groupsToEditable(groups: Group[]): EditableGroup[] {
  return groups.map((g) => ({
    name: g.name,
    members: (g.members ?? []).map((m) => ({
      member_id: m.member_id,
      nickname: m.nickname ?? '이름없음',
      is_leader: m.is_leader,
    })),
  }));
}

function editableToGroupInputs(groups: EditableGroup[]): GroupInput[] {
  return groups.map((g, idx) => ({
    name: g.name,
    display_order: idx + 1,
    members: g.members.map((m) => ({
      member_id: m.member_id,
      is_leader: m.is_leader,
    })),
  }));
}

function toUnassigned(
  members: { member_id: number; nickname: string }[],
): EditableMember[] {
  return members.map((m) => ({
    member_id: m.member_id,
    nickname: m.nickname,
    is_leader: false,
  }));
}

// ── Component ───────────────────────────────────────────────────

interface GroupInlineEditorProps {
  teamId: number;
  groupSetId?: number;
  /**
   * edit    — 기존 편성을 고친다 (변경사항이 있어야 저장)
   * compose — 빈 상태에서 새로 편성한다 (첫 조를 자동으로 하나 만들어 준다)
   */
  mode?: 'edit' | 'compose';
  onSave: (groups: GroupInput[]) => void;
  onBack: () => void;
  isSaving: boolean;
}

export default function GroupInlineEditor({
  teamId,
  groupSetId,
  mode = 'edit',
  onSave,
  onBack,
  isSaving,
}: GroupInlineEditorProps) {
  const { data, isLoading } = useGroups(teamId, groupSetId);
  // 프로필 사진·역할은 조 API가 주지 않으므로 팀 멤버 목록에서 가져와 합친다
  const { data: teamMembersData } = useTeamMembers(teamId);
  const isCompose = mode === 'compose';

  // Editable state — initialised once when data arrives
  const [groups, setGroups] = useState<EditableGroup[]>([]);
  const [unassigned, setUnassigned] = useState<EditableMember[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (data && !initialized) {
      const editable = groupsToEditable(data.groups);
      setGroups(isCompose && editable.length === 0 ? [{ name: '1조', members: [] }] : editable);
      setUnassigned(toUnassigned(data.unassigned_members));
      setInitialized(true);
    }
  }, [data, initialized, isCompose]);

  // UI state
  const [selectedMember, setSelectedMember] = useState<SelectedMember | null>(null);
  const [showMoveSheet, setShowMoveSheet] = useState(false);
  const [showAddSheet, setShowAddSheet] = useState<number | null>(null);
  const [assignTarget, setAssignTarget] = useState<EditableMember | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);

  // member_id -> 프로필 사진·역할
  const memberMeta = useMemo(() => {
    const map = new Map<number, { profile_image: string | null; role: TeamRole }>();
    for (const m of teamMembersData?.members ?? []) {
      map.set(m.id, { profile_image: m.profile_image, role: m.role });
    }
    return map;
  }, [teamMembersData]);

  const pickableUnassigned: PickableMember[] = useMemo(
    () =>
      unassigned.map((m) => ({
        member_id: m.member_id,
        nickname: m.nickname,
        profile_image: memberMeta.get(m.member_id)?.profile_image,
        role: memberMeta.get(m.member_id)?.role,
      })),
    [unassigned, memberMeta],
  );

  // ── Validation ──────────────────────────────────────────────

  const groupsMissingLeader = groups.filter(
    (g) => g.members.length > 0 && !g.members.some((m) => m.is_leader),
  );
  // 백엔드는 멤버 0명인 조도 "조장 최소 1명" 검사에 걸려 400을 낸다 — 저장 전에 막는다
  const emptyGroups = groups.filter((g) => g.members.length === 0);

  const hasChanges = useMemo(() => {
    if (!data) return false;
    const initial = groupsToEditable(data.groups);
    const initialU = data.unassigned_members;
    if (groups.length !== initial.length) return true;
    for (let i = 0; i < groups.length; i++) {
      if (groups[i].name !== initial[i].name) return true;
      if (groups[i].members.length !== initial[i].members.length) return true;
      for (let j = 0; j < groups[i].members.length; j++) {
        const a = groups[i].members[j];
        const b = initial[i].members[j];
        if (a.member_id !== b.member_id || a.is_leader !== b.is_leader) return true;
      }
    }
    if (unassigned.length !== initialU.length) return true;
    return false;
  }, [groups, unassigned, data]);

  const canSave =
    groupsMissingLeader.length === 0 &&
    emptyGroups.length === 0 &&
    groups.length > 0 &&
    (isCompose || hasChanges);

  const blockReason =
    groups.length === 0
      ? '조를 하나 이상 만들어주세요'
      : emptyGroups.length > 0
      ? '멤버가 없는 조가 있습니다'
      : groupsMissingLeader.length > 0
      ? '조장을 지정해주세요'
      : null;

  // ── Group operations ────────────────────────────────────────

  const handleAddGroup = () => {
    const nextNum = groups.length + 1;
    setGroups((prev) => [...prev, { name: `${nextNum}조`, members: [] }]);
  };

  const handleDeleteGroup = (groupIdx: number) => {
    const removed = groups[groupIdx];
    setUnassigned((u) => [...u, ...removed.members.map((m) => ({ ...m, is_leader: false }))]);
    setGroups((prev) => prev.filter((_, i) => i !== groupIdx));
    setShowDeleteConfirm(null);
    setSelectedMember(null);
  };

  const handleRenameGroup = (groupIdx: number, newName: string) => {
    setGroups((prev) =>
      prev.map((g, i) => (i === groupIdx ? { ...g, name: newName } : g)),
    );
  };

  // ── Member operations ───────────────────────────────────────

  const handleSetLeader = () => {
    if (!selectedMember) return;
    const { groupIdx, memberIdx } = selectedMember;
    setGroups((prev) =>
      prev.map((g, gi) => {
        if (gi !== groupIdx) return g;
        return {
          ...g,
          members: g.members.map((m, mi) => ({
            ...m,
            is_leader: mi === memberIdx,
          })),
        };
      }),
    );
    setSelectedMember(null);
  };

  const handleMoveMember = (targetGroupIdx: number) => {
    if (!selectedMember) return;
    const { groupIdx, memberIdx } = selectedMember;
    const member = { ...groups[groupIdx].members[memberIdx], is_leader: false };
    setGroups((prev) =>
      prev.map((g, gi) => {
        if (gi === groupIdx) {
          return { ...g, members: g.members.filter((_, mi) => mi !== memberIdx) };
        }
        if (gi === targetGroupIdx) {
          return { ...g, members: [...g.members, member] };
        }
        return g;
      }),
    );
    setShowMoveSheet(false);
    setSelectedMember(null);
  };

  const handleUnassignMember = () => {
    if (!selectedMember) return;
    const { groupIdx, memberIdx } = selectedMember;
    const member = { ...groups[groupIdx].members[memberIdx], is_leader: false };
    setGroups((prev) =>
      prev.map((g, gi) => {
        if (gi !== groupIdx) return g;
        return { ...g, members: g.members.filter((_, mi) => mi !== memberIdx) };
      }),
    );
    setUnassigned((prev) => [...prev, member]);
    setSelectedMember(null);
  };

  const handleAddMembers = (groupIdx: number, memberIds: number[]) => {
    const membersToAdd = unassigned.filter((m) => memberIds.includes(m.member_id));
    setGroups((prev) =>
      prev.map((g, gi) => {
        if (gi !== groupIdx) return g;
        return { ...g, members: [...g.members, ...membersToAdd] };
      }),
    );
    setUnassigned((prev) => prev.filter((m) => !memberIds.includes(m.member_id)));
    setShowAddSheet(null);
  };

  /** 미배정 칩 → 조 선택 → 그 조에 넣기 */
  const handleAssignUnassigned = (targetGroupIdx: number) => {
    if (!assignTarget) return;
    const member = { ...assignTarget, is_leader: false };
    setGroups((prev) =>
      prev.map((g, gi) =>
        gi === targetGroupIdx ? { ...g, members: [...g.members, member] } : g,
      ),
    );
    setUnassigned((prev) => prev.filter((m) => m.member_id !== member.member_id));
    setAssignTarget(null);
  };

  const handleBack = () => {
    if (hasChanges) {
      setShowUnsavedConfirm(true);
    } else {
      onBack();
    }
  };

  // ── Derived ─────────────────────────────────────────────────

  const selectedMemberData = selectedMember
    ? groups[selectedMember.groupIdx]?.members[selectedMember.memberIdx]
    : null;

  // ── Loading ─────────────────────────────────────────────────

  if (isLoading || !initialized) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner />
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
        style={{ paddingBottom: selectedMember ? 96 : undefined }}
      >
        {/* Header */}
        <div>
          <h3 className="text-sm font-bold text-gray-800">
            {isCompose ? '직접 조 편성' : '조 편성 수정'}
          </h3>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {isCompose
              ? '조를 만들고 멤버를 눌러 넣어보세요'
              : '멤버를 눌러 이동하거나 조장을 변경할 수 있습니다'}
          </p>
        </div>

        {/* Add group */}
        <button
          type="button"
          onClick={handleAddGroup}
          className="w-full rounded-xl border-2 border-dashed border-gray-200 py-3 text-sm font-medium text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-colors active:scale-[0.98]"
        >
          <FiPlus className="inline mr-1" size={14} />
          새 조 추가
        </button>

        {/* Group cards */}
        {groups.map((group, gIdx) => {
          const isEmpty = group.members.length === 0;
          const hasLeader = isEmpty || group.members.some((m) => m.is_leader);
          const isValid = !isEmpty && hasLeader;
          return (
            <div
              key={gIdx}
              className={`rounded-xl border p-4 ${
                isValid ? 'border-gray-200' : 'border-red-200 bg-red-50/30'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <EditableGroupName
                  name={group.name}
                  onChange={(v) => handleRenameGroup(gIdx, v)}
                />
                <div className="flex items-center gap-2">
                  {isEmpty ? (
                    <span className="text-[11px] text-red-400">멤버 필요</span>
                  ) : (
                    !hasLeader && <span className="text-[11px] text-red-400">조장 필요</span>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(gIdx)}
                    className="p-1 text-gray-300 hover:text-red-400 transition-colors"
                  >
                    <FiTrash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Member chips */}
              <div className="flex flex-wrap gap-1.5">
                {group.members.map((member, mIdx) => {
                  const isSelected =
                    selectedMember?.groupIdx === gIdx &&
                    selectedMember?.memberIdx === mIdx;
                  return (
                    <button
                      key={member.member_id}
                      type="button"
                      onClick={() =>
                        setSelectedMember(
                          isSelected ? null : { groupIdx: gIdx, memberIdx: mIdx },
                        )
                      }
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition-all active:scale-95 ${
                        isSelected
                          ? 'ring-2 ring-blue-400 bg-blue-50 text-blue-700'
                          : member.is_leader
                          ? 'bg-gray-900 text-white'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {member.nickname}
                      {member.is_leader && ' ★'}
                    </button>
                  );
                })}
              </div>

              {/* Add member to this group */}
              <button
                type="button"
                onClick={() => setShowAddSheet(gIdx)}
                className="mt-2 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
              >
                <FiPlus className="inline mr-0.5" size={12} />
                멤버 추가
              </button>
            </div>
          );
        })}

        {/* Unassigned members */}
        {unassigned.length > 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-medium text-gray-500">미배정 멤버</h4>
              {groups.length > 0 && (
                <span className="text-[11px] text-gray-400">눌러서 조에 배정</span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {unassigned.map((m) => (
                <button
                  key={m.member_id}
                  type="button"
                  disabled={groups.length === 0}
                  onClick={() => setAssignTarget(m)}
                  className="rounded-full bg-gray-50 px-2.5 py-1 text-xs text-gray-500 transition-all hover:bg-gray-100 hover:text-gray-700 active:scale-95 disabled:cursor-default disabled:hover:bg-gray-50 disabled:hover:text-gray-500"
                >
                  {m.nickname}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom bar — action bar or save/back buttons */}
      {selectedMember && selectedMemberData ? (
        <MemberActionBar
          nickname={selectedMemberData.nickname}
          isLeader={selectedMemberData.is_leader}
          onSetLeader={handleSetLeader}
          onMove={() => setShowMoveSheet(true)}
          onUnassign={handleUnassignMember}
          onClose={() => setSelectedMember(null)}
        />
      ) : (
        <div className="shrink-0 px-4 py-3 pb-safe border-t border-gray-100">
          {blockReason && (
            <p className="mb-2 text-center text-[11px] text-red-400">{blockReason}</p>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" size="md" onClick={handleBack} className="flex-1">
              돌아가기
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => onSave(editableToGroupInputs(groups))}
              disabled={isSaving || !canSave}
              className="flex-1"
            >
              {isSaving ? '저장 중...' : '저장하기'}
            </Button>
          </div>
        </div>
      )}

      {/* Move target sheet */}
      {showMoveSheet && selectedMember && (
        <MoveTargetSheet
          memberNickname={selectedMemberData?.nickname ?? ''}
          groups={groups.map((g, i) => ({
            name: g.name,
            isCurrent: i === selectedMember.groupIdx,
          }))}
          onSelect={handleMoveMember}
          onCancel={() => setShowMoveSheet(false)}
        />
      )}

      {/* Add members sheet — 카톡 초대식 다중 선택 */}
      {showAddSheet !== null && (
        <MemberPickerSheet
          title={`${groups[showAddSheet]?.name}에 추가할 멤버`}
          members={pickableUnassigned}
          onConfirm={(memberIds) => handleAddMembers(showAddSheet, memberIds)}
          onCancel={() => setShowAddSheet(null)}
        />
      )}

      {/* 미배정 멤버를 조에 배정 */}
      {assignTarget && (
        <MoveTargetSheet
          memberNickname={assignTarget.nickname}
          groups={groups.map((g) => ({ name: g.name, isCurrent: false }))}
          onSelect={handleAssignUnassigned}
          onCancel={() => setAssignTarget(null)}
        />
      )}

      {/* Delete group confirm */}
      <ConfirmModal
        isOpen={showDeleteConfirm !== null}
        onConfirm={() =>
          showDeleteConfirm !== null && handleDeleteGroup(showDeleteConfirm)
        }
        onCancel={() => setShowDeleteConfirm(null)}
        title={`${showDeleteConfirm !== null ? groups[showDeleteConfirm]?.name : ''}을(를) 삭제하시겠습니까?`}
        confirmLabel="삭제"
        variant="danger"
      >
        소속 멤버는 미배정 상태가 됩니다
      </ConfirmModal>

      {/* Unsaved changes confirm */}
      <ConfirmModal
        isOpen={showUnsavedConfirm}
        onConfirm={() => {
          setShowUnsavedConfirm(false);
          onBack();
        }}
        onCancel={() => setShowUnsavedConfirm(false)}
        title="변경사항이 있습니다"
        confirmLabel="나가기"
        variant="danger"
      >
        저장하지 않은 변경사항이 있습니다. 나가시겠습니까?
      </ConfirmModal>
    </div>
  );
}
