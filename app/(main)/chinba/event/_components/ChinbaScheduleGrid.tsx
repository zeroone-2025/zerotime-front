'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import { buildChinbaGridLayout } from './chinbaGridColumns';
import { getSlotKey } from './chinbaSlotRanges';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

// 시간 라벨 열(w-7)과 클러스터 구분선 열의 폭
const TIME_LABEL_WIDTH = 28;
const GAP_COL_WIDTH = 16;

interface ChinbaScheduleGridProps {
  dates: string[];
  startHour: number;
  endHour: number;
  selectedSlots: Set<string>;
  onSlotsChange: (slots: Set<string>) => void;
  disabled?: boolean;
  onDisabledInteraction?: () => void;
}

export default function ChinbaScheduleGrid({
  dates,
  startHour,
  endHour,
  selectedSlots,
  onSlotsChange,
}: ChinbaScheduleGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragAction = useRef<'add' | 'remove'>('add');
  const lastDragKey = useRef<string | null>(null);

  // Time slots
  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let h = startHour; h < endHour; h++) {
      slots.push(`${String(h).padStart(2, '0')}:00`);
      slots.push(`${String(h).padStart(2, '0')}:30`);
    }
    return slots;
  }, [startHour, endHour]);

  // 7열 고정 레이아웃 — 후보일 + 비활성 패딩일 + 클러스터 구분선
  const { columns, isScroll } = useMemo(() => buildChinbaGridLayout(dates), [dates]);
  const gapCount = useMemo(() => columns.filter((c) => c.type === 'gap').length, [columns]);

  const columnInfos = useMemo(
    () =>
      columns.map((col, i) => {
        if (col.type === 'gap') return { key: `gap-${i}`, gap: true as const };
        const dt = new Date(col.dateStr);
        return {
          key: col.dateStr,
          gap: false as const,
          dateStr: col.dateStr,
          selectable: col.selectable,
          label: `${dt.getMonth() + 1}/${dt.getDate()}`,
          day: DAY_LABELS[dt.getDay()],
        };
      }),
    [columns]
  );

  const [cellWidth, setCellWidth] = useState(40);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const calculate = () => {
      const containerWidth = el.clientWidth;
      // 열 폭은 항상 ÷7 고정 — 날짜 수와 무관하게 컨테이너 양끝에 맞춘다
      setCellWidth(
        isScroll
          ? (containerWidth - TIME_LABEL_WIDTH) / 7
          : (containerWidth - TIME_LABEL_WIDTH - gapCount * GAP_COL_WIDTH) / 7
      );
    };
    calculate();
    const observer = new ResizeObserver(calculate);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isScroll, gapCount]);

  const toggleSlot = useCallback((slotKey: string, action: 'add' | 'remove') => {
    const newSlots = new Set(selectedSlots);
    if (action === 'add') {
      newSlots.add(slotKey);
    } else {
      newSlots.delete(slotKey);
    }
    onSlotsChange(newSlots);
  }, [selectedSlots, onSlotsChange]);

  const handlePointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
    dateStr: string,
    time: string,
  ) => {
    const key = getSlotKey(dateStr, time);
    isDragging.current = true;
    dragAction.current = selectedSlots.has(key) ? 'remove' : 'add';
    lastDragKey.current = key;
    toggleSlot(key, dragAction.current);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const element = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
    if (!element) return;
    const cell = element.closest('[data-slot-key]') as HTMLElement | null;
    const key = cell?.dataset.slotKey;
    if (!key || key === lastDragKey.current) return;
    lastDragKey.current = key;
    toggleSlot(key, dragAction.current);
  };

  const handlePointerUp = (event?: ReactPointerEvent<HTMLDivElement>) => {
    isDragging.current = false;
    lastDragKey.current = null;
    if (event) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
  };

  const timeLabelClass = `w-7 shrink-0 ${isScroll ? 'sticky left-0 z-10 bg-white' : ''}`;

  return (
    <div
      ref={gridRef}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`select-none ${isScroll ? 'overflow-x-auto' : 'overflow-hidden'}`}
    >
      <div className="inline-block min-w-full">
        {/* Header */}
        <div className="flex">
          <div className={timeLabelClass} />
          {columnInfos.map((info) =>
            info.gap ? (
              <div
                key={info.key}
                className="shrink-0 flex items-end justify-center pb-1"
                style={{ width: GAP_COL_WIDTH }}
              >
                <span className="text-[10px] text-gray-300">⋯</span>
              </div>
            ) : (
              <div
                key={info.key}
                className="flex flex-col items-center justify-center py-1"
                style={{ width: cellWidth }}
              >
                <span className={`text-[10px] ${info.selectable ? 'text-gray-400' : 'text-gray-300'}`}>
                  {info.day}
                </span>
                <span className={`text-xs font-medium ${info.selectable ? 'text-gray-700' : 'text-gray-300'}`}>
                  {info.label}
                </span>
              </div>
            )
          )}
        </div>

        {/* Grid */}
        {timeSlots.map((time) => {
          const isHourBorder = time.endsWith(':00');
          return (
            <div key={time} className="flex">
              {/* Time label */}
              <div className={`${timeLabelClass} flex items-center justify-start`}>
                {isHourBorder && (
                  <span className="text-[10px] text-gray-400 -mt-2">{parseInt(time)}시</span>
                )}
              </div>
              {/* Cells */}
              {columnInfos.map((info) => {
                if (info.gap) {
                  return (
                    <div
                      key={info.key}
                      className="shrink-0 flex justify-center"
                      style={{ width: GAP_COL_WIDTH, height: 22 }}
                    >
                      <div className="h-full border-l border-dashed border-gray-200" />
                    </div>
                  );
                }
                const hourBorderClass = isHourBorder
                  ? 'border-t border-t-gray-200'
                  : 'border-t border-t-gray-100/50';
                if (!info.selectable) {
                  // 패딩/사이 날짜 — 맥락용 비활성 칸 (선택 불가)
                  return (
                    <div
                      key={`${info.dateStr}-${time}`}
                      className={`shrink-0 border-r border-gray-100 bg-gray-50 ${hourBorderClass}`}
                      style={{ width: cellWidth, height: 22 }}
                    />
                  );
                }
                const key = getSlotKey(info.dateStr, time);
                const isSelected = selectedSlots.has(key);
                return (
                  <div
                    key={key}
                    data-slot-key={key}
                    onPointerDown={(event) => handlePointerDown(event, info.dateStr, time)}
                    className={`shrink-0 flex items-center justify-center border-r border-gray-100 transition-colors cursor-pointer ${
                      isSelected ? 'bg-red-400' : 'bg-white hover:bg-gray-50'
                    } ${hourBorderClass}`}
                    style={{ width: cellWidth, height: 22, touchAction: 'none' }}
                  />
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-3 mt-3">
        <div className="flex items-center gap-1">
          <div className="w-4 h-3 rounded-sm bg-white border border-gray-200" />
          <span className="text-[10px] text-gray-400">가능</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-3 rounded-sm bg-red-400" />
          <span className="text-[10px] text-gray-400">불가능</span>
        </div>
      </div>
    </div>
  );
}
