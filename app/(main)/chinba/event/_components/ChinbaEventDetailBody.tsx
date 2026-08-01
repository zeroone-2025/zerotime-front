'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

import { useSearchParams, useRouter } from 'next/navigation';
import { FiShare2, FiTrash2, FiCheckCircle, FiLink } from 'react-icons/fi';

import ConfirmModal from '@/_components/ui/ConfirmModal';
import LoadingSpinner from '@/_components/ui/LoadingSpinner';
import Toast from '@/_components/ui/Toast';
import { useChinbaEventDetail, useDeleteChinbaEvent, useCompleteChinbaEvent } from '@/_lib/hooks/useChinba';
import { useUser } from '@/_lib/hooks/useUser';
import { formatDateRanges } from '@/_lib/utils/dateRange';

import MyScheduleTab from './MyScheduleTab';
import TeamJoinGate from './TeamJoinGate';
import TeamScheduleTab from './TeamScheduleTab';

interface ChinbaEventDetailBodyProps {
  eventId: string;
  // page: 풀페이지 라우트(/chinba/event) — 서브탭을 URL(tab=team|my)과 동기화.
  // embedded: 팀 상세 임베드 — 팀 상세의 tab 파라미터와 충돌하므로 URL 동기화 없이 로컬 state만 사용.
  variant: 'page' | 'embedded';
  onDeleted: () => void;
  // 완료 처리 후 호출 — recordQuery는 활동 기록 폼 자동 오픈용 쿼리(recordTitle=..&recordDate=..) 직렬화 결과
  onCompleted: (recordQuery: string) => void;
}

function readLastTab(lastTabKey: string): 'team' | 'my' | null {
  try {
    const stored = localStorage.getItem(lastTabKey);
    if (stored === 'my' || stored === 'team') return stored;
  } catch {
    // ignore localStorage errors
  }
  return null;
}

