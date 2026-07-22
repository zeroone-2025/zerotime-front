'use client';

import { useEffect, useMemo, useState } from 'react';

import { FiBarChart2, FiCopy, FiBell } from 'react-icons/fi';

import LoadingSpinner from '@/_components/ui/LoadingSpinner';
import Modal from '@/_components/ui/Modal';
import { useToast } from '@/_context/ToastContext';
import { useTeamEvents, useTeamEventDetail } from '@/_lib/hooks/useTeamEvents';

interface TeamResponseModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: number;
}

/**
 * 일정별 제출/미제출 현황을 보는 모달.
 * 미제출자는 일정마다 다르므로 일정을 골라 그 일정 기준으로 명단을 본다.
 * 데이터는 기존 team events API(submitted_count/participants[].has_submitted)를 그대로 사용 — 백엔드 신규 없음.
 * "미제출자에게 알림"은 아직 백엔드가 없어 빈껍데기(준비 중 토스트)로 둔다.
 */
export default function TeamResponseModal({ isOpen, onClose, teamId }: TeamResponseModalProps) {
  const { showToast } = useToast();
  const { data: eventsData, isLoading: eventsLoading } = useTeamEvents(
    isOpen ? teamId : undefined,
    'active',
  );
  const events = useMemo(() => eventsData?.events ?? [], [eventsData]);

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSelectedEventId(null);
      return;
    }
    if (events.length > 0 && !selectedEventId) {
      setSelectedEventId(events[0].event_id);
    }
  }, [isOpen, events, selectedEventId]);

  const { data: detail, isLoading: detailLoading } = useTeamEventDetail(
    isOpen ? teamId : undefined,
    selectedEventId ?? undefined,
  );

  const unsubmitted = useMemo(
    () => (detail?.participants ?? []).filter((p) => !p.has_submitted),
    [detail],
  );

  const handleCopy = async () => {
    const names = unsubmitted.map((p) => p.nickname || '이름없음').join(', ');
    if (!names) return;
    try {
      await navigator.clipboard.writeText(names);
      showToast('미제출자 명단이 복사되었습니다', 'success');
    } catch {
      showToast('복사에 실패했습니다', 'error');
    }
  };

  const handleNotify = () => {
    // TODO(backend): 미제출자 푸시 알림 파이프라인 연결 지점. 현재는 빈껍데기.
    showToast('알림 전송은 준비 중입니다', 'info');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="응답 현황"
      titleIcon={<FiBarChart2 size={18} className="text-gray-500" />}
    >
      <div className="flex flex-col px-5 py-4">
        {eventsLoading ? (
          <div className="flex items-center justify-center py-10">
            <LoadingSpinner size="sm" />
          </div>
        ) : events.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400">진행 중인 일정이 없습니다</div>
        ) : (
          <>
            {/* 일정 목록 */}
            <div className="space-y-1.5">
              {events.map((ev) => {
                const active = ev.event_id === selectedEventId;
                const total = ev.total_participants || 0;
                const pct = total > 0 ? Math.round((ev.submitted_count / total) * 100) : 0;
                return (
                  <button
                    key={ev.event_id}
                    onClick={() => setSelectedEventId(ev.event_id)}
                    className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                      active ? 'border-blue-200 bg-blue-50' : 'border-gray-100 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium text-gray-800">{ev.title}</span>
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-gray-500">
                        {ev.submitted_count}/{total}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 선택 일정의 미제출자 */}
            {selectedEventId && (
              <div className="mt-4 border-t border-gray-100 pt-4">
                {detailLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <LoadingSpinner size="sm" />
                  </div>
                ) : unsubmitted.length === 0 ? (
                  <p className="py-4 text-center text-sm text-gray-400">전원 제출 완료 🎉</p>
                ) : (
                  <>
                    <p className="mb-2 text-xs font-bold text-gray-500">
                      미제출자 {unsubmitted.length}명
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {unsubmitted.map((p) => (
                        <span
                          key={p.user_id}
                          className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700"
                        >
                          {p.nickname || '이름없음'}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={handleCopy}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 active:scale-95"
                      >
                        <FiCopy size={14} />
                        명단 복사
                      </button>
                      <button
                        onClick={handleNotify}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gray-900 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 active:scale-95"
                      >
                        <FiBell size={14} />
                        알림 보내기
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
