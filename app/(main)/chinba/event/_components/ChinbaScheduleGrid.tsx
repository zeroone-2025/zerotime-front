'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

// 넓은 화면(데스크톱)에서 날짜 열이 무한정 넓어지지 않도록 셀 폭 상한
const MAX_CELL_WIDTH = 64;

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
  const [, forceUpdate] = useState(0);

  // Time slots
  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let h = startHour; h < endHour; h++) {
      slots.push(`${String(h).padStart(2, '0')}:00`);
      slots.push(`${String(h).padStart(2, '0')}:30`);
    }
    return slots;
  }, [startHour, endHour]);

  // Date info
  const dateInfos = useMemo(() => dates.map((d) => {
    const dt = new Date(d);
    return {
      dateStr: d,
      label: `${dt.getMonth() + 1}/${dt.getDate()}`,
      day: DAY_LABELS[dt.getDay()],
    };
  }), [dates]);

  const [cellWidth, setCellWidth] = useState(40);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const calculate = () => {
      const containerWidth = el.clientWidth;
      // 28px for time label column, remaining space divided by number of dates
      setCellWidth(Math.min(Math.floor((containerWidth - 28) / dates.length), MAX_CELL_WIDTH));
    };
    calculate();
    const observer = new ResizeObserver(calculate);
    observer.observe(el);
    return () => observer.disconnect();
  }, [dates.length]);

  const toggleSlot = useCallback((slotKey: string, action: 'add' | 'remove') => {
    const newSlots = new Set(selectedSlots);
    if (action === 'add') {
      newSlots.add(slotKey);
    } else {
      newSlots.delete(slotKey);
    }
    onSlotsChange(newSlots);
  }, [selectedSlots, onSlotsChange]);

  const getSlotKey = (dateStr: string, time: string) => `${dateStr}T${time}:00`;

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

  return (
    <div
      ref={gridRef}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="overflow-hidden select-none"
    >
      <div className="inline-block min-w-full">
        {/* Header */}
        <div className="flex justify-center">
          <div className="w-7 shrink-0" />
          {dateInfos.map((info) => (
            <div
              key={info.dateStr}
              className="flex flex-col items-center justify-center py-1"
              style={{ width: cellWidth }}
            >
              <span className="text-[10px] text-gray-400">{info.day}</span>
              <span className="text-xs font-medium text-gray-700">{info.label}</span>
            </div>
          ))}
        </div>

        {/* Grid */}
        {timeSlots.map((time) => (
          <div key={time} className="flex justify-center">
            {/* Time label */}
            <div className="w-7 shrink-0 flex items-center justify-start">
              {time.endsWith(':00') && (
                <span className="text-[10px] text-gray-400 -mt-2">{parseInt(time)}시</span>
              )}
            </div>
            {/* Cells */}
            {dateInfos.map((info) => {
              const key = getSlotKey(info.dateStr, time);
              const isSelected = selectedSlots.has(key);
              const isHourBorder = time.endsWith(':00');

              return (
                <div
                  key={key}
                  data-slot-key={key}
                  onPointerDown={(event) => handlePointerDown(event, info.dateStr, time)}
                  className={`flex items-center justify-center border-r border-gray-100 transition-colors cursor-pointer ${isSelected ? 'bg-red-400' : 'bg-white hover:bg-gray-50'
                    } ${isHourBorder ? 'border-t border-t-gray-200' : 'border-t border-t-gray-100/50'
                    }`}
                  // 셀 크기 조정
                  style={{ width: cellWidth, height: 22, touchAction: 'none' }}
                />
              );
            })}
          </div>
        ))}
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
