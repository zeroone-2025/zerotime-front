'use client';

import { useMemo, useState } from 'react';

import { FiChevronDown, FiChevronUp, FiCopy, FiBell } from 'react-icons/fi';

import LoadingSpinner from '@/_components/ui/LoadingSpinner';
import { useToast } from '@/_context/ToastContext';
import { useTeamEvents, useTeamEventDetail } from '@/_lib/hooks/useTeamEvents';

interface TeamResponsePanelProps {
  teamId: number;
}

/**
 * 패널에 인라인으로 펼쳐지는 응답 현황(기본 펼침). 모달 아님.
 * 일정별 제출/미제출 현황을 항상 보여주고, 일정을 누르면 그 자리에서 미제출자 명단이 펼쳐진다.
 * 데이터는 기존 team events API(submitted_count/participants[].has_submitted) 그대로 — 백엔드 신규 없음.
 * "알림"은 백엔드 미비로 빈껍데기(준비 중 토스트).
 */
export default function TeamResponsePanel({ teamId }: TeamResponsePanelProps) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useTeamEvents(teamId, 'active');
  const events = useMemo(() => data?.events ?? [], [data]);

  const { data: detail, isLoading: detailLoading } = useTeamEventDetail(
    open && selectedId ? teamId : undefined,
    open && selectedId ? selectedId : undefined,
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
    <section className="flex flex-col border-t border-gray-100 pt-5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="mb-2 flex items-center justify-between px-1 text-[11px] font-bold uppercase tracking-wide text-gray-400 transition-colors hover:text-gray-600"
        aria-expanded={open}
      >
        응답 현황
        {open ? <FiChevronUp size={13} /> : <FiChevronDown size={13} />}
      </button>

      {open && (
        <>
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <LoadingSpinner size="sm" />
            </div>
          ) : events.length === 0 ? (
            <p className="px-1 py-1 text-xs text-gray-400">진행 중인 일정이 없습니다</p>
          ) : (
            <div className="flex flex-col gap-1">
              {events.map((ev) => {
                const total = ev.total_participants || 0;
                const pct = total > 0 ? Math.round((ev.submitted_count / total) * 100) : 0;
                const selected = ev.event_id === selectedId;
                return (
                  <div key={ev.event_id}>
                    <button
                      onClick={() => setSelectedId((prev) => (prev === ev.event_id ? null : ev.event_id))}
                      className={`w-full rounded-lg px-2 py-1.5 text-left transition-colors ${
                        selected ? 'bg-blue-50' : 'hover:bg-blue-50'
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-xs font-medium text-gray-700">{ev.title}</span>
                        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-gray-500">
                          {ev.submitted_count}/{total}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                      </div>
                    </button>

                    {selected && (
                      <div className="px-2 pb-1 pt-1.5">
                        {detailLoading ? (
                          <div className="flex items-center justify-center py-2">
                            <LoadingSpinner size="sm" />
                          </div>
                        ) : unsubmitted.length === 0 ? (
                          <p className="py-1 text-[11px] text-gray-400">전원 제출 완료 🎉</p>
                        ) : (
                          <>
                            <p className="mb-1 text-[11px] font-medium text-gray-500">
                              미제출 {unsubmitted.length}명
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {unsubmitted.map((p) => (
                                <span
                                  key={p.user_id}
                                  className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600"
                                >
                                  {p.nickname || '이름없음'}
                                </span>
                              ))}
                            </div>
                            <div className="mt-1.5 flex gap-1.5">
                              <button
                                onClick={handleCopy}
                                className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-gray-200 py-1.5 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50"
                              >
                                <FiCopy size={11} />
                                복사
                              </button>
                              <button
                                onClick={handleNotify}
                                className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-gray-900 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-gray-800"
                              >
                                <FiBell size={11} />
                                알림
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
