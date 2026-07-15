'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { FiShare2, FiTrash2, FiCheckCircle, FiLink } from 'react-icons/fi';
import LoadingSpinner from '@/_components/ui/LoadingSpinner';
import ConfirmModal from '@/_components/ui/ConfirmModal';
import Toast from '@/_components/ui/Toast';
import FullPageModal from '@/_components/layout/FullPageModal';
import { useSmartBack } from '@/_lib/hooks/useSmartBack';
import { useUser } from '@/_lib/hooks/useUser';
import { useChinbaEventDetail, useDeleteChinbaEvent, useCompleteChinbaEvent } from '@/_lib/hooks/useChinba';
import TeamScheduleTab from './TeamScheduleTab';
import MyScheduleTab from './MyScheduleTab';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function formatDateRange(dates: string[]): string {
  if (dates.length === 0) return '';
  return dates.map((d) => {
    const dt = new Date(d);
    return `${dt.getMonth() + 1}/${dt.getDate()}(${DAY_LABELS[dt.getDay()]})`;
  }).join(', ');
}

export default function ChinbaDetailClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const smartBack = useSmartBack();
  const eventId = searchParams.get('id') || '';
  const lastTabKey = `chinba:event:${eventId}:last-tab`;

  const { user, isLoggedIn, isAuthLoaded } = useUser();
  const { data: event, isLoading, error } = useChinbaEventDetail(eventId);
  const deleteMutation = useDeleteChinbaEvent();
  const completeMutation = useCompleteChinbaEvent();

  const TAB_INDEX: Record<'team' | 'my', number> = { team: 0, my: 1 };
  const initialTab = searchParams.get('tab') === 'my' ? 'my' : 'team';
  const [activeTab, setActiveTab] = useState<'team' | 'my'>(initialTab);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');
  const [isAnimating, setIsAnimating] = useState(false);
  const pendingTabRef = useRef<'team' | 'my' | null>(null);

  useEffect(() => {
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
  }, [searchParams, activeTab]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'my' || tab === 'team') return;
    try {
      const stored = localStorage.getItem(lastTabKey);
      if (stored === 'my' || stored === 'team') {
        pendingTabRef.current = stored;
        setActiveTab(stored);
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', stored);
        router.replace(`/chinba/event?${params.toString()}`);
      }
    } catch {
      // ignore localStorage errors
    }
  }, [lastTabKey, router, searchParams]);

  const handleTabChange = (tab: 'team' | 'my') => {
    if (tab === activeTab) return;
    const direction = TAB_INDEX[tab] > TAB_INDEX[activeTab] ? 'right' : 'left';
    setSlideDirection(direction);
    setIsAnimating(true);
    setActiveTab(tab);
    pendingTabRef.current = tab;
    try {
      localStorage.setItem(lastTabKey, tab);
    } catch {
      // ignore localStorage errors
    }
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

  useEffect(() => {
    const toastParam = searchParams.get('toast');
    if (toastParam !== 'save') return;
    setToastMessage('저장되었습니다');
    setToastVisible(true);
    setToastKey(prev => prev + 1);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('toast');
    router.replace(`/chinba/event?${params.toString()}`);
  }, [router, searchParams]);

  const isCreator = isLoggedIn && user && event && user.id === event.creator_id;
  const isActive = event?.status === 'active';
  const isCompleted = event?.status === 'completed';
  const isExpired = event?.status === 'expired';

  const handleShare = useCallback(async () => {
    const urlObj = new URL(window.location.href);
    urlObj.searchParams.set('tab', 'team');
    const url = urlObj.toString();
    const text = `${event?.title || '일정 조율'}에 참여하세요!`;

    if (navigator.share) {
      try {
        await navigator.share({ title: event?.title, text, url });
      } catch {
        // cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
      setToastMessage('링크가 복사되었습니다');
      setToastVisible(true);
      setToastKey(prev => prev + 1);
    }
  }, [event?.title]);

  const handleCopyLink = useCallback(async () => {
    const urlObj = new URL(window.location.href);
    urlObj.searchParams.set('tab', 'team');
    await navigator.clipboard.writeText(urlObj.toString());
    setToastMessage('링크가 복사되었습니다');
    setToastVisible(true);
    setToastKey(prev => prev + 1);
  }, []);

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(eventId);
      router.replace('/chinba');
    } catch {
      alert('삭제에 실패했습니다');
    }
    setShowDeleteModal(false);
  };

  const handleComplete = async () => {
    try {
      await completeMutation.mutateAsync(eventId);
      setShowCompleteModal(false);
      // 완료 처리 후, 넘어온 경로(팀 상세 '기록' 탭)로 이동하면서
      // 완료된 일정 정보(제목/날짜)를 넘겨 '활동 기록하기' 폼이 자동으로 열리게 한다.
      const returnTo = searchParams.get('returnTo');
      if (returnTo) {
        const dest = decodeURIComponent(returnTo);
        const recordParams = new URLSearchParams();
        if (event?.title) recordParams.set('recordTitle', event.title);
        if (event?.dates?.[0]) recordParams.set('recordDate', String(event.dates[0]).slice(0, 10));
        if (event?.category) recordParams.set('recordCategoryId', String(event.category.id));
        const suffix = recordParams.toString();
        router.replace(suffix ? `${dest}${dest.includes('?') ? '&' : '?'}${suffix}` : dest);
        return;
      }
    } catch {
      alert('완료 처리에 실패했습니다');
    }
    setShowCompleteModal(false);
  };

  // Loading state
  if (!isAuthLoaded || isLoading) {
    return (
      <FullPageModal isOpen={true} onClose={smartBack} title="친바">
        <div className="flex h-full items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </FullPageModal>
    );
  }

  // Error state
  if (error || !event) {
    return (
      <FullPageModal isOpen={true} onClose={smartBack} title="친바">
        <div className="flex h-full flex-col items-center justify-center">
          <p className="text-sm text-gray-500">이벤트를 찾을 수 없습니다</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 text-sm text-blue-600 hover:underline"
          >
            홈으로 돌아가기
          </button>
        </div>
      </FullPageModal>
    );
  }

  return (
    <>
      <FullPageModal isOpen={true} onClose={smartBack} title={event.title || '친바'}>
        {/* Event Detail Header */}
        <div className="shrink-0 px-4 pb-2 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-gray-500 truncate">{formatDateRange(event.dates)}</p>

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
                />
              )}
            </div>
          </div>
        </div>
      </FullPageModal>

      {/* Copy toast */}
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
