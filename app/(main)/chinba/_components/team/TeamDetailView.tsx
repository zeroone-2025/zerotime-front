'use client';

import { useState, useEffect } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';
import { FiSettings } from 'react-icons/fi';
import { LuChevronLeft } from 'react-icons/lu';

import ClubSwitcher from '@/(main)/chinba/_components/team/ClubSwitcher';
import TeamCategoriesModal from '@/(main)/chinba/_components/team/TeamCategoriesModal';
import TeamEventCreateBody from '@/(main)/chinba/_components/team/TeamEventCreateBody';
import TeamGroupsModal from '@/(main)/chinba/_components/team/TeamGroupsModal';
import TeamMembersModal from '@/(main)/chinba/_components/team/TeamMembersModal';
import TeamOpsPanel from '@/(main)/chinba/_components/team/TeamOpsPanel';
import ChinbaEventDetailBody from '@/(main)/chinba/event/_components/ChinbaEventDetailBody';
import CategoryFilterBar from '@/(main)/teams/_components/CategoryFilterBar';
import GroupFilterBar from '@/(main)/teams/_components/GroupFilterBar';
import TeamSegmentTabs, { type TeamSegment } from '@/(main)/teams/_components/TeamSegmentTabs';
import UpgradeModal from '@/(main)/teams/_components/UpgradeModal';
import ActivityTab from '@/(main)/teams/detail/_components/ActivityTab';
import JababwaTab from '@/(main)/teams/detail/_components/JababwaTab';
import MannajaTab from '@/(main)/teams/detail/_components/MannajaTab';
import FullPageModal from '@/_components/layout/FullPageModal';
import LoadingSpinner from '@/_components/ui/LoadingSpinner';
import { useToast } from '@/_context/ToastContext';
import { CHINBA_HASHTAG_ENABLED, CHINBA_RANKING_TAB_ENABLED } from '@/_lib/constants/features';
import { useEventCategories } from '@/_lib/hooks/useCategories';
import { useGroupSets } from '@/_lib/hooks/useGroups';
import { useSmartBack } from '@/_lib/hooks/useSmartBack';
import { useTeamDetail } from '@/_lib/hooks/useTeam';
import { useUserStore } from '@/_lib/store/useUserStore';
import { setLastTeamId } from '@/_lib/utils/chinbaSelection';
import { hasSeenFreeNotice, markFreeNoticeSeen } from '@/_lib/utils/freeNotice';
import { canEditTeam } from '@/_lib/utils/teamPermissions';
import { DESKTOP_MEDIA_QUERY, isDesktopViewport } from '@/_lib/utils/viewport';
import { useAuthInitialized } from '@/providers';