// 친바 이벤트 상세 본문 — 풀페이지(ChinbaDetailClient)와 팀 상세 임베드 양쪽에서 재사용한다.
export default function ChinbaEventDetailBody({
  eventId,
  variant,
  onDeleted,
  onCompleted,
}: ChinbaEventDetailBodyProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const lastTabKey = `chinba:event:${eventId}:last-tab`;
  const isPage = variant === 'page';

  const { user, isLoggedIn, isAuthLoaded } = useUser();
  const { data: event, isLoading, error } = useChinbaEventDetail(eventId);
  const deleteMutation = useDeleteChinbaEvent();
  const completeMutation = useCompleteChinbaEvent();

  const TAB_INDEX: Record<'team' | 'my', number> = { team: 0, my: 1 };
  const [activeTab, setActiveTab] = useState<'team' | 'my'>(() => {
    if (isPage) return searchParams.get('tab') === 'my' ? 'my' : 'team';
    return readLastTab(lastTabKey) ?? 'team';
  });
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');
  const [isAnimating, setIsAnimating] = useState(false);
  const pendingTabRef = useRef<'team' | 'my' | null>(null);

  // URL → 탭 동기화 (브라우저 뒤로/앞으로) — 풀페이지 전용
  useEffect(() => {
    if (!isPage) return;
    const tab = searchParams.get('tab');
    if (tab === 'my' || tab === 'team') {
      if (pendingTabRef.current) {
        if (pendingTabRef.current === tab) {
          pendingTabRef.current = null;
        }
        return;
      }
      if (tab === activeTab) return;
      const direction = TAB_INDEX[tab] > TAB_INDEX[activeTab] ? 'right' : 'left';
      setSlideDirection(direction);
      setIsAnimating(true);
      setActiveTab(tab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPage, searchParams, activeTab]);

  // 마지막 탭 복원 (tab 파라미터 없이 진입 시) — 풀페이지 전용
  useEffect(() => {
    if (!isPage) return;
    const tab = searchParams.get('tab');
    if (tab === 'my' || tab === 'team') return;
    const stored = readLastTab(lastTabKey);
    if (stored) {
      pendingTabRef.current = stored;
      setActiveTab(stored);
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', stored);
      router.replace(`/chinba/event?${params.toString()}`);
    }
  }, [isPage, lastTabKey, router, searchParams]);

  const handleTabChange = (tab: 'team' | 'my') => {
    if (tab === activeTab) return;
    const direction = TAB_INDEX[tab] > TAB_INDEX[activeTab] ? 'right' : 'left';
    setSlideDirection(direction);
    setIsAnimating(true);
    setActiveTab(tab);
    try {
      localStorage.setItem(lastTabKey, tab);
    } catch {
      // ignore localStorage errors
    }
    if (!isPage) return;
    pendingTabRef.current = tab;
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.replace(`/chinba/event?${params.toString()}`);
  };

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
  const [toastKey, setToastKey] = useState(0);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
    setToastKey(prev => prev + 1);
  }, []);

  // 내 일정 저장 직후 리다이렉트로 넘어온 토스트 소비 — 풀페이지 전용
  useEffect(() => {
    if (!isPage) return;
    const toastParam = searchParams.get('toast');
    if (toastParam !== 'save') return;
    showToast('저장되었습니다');
    const params = new URLSearchParams(searchParams.toString());
    params.delete('toast');
    router.replace(`/chinba/event?${params.toString()}`);
  }, [isPage, router, searchParams, showToast]);

  const isCreator = isLoggedIn && user && event && user.id === event.creator_id;
  const isActive = event?.status === 'active';
  const isCompleted = event?.status === 'completed';
  const isExpired = event?.status === 'expired';

  // 공유 링크는 항상 정규 풀페이지 URL로 — 임베드 URL(팀 상세 ?view=event)이 공유되지 않도록
  const getShareUrl = useCallback(
    () => `${window.location.origin}/chinba/event?id=${encodeURIComponent(eventId)}&tab=team`,
    [eventId],
  );

  const handleShare = useCallback(async () => {
    const url = getShareUrl();
    const text = `${event?.title || '일정 조율'}에 참여하세요!`;

    if (navigator.share) {
      try {
        await navigator.share({ title: event?.title, text, url });
      } catch {
        // cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
      showToast('링크가 복사되었습니다');
    }
  }, [event?.title, getShareUrl, showToast]);

  const handleCopyLink = useCallback(async () => {
    await navigator.clipboard.writeText(getShareUrl());
    showToast('링크가 복사되었습니다');
  }, [getShareUrl, showToast]);

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(eventId);
      onDeleted();
    } catch {
      alert('삭제에 실패했습니다');
    }
    setShowDeleteModal(false);
  };

  const handleComplete = async () => {
    try {
      await completeMutation.mutateAsync(eventId);
      setShowCompleteModal(false);
      // 완료된 일정 정보(제목/날짜)를 넘겨 '활동 기록하기' 폼이 자동으로 열리게 한다.
      const recordParams = new URLSearchParams();
      if (event?.title) recordParams.set('recordTitle', event.title);
      if (event?.dates?.[0]) recordParams.set('recordDate', String(event.dates[0]).slice(0, 10));
      if (event?.category) recordParams.set('recordCategoryId', String(event.category.id));
      onCompleted(recordParams.toString());
      return;
    } catch {
      alert('완료 처리에 실패했습니다');
    }
    setShowCompleteModal(false);
  };

  // Loading state
  if (!isAuthLoaded || isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // 동아리 일정인데 아직 멤버가 아님 — 공유 링크만 받고 들어온 경우.
  // 여기서 끝내므로 헤더의 공유·삭제 버튼과 탭이 아예 렌더되지 않는다.
  if (event && event.team_id && !event.is_team_member) {
    return <TeamJoinGate eventId={eventId} event={event} />;
  }

  // Error state
  if (error || !event) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <p className="text-sm text-gray-500">이벤트를 찾을 수 없습니다</p>
        <button
          onClick={() => router.push('/')}
          className="mt-4 text-sm text-blue-600 hover:underline"
        >
          홈으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Event Detail Header */}
      <div className="shrink-0 px-4 pb-2 border-b border-gray-100">
        <div className="flex items-center justify-between">
          {variant === 'embedded' ? (
            // 임베드에서는 FullPageModal 헤더가 없으므로 제목을 여기서 보여준다
            <div className="min-w-0">
              <h2 className="truncate text-sm font-bold text-gray-800">{event.title || '친바'}</h2>
              <p className="text-[11px] text-gray-500 truncate">{formatDateRanges(event.dates)}</p>
            </div>
          ) : (
            <p className="text-[11px] text-gray-500 truncate">{formatDateRanges(event.dates)}</p>
          )}

          <div className="flex items-center gap-1 shrink-0">
            {isCreator && isActive && (
              <button
                onClick={() => setShowCompleteModal(true)}
                className="rounded-full p-2 text-emerald-600 hover:bg-emerald-50 transition-colors"
                title="완료 처리"
              >
                <FiCheckCircle size={18} />
              </button>
            )}
            <button
              onClick={handleCopyLink}
              className="rounded-full p-2 text-gray-600 hover:bg-gray-100 transition-colors"
              title="링크 복사"
            >
              <FiLink size={17} />
            </button>
            <button
              onClick={handleShare}
              className="rounded-full p-2 text-gray-600 hover:bg-gray-100 transition-colors"
              title="공유"
            >
              <FiShare2 size={18} />
            </button>
            {isCreator && (
              <button
                onClick={() => setShowDeleteModal(true)}
                className="rounded-full p-2 text-red-500 hover:bg-red-50 transition-colors"
              >
                <FiTrash2 size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Status Banner */}
      {isCompleted && (
        <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-100">
          <p className="text-xs text-emerald-700 text-center font-medium">완료된 일정입니다</p>
        </div>
      )}
      {isExpired && (
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
          <p className="text-xs text-gray-500 text-center font-medium">만료된 일정입니다</p>
        </div>
      )}

      {/* Tabs (only show if active) */}
      {isActive && (
        <div className="shrink-0 flex border-b border-gray-200">
          <button
            onClick={() => handleTabChange('team')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${activeTab === 'team'
              ? 'text-gray-900 border-b-2 border-gray-900'
              : 'text-gray-400'
              }`}
          >
            전체 일정
          </button>
          <button
            onClick={() => handleTabChange('my')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${activeTab === 'my'
              ? 'text-gray-900 border-b-2 border-gray-900'
              : 'text-gray-400'
              }`}
          >
            내 일정
          </button>
        </div>
      )}

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto pt-4">
        <div className="overflow-clip">
          <div
            key={activeTab}
            className={
              isAnimating
                ? slideDirection === 'right'
                  ? 'animate-slideInRight'
                  : 'animate-slideInLeft'
                : ''
            }
            onAnimationEnd={() => setIsAnimating(false)}
          >
            {(isCompleted || isExpired || activeTab === 'team') && (
              <TeamScheduleTab event={event} />
            )}
            {isActive && activeTab === 'my' && (
              <MyScheduleTab
                eventId={eventId}
                dates={event.dates}
                startHour={event.start_hour}
                endHour={event.end_hour}
                isLoggedIn={isLoggedIn}
                onAfterSave={
                  isPage
                    ? undefined
                    : () => {
                        handleTabChange('team');
                        showToast('저장되었습니다');
                      }
                }
              />
            )}
          </div>
        </div>
      </div>

      {/* Copy/save toast */}
      <Toast
        message={toastMessage}
        isVisible={toastVisible}
        onClose={() => setToastVisible(false)}
        type={toastType}
        duration={2000}
        triggerKey={toastKey}
      />

      {/* Delete Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        variant="danger"
        confirmLabel="삭제"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      >
        이 일정을 삭제하시겠습니까?
        <br />
        <span className="text-xs text-gray-400">모든 참여자의 데이터가 삭제됩니다</span>
      </ConfirmModal>

      {/* Complete Modal */}
      <ConfirmModal
        isOpen={showCompleteModal}
        confirmLabel="완료"
        onConfirm={handleComplete}
        onCancel={() => setShowCompleteModal(false)}
      >
        이 일정을 완료 처리하시겠습니까?
        <br />
        <span className="text-xs text-gray-400">완료 후에는 일정 수정이 불가합니다</span>
      </ConfirmModal>
    </>
  );
}
