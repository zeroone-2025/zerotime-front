'use client';

import { FiTag } from 'react-icons/fi';

import EventCategorySection from '@/(main)/chinba/_components/team/categories/EventCategorySection';
import Modal from '@/_components/ui/Modal';
import { canEditTeam } from '@/_lib/utils/teamPermissions';
import type { TeamRole } from '@/_types/team';

interface TeamCategoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: number;
  myRole: TeamRole;
}

/** 가운데 모달로 여는 카테고리 관리. 기존 EventCategorySection(전부 inline)을 재사용. */
export default function TeamCategoriesModal({ isOpen, onClose, teamId, myRole }: TeamCategoriesModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="카테고리 관리"
      titleIcon={<FiTag size={18} className="text-gray-500" />}
    >
      <EventCategorySection teamId={teamId} canManage={canEditTeam(myRole)} embedded />
    </Modal>
  );
}
