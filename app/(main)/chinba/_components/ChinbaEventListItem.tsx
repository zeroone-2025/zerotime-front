'use client';

import { FiUsers, FiCheck, FiTrash2 } from 'react-icons/fi';
import { formatDateRanges } from '@/_lib/utils/dateRange';
import type { ChinbaEventListItem } from '@/_types/chinba';

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active: { label: '진행중', className: 'bg-blue-100 text-blue-700' },
  completed: { label: '완료', className: 'bg-emerald-100 text-emerald-700' },
  expired: { label: '만료', className: 'bg-gray-100 text-gray-500' },
};

interface ChinbaEventListItemProps {
  event: ChinbaEventListItem;
  onClick: () => void;
  onDelete?: (eventId: string) => void; // 선택적 삭제 콜백
  compact?: boolean; // 사이드바용 축소 모드
}

export function ChinbaEventListItem({ event, onClick, onDelete, compact = false }: ChinbaEventListItemProps) {
  const badge = STATUS_BADGE[event.status] || STATUS_BADGE.active;
  const isExpired = event.status === 'expired';

  if (compact) {
    // 사이드바용 축소 버전
    return (

      <div
        role="button"
        onClick={onClick}
        className={`w-full text-left p-2.5 rounded-lg border transition-all active:scale-[0.98] cursor-pointer ${isExpired
          ? 'border-gray-100 bg-gray-50/50 opacity-60'
          : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
      >
        <div className="flex items-start justify-between mb-1">
          <h3 className="text-xs font-bold text-gray-800 truncate flex-1 mr-2">
            {event.title}
          </h3>
          <div className="flex items-center gap-1 shrink-0">
            <span className={`text-[9px] font-medium px-1 py-0.5 rounded ${badge.className}`}>
              {badge.label}
            </span>
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(event.event_id);
                }}
                className="p-1 text-red-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title="삭제"
              >
                <FiTrash2 size={10} />
              </button>
            )}
          </div>
        </div>

        <p className="text-[10px] text-gray-500 mb-1.5">
          {formatDateRanges(event.dates)}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-[10px] text-gray-400">
            <FiUsers size={10} />
            <span>{event.submitted_count}/{event.participant_count}</span>
          </div>
          {event.my_submitted ? (
            <div className="flex items-center gap-0.5 text-[10px] text-emerald-600">
              <FiCheck size={10} />
              <span>제출</span>
            </div>
          ) : (
            <span className="text-[10px] text-amber-600">미제출</span>
          )}
        </div>
      </div>
    );
  }

  // 기존 전체 버전 (ChinbaHistoryClient용)
  return (
    <div
      role="button"
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border transition-all active:scale-[0.98] cursor-pointer ${isExpired
        ? 'border-gray-100 bg-gray-50/50 opacity-60'
        : 'border-gray-200 bg-white hover:border-gray-300'
        }`}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-sm font-bold text-gray-800 truncate flex-1 mr-2">
          {event.title}
        </h3>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${badge.className}`}>
            {badge.label}
          </span>
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(event.event_id);
              }}
              className="p-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              title="삭제"
            >
              <FiTrash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-2">
        {formatDateRanges(event.dates)}
      </p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <FiUsers size={12} />
          <span>제출 {event.submitted_count}/{event.participant_count}</span>
        </div>
        {event.my_submitted ? (
          <div className="flex items-center gap-1 text-xs text-emerald-600">
            <FiCheck size={12} />
            <span>제출완료</span>
          </div>
        ) : (
          <span className="text-xs text-amber-600">미제출</span>
        )}
      </div>

      {event.creator_nickname && (
        <p className="mt-1.5 text-[10px] text-gray-400">
          만든이: {event.creator_nickname}
        </p>
      )}
    </div>
  );
}
