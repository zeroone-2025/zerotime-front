'use client';

import { useMemo, useState } from 'react';

import { FiChevronDown, FiChevronRight, FiPlus, FiX } from 'react-icons/fi';

import AddTimeRangeModal from './AddTimeRangeModal';
import { addRange, removeRange, slotsToRangesByDate, type TimeRange } from './chinbaSlotRanges';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

interface ChinbaScheduleListProps {
  dates: string[];
  startHour: number;
  endHour: number;
  selectedSlots: Set<string>;
  onSlotsChange: (slots: Set<string>) => void;
}

function formatDateLabel(dateStr: string): string {
  const dt = new Date(dateStr);
  return `${dt.getMonth() + 1}/${dt.getDate()} (${DAY_LABELS[dt.getDay()]})`;
}

/**
 * 직접 입력 모드 — 날짜별 불가능 시간 구간 목록.
 *
 * 구간은 selectedSlots에서 파생될 뿐 자체 상태를 갖지 않는다. 그래서 드래그 모드에서 칠한 시간이
 * 여기 구간으로 그대로 나타나고, 여기서 지운 구간은 그리드에서도 사라진다.
 */
export default function ChinbaScheduleList({
  dates,
  startHour,
  endHour,
  selectedSlots,
  onSlotsChange,
}: ChinbaScheduleListProps) {
  const sortedDates = useMemo(
    () => [...new Set(dates.map((d) => d.slice(0, 10)))].sort(),
    [dates]
  );
  const rangesByDate = useMemo(
    () => slotsToRangesByDate(selectedSlots, sortedDates),
    [selectedSlots, sortedDates]
  );

  // 접힘은 사용자가 명시적으로 접은 날짜만 — 기본은 펼침이라 구간이 생기면 바로 보인다
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [addTarget, setAddTarget] = useState<string | null>(null);

  const toggleCollapse = (dateStr: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(dateStr)) next.delete(dateStr);
      else next.add(dateStr);
      return next;
    });
  };

  const handleAdd = (dateStr: string, range: TimeRange) => {
    onSlotsChange(addRange(selectedSlots, dateStr, range));
    setCollapsed((prev) => {
      if (!prev.has(dateStr)) return prev;
      const next = new Set(prev);
      next.delete(dateStr); // 추가한 구간이 접힌 채로 숨어버리지 않게 펼친다
      return next;
    });
  };

  const handleRemove = (dateStr: string, range: TimeRange) => {
    onSlotsChange(removeRange(selectedSlots, dateStr, range));
  };

  return (
    <div className="divide-y divide-gray-100 rounded-xl border border-gray-200">
      {sortedDates.map((dateStr) => {
        const ranges = rangesByDate.get(dateStr) ?? [];
        const isCollapsed = collapsed.has(dateStr);
        const dateLabel = formatDateLabel(dateStr);
        return (
          <div key={dateStr}>
            <div className="flex items-center justify-between px-3 py-2.5">
              {/* 날짜마다 같은 문구가 반복되므로 aria-label로 어느 날짜인지 구분해준다 */}
              <button
                type="button"
                onClick={() => toggleCollapse(dateStr)}
                aria-expanded={!isCollapsed}
                aria-label={`${dateLabel} 시간 목록`}
                className="flex items-center gap-1.5 text-sm font-medium text-gray-800"
              >
                {isCollapsed ? (
                  <FiChevronRight size={14} className="text-gray-400" />
                ) : (
                  <FiChevronDown size={14} className="text-gray-400" />
                )}
                {dateLabel}
                {ranges.length > 0 && (
                  <span className="text-[11px] font-normal text-gray-400">{ranges.length}개</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setAddTarget(dateStr)}
                aria-label={`${dateLabel} 시간 추가`}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-100 active:scale-95"
              >
                <FiPlus size={12} />
                추가
              </button>
            </div>

            {!isCollapsed && (
              <div className="px-3 pb-2.5">
                {ranges.length === 0 ? (
                  <p className="py-1 text-[11px] text-gray-400">등록된 시간 없음</p>
                ) : (
                  <ul className="space-y-1">
                    {ranges.map((range) => (
                      <li
                        key={`${range.start}-${range.end}`}
                        className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
                      >
                        <span className="text-sm text-gray-800">
                          {range.start} ~ {range.end}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemove(dateStr, range)}
                          aria-label={`${dateLabel} ${range.start}~${range.end} 삭제`}
                          className="rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700 active:scale-95"
                        >
                          <FiX size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })}

      <AddTimeRangeModal
        isOpen={addTarget !== null}
        dateStr={addTarget ?? ''}
        dateLabel={addTarget ? formatDateLabel(addTarget) : ''}
        startHour={startHour}
        endHour={endHour}
        onSubmit={(range) => {
          if (addTarget) handleAdd(addTarget, range);
        }}
        onClose={() => setAddTarget(null)}
      />
    </div>
  );
}
