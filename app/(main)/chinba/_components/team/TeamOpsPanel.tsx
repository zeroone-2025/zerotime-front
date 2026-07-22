'use client';

import { useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';
import {
  FiUsers,
  FiGrid,
  FiLink,
  FiTag,
  FiCalendar,
  FiEdit3,
  FiChevronRight,
  FiChevronLeft,
} from 'react-icons/fi';

import { useToast } from '@/_context/ToastContext';
import { formatInviteUrl } from '@/_lib/utils/teamDisplay';

const COLLAPSE_KEY = 'team_ops_panel_collapsed';

interface TeamOpsPanelProps {
  teamId: number;
  inviteCode: string | null;
  onOpenMembers: () => void;
  onCreateEvent: () => void;
  onRecordActivity: () => void;
}

/**
 * 데스크톱 전용 오른쪽 운영 패널.
 * 목적: 톱니바퀴(설정 페이지) 안에 묻혀 있던 운영 기능을 밖으로 꺼내 클릭 수를 줄인다.
 * - 노출: 부모(TeamDetailView)가 운영진(canEditTeam) 조건으로 렌더. 데스크톱은 `lg:` 이상만.
 * - 접기 상태는 localStorage에 영속(기존 사이드바 패턴과 동일).
 */
export default function TeamOpsPanel({
  teamId,
  inviteCode,
  onOpenMembers,
  onCreateEvent,
  onRecordActivity,
}: TeamOpsPanelProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === '1');
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      return next;
    });
  };

  const handleCopyInvite = async () => {
    if (!inviteCode) {
      showToast('초대 링크가 없습니다', 'error');
      return;
    }
    try {
      await navigator.clipboard.writeText(formatInviteUrl(inviteCode));
      showToast('초대 링크가 복사되었습니다', 'success');
    } catch {
      showToast('복사에 실패했습니다', 'error');
    }
  };

  const goSettings = () => router.push(`/chinba/team/settings?id=${teamId}`);
  const goGroups = () => router.push(`/chinba/team/groups?id=${teamId}`);

  if (collapsed) {
    return (
      <aside className="hidden w-11 shrink-0 flex-col items-center border-l border-gray-100 bg-white py-4 lg:flex">
        <button
          onClick={toggleCollapsed}
          className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 active:scale-95"
          aria-label="운영 패널 펼치기"
          title="운영 패널 펼치기"
        >
          <FiChevronLeft size={18} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="hidden w-[236px] shrink-0 flex-col overflow-y-auto border-l border-gray-100 bg-white lg:flex">
      <div className="flex flex-col gap-6 p-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-800">운영</h2>
          <button
            onClick={toggleCollapsed}
            className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 active:scale-95"
            aria-label="운영 패널 접기"
            title="접기"
          >
            <FiChevronRight size={16} />
          </button>
        </div>

        {/* 1) 톱니바퀴에서 꺼낸 운영 도구 */}
        <section className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">운영 도구</span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-400">
              톱니바퀴에서 꺼냄
            </span>
          </div>
          <PanelButton icon={FiUsers} label="멤버 관리" onClick={onOpenMembers} trailing="modal" />
          <PanelButton icon={FiGrid} label="조 / 그룹 관리" onClick={goGroups} />
          <PanelButton icon={FiLink} label="초대링크 복사" onClick={handleCopyInvite} trailing="copy" />
          <PanelButton icon={FiTag} label="카테고리 관리" onClick={goSettings} />
          <button
            onClick={goSettings}
            className="mt-0.5 self-start text-xs font-medium text-gray-400 transition-colors hover:text-gray-700"
          >
            전체 설정 열기 ›
          </button>
        </section>

        {/* 2) 그냥 있는 페이지 = 바로가기 */}
        <section className="flex flex-col gap-2 border-t border-gray-100 pt-5">
          <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">바로가기</span>
          <PanelButton icon={FiCalendar} label="일정 만들기" onClick={onCreateEvent} />
          <PanelButton icon={FiEdit3} label="활동 기록하기" onClick={onRecordActivity} />
        </section>
      </div>
    </aside>
  );
}

interface PanelButtonProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  onClick: () => void;
  trailing?: 'modal' | 'copy' | 'nav';
}

function PanelButton({ icon: Icon, label, onClick, trailing = 'nav' }: PanelButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-xl border border-gray-100 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:border-gray-200 hover:bg-gray-50 active:scale-[0.98]"
    >
      <Icon size={16} className="shrink-0 text-gray-500" />
      <span className="flex-1 text-left">{label}</span>
      <span className="text-xs text-gray-300">
        {trailing === 'copy' ? '⧉' : trailing === 'modal' ? '⤢' : '›'}
      </span>
    </button>
  );
}