export default function TeamDetailView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const goBack = useSmartBack('/chinba/team');

  const teamId = Number(searchParams.get('id'));
  const tabParam = searchParams.get('tab') as TeamSegment | null;
  const initialTab: TeamSegment =
    tabParam === 'mwoheni' || (tabParam === 'jabahbwa' && CHINBA_RANKING_TAB_ENABLED)
      ? tabParam
      : 'mannaja';

  // 데스크톱 임베드 뷰 (?view=create | ?view=event&eventId=..) — 만들기/이벤트 상세를
  // 팀 상세 프레임(세그먼트 탭 + 운영 패널) 안에서 렌더한다. 모바일은 풀페이지 라우트 유지.
  const viewParamRaw = searchParams.get('view');
  const viewEventId = searchParams.get('eventId') || '';
  const view: 'create' | 'event' | null =
    viewParamRaw === 'create' ? 'create' : viewParamRaw === 'event' && viewEventId ? 'event' : null;
  const viewSetId = searchParams.get('setId') ? Number(searchParams.get('setId')) : null;
  const viewGroupId = searchParams.get('groupId') ? Number(searchParams.get('groupId')) : null;
  const viewCategoryIdRaw = searchParams.get('categoryId');
  const viewCategoryId =
    viewCategoryIdRaw && Number.isFinite(Number(viewCategoryIdRaw)) ? Number(viewCategoryIdRaw) : null;

  const isAuthReady = useAuthInitialized();
  const { showToast } = useToast();
  const user = useUserStore((state) => state.user);
  const { data: team, isLoading, isError } = useTeamDetail(teamId);
  const { data: groupSetsData } = useGroupSets(teamId || undefined);
  const [activeTab, setActiveTab] = useState<TeamSegment>(initialTab);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [pendingTab, setPendingTab] = useState<TeamSegment | null>(null);
  const [freeNoticeSeen, setFreeNoticeSeen] = useState(false);
  // (사용자, 동아리)별 1회 노출 기억 — 클라이언트에서만 읽어 hydration mismatch 방지
  useEffect(() => {
    setFreeNoticeSeen(hasSeenFreeNotice(user?.id, teamId));
  }, [user?.id, teamId]);
  const [selectedSetId, setSelectedSetId] = useState<number | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [showGroups, setShowGroups] = useState(false);
  const [showCategories, setShowCategories] = useState(false);

  const groupSets = groupSetsData?.group_sets ?? [];
  const effectiveSetId = groupSets.length === 1 ? groupSets[0].id : selectedSetId;

  const { data: categoriesData } = useEventCategories(
    CHINBA_HASHTAG_ENABLED && teamId ? teamId : undefined
  );
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

  // 임베드 뷰는 데스크톱 전용 — 모바일 뷰포트(딥링크·리사이즈)면 동등한 풀페이지 라우트로 치환
  useEffect(() => {
    if (!view || !teamId) return;
    const toFullPage = () => {
      if (view === 'create') {
        const params = new URLSearchParams({ id: String(teamId) });
        if (viewSetId) params.set('setId', String(viewSetId));
        if (viewGroupId) params.set('groupId', String(viewGroupId));
        if (viewCategoryId) params.set('categoryId', String(viewCategoryId));
        router.replace(`/chinba/team/event-create?${params.toString()}`);
      } else {
        const returnTo = encodeURIComponent(`/chinba/team/detail?id=${teamId}&tab=mwoheni`);
        router.replace(`/chinba/event?id=${viewEventId}&returnTo=${returnTo}`);
      }
    };
    if (!isDesktopViewport()) {
      toFullPage();
      return;
    }
    const mql = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const onChange = (e: MediaQueryListEvent) => {
      if (!e.matches) toFullPage();
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [view, teamId, viewEventId, viewSetId, viewGroupId, viewCategoryId, router]);

  // 임베드 뷰는 FullPageModal 없이 렌더되므로 ESC = 목록 복귀를 직접 처리
  useEffect(() => {
    if (!view) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        router.replace(`/chinba/team/detail?id=${teamId}&tab=mannaja`);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [view, teamId, router]);

  // Sync tab state when URL changes (e.g. browser back/forward)
  useEffect(() => {
    const tab = searchParams.get('tab') as TeamSegment | null;
    const resolved: TeamSegment =
      tab === 'mwoheni' || (tab === 'jabahbwa' && CHINBA_RANKING_TAB_ENABLED) ? tab : 'mannaja';
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
    if (tab === 'jabahbwa' && !CHINBA_RANKING_TAB_ENABLED) {
      showToast('추후 업데이트 예정입니다');
      return;
    }
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

  // 만들기/이벤트 상세 진입 — 데스크톱은 임베드(?view=), 모바일은 기존 풀페이지 라우트
  const goCreate = () => {
    const params = new URLSearchParams({ id: String(teamId) });
    if (effectiveSetId) params.set('setId', String(effectiveSetId));
    if (selectedGroupId) params.set('groupId', String(selectedGroupId));
    if (selectedCategoryId) params.set('categoryId', String(selectedCategoryId));
    if (isDesktopViewport()) {
      params.set('tab', 'mannaja');
      params.set('view', 'create');
      router.push(`/chinba/team/detail?${params.toString()}`);
    } else {
      router.push(`/chinba/team/event-create?${params.toString()}`);
    }
  };

  const goEvent = (eventId: string) => {
    if (isDesktopViewport()) {
      router.push(`/chinba/team/detail?id=${teamId}&tab=mannaja&view=event&eventId=${eventId}`);
    } else {
      const returnTo = encodeURIComponent(`/chinba/team/detail?id=${teamId}&tab=mwoheni`);
      router.push(`/chinba/event?id=${eventId}&returnTo=${returnTo}`);
    }
  };

  const closeView = () => {
    router.replace(`/chinba/team/detail?id=${teamId}&tab=mannaja`);
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
      return <MannajaTab teamId={teamId} myRole={team.my_role} memberCount={team.member_count} inviteCode={team.invite_code} selectedSetId={effectiveSetId} selectedGroupId={selectedGroupId} selectedCategoryId={selectedCategoryId} terminology="club" onCreateEvent={goCreate} onOpenEvent={goEvent} />;
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

  const opsPanel = canOps ? (
    <TeamOpsPanel
      teamId={teamId}
      inviteCode={team.invite_code}
      onOpenMembers={() => setShowMembers(true)}
      onOpenGroups={() => setShowGroups(true)}
      onOpenCategories={() => setShowCategories(true)}
      onCreateEvent={goCreate}
      onRecordActivity={() => handleTabChange('mwoheni')}
    />
  ) : null;

  const teamModals = (
    <>
      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        teamId={teamId}
        terminology="club"
        onConfirm={() => {
          markFreeNoticeSeen(user?.id, teamId);
          setFreeNoticeSeen(true);
          if (pendingTab) goToTab(pendingTab);
          setPendingTab(null);
        }}
      />

      {/* Operations modals (desktop panel actions) */}
      {canOps && (
        <>
          <TeamMembersModal
            isOpen={showMembers}
            onClose={() => setShowMembers(false)}
            teamId={teamId}
            myRole={team.my_role}
          />
          <TeamGroupsModal
            isOpen={showGroups}
            onClose={() => setShowGroups(false)}
            teamId={teamId}
            myRole={team.my_role}
          />
          {CHINBA_HASHTAG_ENABLED && (
            <TeamCategoriesModal
              isOpen={showCategories}
              onClose={() => setShowCategories(false)}
              teamId={teamId}
              myRole={team.my_role}
            />
          )}
        </>
      )}
    </>
  );

  // 데스크톱 임베드 뷰 — 동아리 헤더·세그먼트 탭 없이 콘텐츠를 화면 최상단까지 올려
  // 양쪽 사이드바(앱 사이드바 + 운영 패널)만 남긴다. 8~24시 시간 그리드의 스크롤을 줄이기 위함.
  if (view) {
    return (
      <div className="flex-1 h-full min-h-0 flex flex-col animate-fadeIn bg-white">
        <div className="flex min-h-0 flex-1 flex-row">
          {/* Main column */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="shrink-0 flex items-center gap-1.5 px-3 pt-3 pb-1">
              <button
                onClick={closeView}
                className="group rounded-full p-1.5 text-gray-600 transition-all hover:bg-gray-100 hover:text-gray-900 active:scale-95"
                aria-label="목록으로"
              >
                <LuChevronLeft size={22} strokeWidth={2.5} className="transition-transform group-hover:-translate-x-0.5" />
              </button>
              <span className="text-base font-bold text-gray-800">
                {view === 'create' ? '일정 잡기' : team.name}
              </span>
            </div>
            <div className="flex min-h-0 flex-1 flex-col pt-2">
              {view === 'create' ? (
                <TeamEventCreateBody
                  teamId={teamId}
                  preSetId={viewSetId}
                  preGroupId={viewGroupId}
                  preCategoryId={viewCategoryId}
                  onSuccess={closeView}
                />
              ) : (
                <ChinbaEventDetailBody
                  key={viewEventId}
                  eventId={viewEventId}
                  variant="embedded"
                  onDeleted={closeView}
                  onCompleted={(recordQuery) =>
                    router.replace(
                      `/chinba/team/detail?id=${teamId}&tab=mwoheni${recordQuery ? `&${recordQuery}` : ''}`
                    )
                  }
                />
              )}
            </div>
          </div>

          {/* Desktop-only operations panel (운영진 only) */}
          {opsPanel}
        </div>
        {teamModals}
      </div>
    );
  }

  return (
    // 동아리 메인은 하단 탭바(홈·동아리·MY)가 떠 있는 경로라 뒤로가기가 없어도 나갈 수 있다
    // (chinba/layout.tsx의 BOTTOM_TAB_PATHS). 일정 상세·일정 잡기는 탭바가 없으므로 그대로 둔다.
    <FullPageModal
      isOpen={true}
      onClose={goBack}
      showBackButton={false}
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
        {opsPanel}
      </div>
      {teamModals}
    </FullPageModal>
  );
}
