'use client';

import { useState, useEffect } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';
import { FiSettings } from 'react-icons/fi';
import { LuChevronLeft } from 'react-icons/lu';

import LoadingSpinner from '@/_components/ui/LoadingSpinner';
import { useEventCategories } from '@/_lib/hooks/useCategories';
import { useGroupSets } from '@/_lib/hooks/useGroups';
import { useSmartBack } from '@/_lib/hooks/useSmartBack';
import { useTeamDetail } from '@/_lib/hooks/useTeam';

import CategoryFilterBar from '../../_components/CategoryFilterBar';
import GroupFilterBar from '../../_components/GroupFilterBar';
import TeamSegmentTabs, { type TeamSegment } from '../../_components/TeamSegmentTabs';
import UpgradeModal from '../../_components/UpgradeModal';
import ActivityTab from './ActivityTab';
import JababwaTab from './JababwaTab';
import MannajaTab from './MannajaTab';

export default function TeamDetailClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const smartBack = useSmartBack('/teams');
  const teamId = searchParams.get('id') ? Number(searchParams.get('id')) : undefined;
  const { data: team, isLoading, isError } = useTeamDetail(teamId);
  const { data: groupSetsData } = useGroupSets(teamId);

  const tabParam = searchParams.get('tab') as TeamSegment | null;
  const initialTab: TeamSegment = tabParam === 'mwoheni' || tabParam === 'jabahbwa' ? tabParam : 'mannaja';
  const [activeTab, setActiveTab] = useState<TeamSegment>(initialTab);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [pendingTab, setPendingTab] = useState<TeamSegment | null>(null);
  const [freeNoticeSeen, setFreeNoticeSeen] = useState(false);
  const [selectedSetId, setSelectedSetId] = useState<number | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

  const groupSets = groupSetsData?.group_sets ?? [];
  // 세트 1개일 때 자동 선택
  const effectiveSetId = groupSets.length === 1 ? groupSets[0].id : selectedSetId;

  const { data: categoriesData } = useEventCategories(teamId);
  const categories = categoriesData?.categories ?? [];

  // 선택 중이던 카테고리가 삭제되면 필터 자동 해제 (로딩 중 오리셋 방지 위해 데이터 존재 가드)
  useEffect(() => {
    if (
      selectedCategoryId != null &&
      categoriesData &&
      !categoriesData.categories.some((c) => c.id === selectedCategoryId)
    ) {
      setSelectedCategoryId(null);
    }
  }, [categoriesData, selectedCategoryId]);

  // 뭐했니/잡아봐 탭: 무료 이벤트 기간 — 안내 팝업 1회 노출 후 진입 허용
  const isPaidTab = (tab: TeamSegment) => tab === 'mwoheni' || tab === 'jabahbwa';
  const needsSubscription = team && !team.is_paid;

  const handleTabChange = (tab: TeamSegment) => {
    if (isPaidTab(tab) && needsSubscription && !freeNoticeSeen) {
      setPendingTab(tab);
      setShowUpgrade(true);
      return;
    }
    setActiveTab(tab);
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-white">
        <LoadingSpinner />
      </div>
    );
  }

  if (isError || !team) {
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

  const renderTabContent = () => {
    if (activeTab === 'mannaja') {
      return <MannajaTab teamId={teamId!} myRole={team.my_role} memberCount={team.member_count} inviteCode={team.invite_code} selectedSetId={effectiveSetId} selectedGroupId={selectedGroupId} selectedCategoryId={selectedCategoryId} />;
    }

    if (activeTab === 'mwoheni') {
      return <ActivityTab teamId={teamId!} myRole={team.my_role} selectedSetId={effectiveSetId} selectedGroupId={selectedGroupId} selectedCategoryId={selectedCategoryId} />;
    }

    if (activeTab === 'jabahbwa') {
      return <JababwaTab teamId={teamId!} myRole={team.my_role} selectedSetId={effectiveSetId} selectedGroupId={selectedGroupId} selectedCategoryId={selectedCategoryId} />;
    }

    return null;
  };

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="shrink-0 px-4 pb-0">
        <div className="pt-safe md:pt-0" />
        <div className="relative mt-4 mb-3 flex items-center justify-center">
          <button
            onClick={smartBack}
            className="absolute left-0 z-10 group -ml-1 rounded-full p-2 text-gray-600 transition-all hover:bg-gray-100 hover:text-gray-900 active:scale-95"
            aria-label="뒤로가기"
          >
            <LuChevronLeft size={24} strokeWidth={2.5} className="transition-transform group-hover:-translate-x-0.5" />
          </button>
          <h1 className="text-base font-bold text-gray-800 truncate max-w-[60%]">
            {team.name}
          </h1>
          <button
            onClick={() => router.push(`/teams/settings?id=${teamId}`)}
            className="absolute right-0 z-10 rounded-full p-2 text-gray-600 transition-all hover:bg-gray-100 hover:text-gray-900 active:scale-95"
            aria-label="설정"
          >
            <FiSettings size={20} />
          </button>
        </div>
      </div>

      {/* Segment Tabs */}
      <div className="shrink-0">
        <TeamSegmentTabs activeTab={activeTab} onTabChange={handleTabChange} />
      </div>

      {/* Group / Category Filter */}
      {(groupSets.length > 0 || categories.length > 0) && (
        <div className="shrink-0 px-4 pt-3 space-y-2">
          {groupSets.length > 0 && (
            <GroupFilterBar
              groupSets={groupSets}
              selectedSetId={effectiveSetId}
              selectedGroupId={selectedGroupId}
              onSetChange={setSelectedSetId}
              onGroupChange={setSelectedGroupId}
            />
          )}
          <CategoryFilterBar
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            onChange={setSelectedCategoryId}
          />
        </div>
      )}

      {/* Tab Content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6">
        {renderTabContent()}
      </div>

      {/* Upgrade Modal */}
      {teamId && (
        <UpgradeModal
          isOpen={showUpgrade}
          onClose={() => setShowUpgrade(false)}
          teamId={teamId}
          onConfirm={() => {
            setFreeNoticeSeen(true);
            if (pendingTab) setActiveTab(pendingTab);
            setPendingTab(null);
          }}
        />
      )}
    </div>
  );
}
