'use client';

import { useState, useEffect } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';
import { FiSettings } from 'react-icons/fi';

import ClubSwitcher from '@/(main)/chinba/_components/team/ClubSwitcher';
import TeamMembersModal from '@/(main)/chinba/_components/team/TeamMembersModal';
import TeamOpsPanel from '@/(main)/chinba/_components/team/TeamOpsPanel';
import CategoryFilterBar from '@/(main)/teams/_components/CategoryFilterBar';
import GroupFilterBar from '@/(main)/teams/_components/GroupFilterBar';
import TeamSegmentTabs, { type TeamSegment } from '@/(main)/teams/_components/TeamSegmentTabs';
import UpgradeModal from '@/(main)/teams/_components/UpgradeModal';
import ActivityTab from '@/(main)/teams/detail/_components/ActivityTab';
import JababwaTab from '@/(main)/teams/detail/_components/JababwaTab';
import MannajaTab from '@/(main)/teams/detail/_components/MannajaTab';
import FullPageModal from '@/_components/layout/FullPageModal';
import LoadingSpinner from '@/_components/ui/LoadingSpinner';
import { useEventCategories } from '@/_lib/hooks/useCategories';
import { useGroupSets } from '@/_lib/hooks/useGroups';
import { useSmartBack } from '@/_lib/hooks/useSmartBack';
import { useTeamDetail } from '@/_lib/hooks/useTeam';
import { setLastTeamId } from '@/_lib/utils/chinbaSelection';
import { canEditTeam } from '@/_lib/utils/teamPermissions';
import { useAuthInitialized } from '@/providers';

export default function TeamDetailView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const goBack = useSmartBack('/chinba/team');

  const teamId = Number(searchParams.get('id'));
  const tabParam = searchParams.get('tab') as TeamSegment | null;
  const initialTab: TeamSegment = tabParam === 'mwoheni' || tabParam === 'jabahbwa' ? tabParam : 'mannaja';

  const isAuthReady = useAuthInitialized();
  const { data: team, isLoading, isError } = useTeamDetail(teamId);
  const { data: groupSetsData } = useGroupSets(teamId || undefined);
  const [activeTab, setActiveTab] = useState<TeamSegment>(initialTab);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [pendingTab, setPendingTab] = useState<TeamSegment | null>(null);
  const [freeNoticeSeen, setFreeNoticeSeen] = useState(false);
  const [selectedSetId, setSelectedSetId] = useState<number | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [showMembers, setShowMembers] = useState(false);

  const groupSets = groupSetsData?.group_sets ?? [];
  const effectiveSetId = groupSets.length === 1 ? groupSets[0].id : selectedSetId;

  const { data: categoriesData } = useEventCategories(teamId || undefined);
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

  // 마지막으로 본 동아리를 기억 → 하단 `동아리` 탭이 여기로 바로 들어옴
  useEffect(() => {
    if (teamId) setLastTeamId(teamId);
  }, [teamId]);

  // Sync tab state when URL changes (e.g. browser back/forward)
  useEffect(() => {
    const tab = searchParams.get('tab') as TeamSegment | null;
    const resolved: TeamSegment = tab === 'mwoheni' || tab === 'jabahbwa' ? tab : 'mannaja';
    if (resolved !== activeTab) {
      setActiveTab(resolved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // 뭐했니/잡아봐 탭: 무료 이벤트 기간 — 안내 팝업 1회 노출 후 진입 허용
  const isPaidTab = (tab: TeamSegment) => tab === 'mwoheni' || tab === 'jabahbwa';
  const needsSubscription = team && !team.is_paid;

  const goToTab = (tab: TeamSegment) => {
    setActiveTab(tab);
    router.replace(`/chinba/team/detail?id=${teamId}&tab=${tab}`);
  };

  const handleTabChange = (tab: TeamSegment) => {
    if (isPaidTab(tab) && needsSubscription && !freeNoticeSeen) {
      setPendingTab(tab);
      setShowUpgrade(true);
      return;
    }
    goToTab(tab);
  };

  const handleSettingsClick = () => {
    router.push(`/chinba/team/settings?id=${teamId}`);
  };

  if (!teamId) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-white">
        <p className="text-sm text-gray-400 mb-3">잘못된 접근입니다</p>
        <button
          onClick={goBack}
          className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200"
        >
          돌아가기
        </button>
      </div>
    );
  }

  if (!isAuthReady || isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-white">
        <LoadingSpinner />
      </div>
    );
  }

  if (isError || !team) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-white">
        <p className="text-sm text-gray-400 mb-3">동아리 정보를 불러오지 못했습니다</p>
        <button
          onClick={goBack}
          className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200"
        >
          돌아가기
        </button>
      </div>
    );
  }

  const renderTabContent = () => {
    if (activeTab === 'mannaja') {
      return <MannajaTab teamId={teamId} myRole={team.my_role} memberCount={team.member_count} inviteCode={team.invite_code} selectedSetId={effectiveSetId} selectedGroupId={selectedGroupId} selectedCategoryId={selectedCategoryId} terminology="club" />;
    }
    if (activeTab === 'mwoheni') {
      return <ActivityTab teamId={teamId} myRole={team.my_role} selectedSetId={effectiveSetId} selectedGroupId={selectedGroupId} selectedCategoryId={selectedCategoryId} terminology="club" />;
    }
    if (activeTab === 'jabahbwa') {
      return <JababwaTab teamId={teamId} myRole={team.my_role} selectedSetId={effectiveSetId} selectedGroupId={selectedGroupId} selectedCategoryId={selectedCategoryId} />;
    }
    return null;
  };

  const settingsButton = (
    <button
      onClick={handleSettingsClick}
      className="rounded-full p-2 text-gray-600 transition-all hover:bg-gray-100 hover:text-gray-900 active:scale-95"
      aria-label="설정"
    >
      <FiSettings size={20} />
    </button>
  );

  const canOps = canEditTeam(team.my_role);

  return (
    <FullPageModal
      isOpen={true}
      onClose={goBack}
      title={<ClubSwitcher currentTeamId={teamId} currentName={team.name} />}
      headerRight={settingsButton}
    >
      <div className="flex min-h-0 flex-1 flex-row">
        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
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
        </div>

        {/* Desktop-only operations panel (운영진 only) */}
        {canOps && (
          <TeamOpsPanel
            teamId={teamId}
            inviteCode={team.invite_code}
            onOpenMembers={() => setShowMembers(true)}
            onCreateEvent={() => router.push(`/chinba/team/event-create?id=${teamId}`)}
            onRecordActivity={() => handleTabChange('mwoheni')}
          />
        )}
      </div>

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        teamId={teamId}
        terminology="club"
        onConfirm={() => {
          setFreeNoticeSeen(true);
          if (pendingTab) goToTab(pendingTab);
          setPendingTab(null);
        }}
      />

      {/* Member management modal */}
      {canOps && (
        <TeamMembersModal
          isOpen={showMembers}
          onClose={() => setShowMembers(false)}
          teamId={teamId}
          myRole={team.my_role}
        />
      )}
    </FullPageModal>
  );
}
