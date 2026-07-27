'use client';

import { FiGrid } from 'react-icons/fi';

import GroupSettingsSection from '@/(main)/chinba/_components/team/groups/GroupSettingsSection';
import Modal from '@/_components/ui/Modal';
import { canEditTeam } from '@/_lib/utils/teamPermissions';
import type { TeamRole } from '@/_types/team';

interface TeamGroupsModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: number;
  myRole: TeamRole;
}

/**
 * 가운데 모달로 여는 조/그룹 관리. 기존 GroupSettingsSection을 재사용.
 * 이름변경·삭제는 모달 안에서 완결. 조 편성/수정/재편성은 섹션이 /chinba/team/groups로
 * 라우팅하므로 클릭 시 편성 페이지로 이동한다(모달은 페이지 전환과 함께 사라짐).
 */
export default function TeamGroupsModal({ isOpen, onClose, teamId, myRole }: TeamGroupsModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="조 / 그룹 관리"
      titleIcon={<FiGrid size={18} className="text-gray-500" />}
    >
      <GroupSettingsSection teamId={teamId} canManage={canEditTeam(myRole)} embedded />
    </Modal>
  );
}
