'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FiUpload, FiRotateCcw } from 'react-icons/fi';
import Button from '@/_components/ui/Button';
import LoadingSpinner from '@/_components/ui/LoadingSpinner';
import Toast from '@/_components/ui/Toast';
import ConfirmModal from '@/_components/ui/ConfirmModal';
import ChinbaScheduleGrid from './ChinbaScheduleGrid';
import ChinbaScheduleList from './ChinbaScheduleList';
import ScheduleInputModeTabs, { type ScheduleInputMode } from './ScheduleInputModeTabs';
import { getLoginUrl } from '@/_lib/utils/requireLogin';
import { useMyParticipation, useUpdateUnavailability, useImportTimetable } from '@/_lib/hooks/useChinba';

interface MyScheduleTabProps {
  eventId: string;
  dates: string[];
  startHour: number;
  endHour: number;
  isLoggedIn: boolean;
  // 제공되면 저장 성공 시 URL 리다이렉트(/chinba/event?tab=team&toast=save) 대신 호출된다 — 임베드용
  onAfterSave?: () => void;
}

export default function MyScheduleTab({ eventId, dates, startHour, endHour, isLoggedIn, onAfterSave }: MyScheduleTabProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: participation, isLoading } = useMyParticipation(isLoggedIn ? eventId : undefined);
  const updateMutation = useUpdateUnavailability(eventId);
  const importMutation = useImportTimetable(eventId);

  const draftKey = `chinba:event:${eventId}:draft-unavailable`;
  const modeKey = `chinba:event:${eventId}:input-mode`;
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<ScheduleInputMode>('drag');
  const [hasDraft, setHasDraft] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [showNoTimetableModal, setShowNoTimetableModal] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
  const [toastVisible, setToastVisible] = useState(false);
  const [toastKey, setToastKey] = useState(0);

  // Load existing unavailable slots (logged in only)
  useEffect(() => {
    if (participation?.unavailable_slots && !hasDraft) {
      setSelectedSlots(new Set(participation.unavailable_slots));
    }
  }, [participation?.unavailable_slots, hasDraft]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(draftKey);
      if (!stored) {
        setDraftLoaded(true);
        return;
      }
      const parsed = JSON.parse(stored) as { slots?: string[]; updatedAt?: number };
      if (Array.isArray(parsed?.slots)) {
        setSelectedSlots(new Set(parsed.slots));
        setHasDraft(true);
      }
    } catch {
      // ignore localStorage errors
    } finally {
      setDraftLoaded(true);
    }
  }, [draftKey]);

  // 입력 방식은 마지막 선택을 기억한다 (탭 복원과 같은 방식)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(modeKey);
      if (stored === 'drag' || stored === 'manual') setMode(stored);
    } catch {
      // ignore localStorage errors
    }
  }, [modeKey]);

  const handleModeChange = useCallback((next: ScheduleInputMode) => {
    setMode(next);
    try {
      localStorage.setItem(modeKey, next);
    } catch {
      // ignore localStorage errors
    }
  }, [modeKey]);

  const handleSlotsChange = useCallback((slots: Set<string>) => {
    setSelectedSlots(slots);
  }, []);

  // draftLoaded 전에는 초기 빈 상태가 localStorage를 덮어쓰지 않도록 가드
  useEffect(() => {
    if (!draftLoaded) return;
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({ slots: Array.from(selectedSlots), updatedAt: Date.now() })
      );
    } catch {
      // ignore localStorage errors
    }
  }, [draftKey, selectedSlots, draftLoaded]);

  const handleSave = async () => {
    if (!isLoggedIn) {
      setToastMessage('로그인이 필요합니다');
      setToastType('info');
      setToastVisible(true);
      setToastKey(prev => prev + 1);
      router.push(getLoginUrl());
      return;
    }
    try {
      await updateMutation.mutateAsync({
        unavailable_slots: Array.from(selectedSlots),
      });
      if (onAfterSave) {
        onAfterSave();
      } else {
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', 'team');
        params.set('toast', 'save');
        router.replace(`/chinba/event?${params.toString()}`);
      }
      try {
        localStorage.removeItem(draftKey);
      } catch {
        // ignore localStorage errors
      }
      setHasDraft(false);
    } catch (err: any) {
      setToastMessage(err.response?.data?.detail || '저장에 실패했습니다');
      setToastType('error');
      setToastVisible(true);
      setToastKey(prev => prev + 1);
    }
  };

  const handleImport = async () => {
    if (!isLoggedIn) {
      setToastMessage('로그인이 필요합니다');
      setToastType('info');
      setToastVisible(true);
      setToastKey(prev => prev + 1);
      router.push(getLoginUrl());
      return;
    }
    try {
      const result = await importMutation.mutateAsync();
      setToastMessage(result.message);
      setToastType('success');
      setToastVisible(true);
      setToastKey(prev => prev + 1);
      try {
        localStorage.removeItem(draftKey);
      } catch {
        // ignore localStorage errors
      }
      setHasDraft(false);
    } catch (err: any) {
      const detail = err.response?.data?.detail as string | undefined;
      const status = err.response?.status as number | undefined;
      const isNoTimetable =
        status === 404 && !!detail && (detail.includes('시간표를 찾을 수 없습니다') || detail.includes('시간표에 수업이 없습니다'));

      if (isNoTimetable) {
        setShowNoTimetableModal(true);
        return;
      }

      setToastMessage(detail || '시간표 불러오기에 실패했습니다');
      setToastType('error');
      setToastVisible(true);
      setToastKey(prev => prev + 1);
    }
  };

  if (isLoggedIn && (isLoading || !draftLoaded)) {
    return (
      <div className="flex h-40 items-center justify-center">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  return (
    <div className="px-4 pb-20">
      {/* Info + Actions */}
      <div className="mb-4 space-y-2">
        {/* Instruction banner + 입력 방식 전환 — 문구는 세그먼트 라벨과 겹치지 않게 짧게 둔다 */}
        <div className="flex items-center justify-between gap-2 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-[11px] text-emerald-800 font-medium leading-tight">
              {mode === 'drag' ? '불가능한 시간을 칠하세요' : '불가능한 시간을 추가하세요'}
            </p>
            <p className="text-[10px] text-emerald-600 mt-0.5">
              {mode === 'drag' ? '빨간색이 불가능한 시간입니다' : '날짜별 30분 단위로 넣습니다'}
            </p>
          </div>
          <ScheduleInputModeTabs mode={mode} onModeChange={handleModeChange} />
        </div>

        {/* Action buttons */}
        <div className="flex items-stretch gap-2">
          <button
            onClick={handleImport}
            disabled={importMutation.isPending}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-[11px] font-medium text-gray-600 hover:bg-gray-100 active:scale-[0.97] transition-all disabled:opacity-50"
          >
            {importMutation.isPending ? (
              <LoadingSpinner size="sm" />
            ) : (
              <FiUpload size={12} />
            )}
            내 시간표 불러오기
          </button>
          <button
            onClick={() => {
              setSelectedSlots(new Set());
              setHasDraft(false);
            }}
            disabled={selectedSlots.size === 0}
            className="shrink-0 flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-[11px] font-medium text-red-500 hover:bg-red-50 active:scale-[0.97] transition-all disabled:opacity-30"
          >
            <FiRotateCcw size={12} />
            초기화
          </button>
        </div>
      </div>

      {/* Schedule input — 두 모드가 같은 selectedSlots를 읽고 쓴다 */}
      {mode === 'drag' ? (
        <div className="mb-4 rounded-xl border border-gray-200 p-2 overflow-hidden">
          <ChinbaScheduleGrid
            dates={dates}
            startHour={startHour}
            endHour={endHour}
            selectedSlots={selectedSlots}
            onSlotsChange={handleSlotsChange}
          />
        </div>
      ) : (
        <div className="mb-4">
          <ChinbaScheduleList
            dates={dates}
            startHour={startHour}
            endHour={endHour}
            selectedSlots={selectedSlots}
            onSlotsChange={handleSlotsChange}
          />
        </div>
      )}

      {/* Sticky bottom bar with save button */}
      <div className="sticky bottom-0 z-10 -mx-4 border-t border-gray-100 bg-white px-4 py-3 pb-safe">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={handleSave}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? (
            <span className="flex items-center justify-center gap-2">
              <LoadingSpinner size="sm" />
              저장 중...
            </span>
          ) : (
            '저장하기'
          )}
        </Button>
      </div>

      <Toast
        message={toastMessage}
        isVisible={toastVisible}
        onClose={() => setToastVisible(false)}
        duration={2000}
        type={toastType}
        triggerKey={toastKey}
      />

      <ConfirmModal
        isOpen={showNoTimetableModal}
        title="저장된 시간표가 없습니다"
        confirmLabel="등록하러 가기"
        cancelLabel="취소"
        onConfirm={() => router.push('/chinba/my')}
        onCancel={() => setShowNoTimetableModal(false)}
      >
        시간표를 등록하고 1초만에 불러오세요.
      </ConfirmModal>
    </div>
  );
}
