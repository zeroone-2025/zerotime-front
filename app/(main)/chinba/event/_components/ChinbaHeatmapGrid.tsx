'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import type { ChinbaHeatmapSlot } from '@/_types/chinba';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

interface ChinbaHeatmapGridProps {
  dates: string[];
  heatmap: ChinbaHeatmapSlot[];
  startHour: number;
  endHour: number;
  totalParticipants: number;
}

function getHeatColor(unavailCount: number, total: number): string {
  if (total === 0) return 'bg-gray-50';
  if (unavailCount === 0) return 'bg-emerald-300';
  const ratio = unavailCount / total;
  if (ratio <= 0.25) return 'bg-emerald-200';
  if (ratio <= 0.5) return 'bg-emerald-100';
  if (ratio <= 0.75) return 'bg-red-300';
  if (ratio < 1) return 'bg-red-500';
  return 'bg-red-800';
}

function getTextColor(unavailCount: number, total: number): string {
  if (total === 0) return 'text-gray-300';
  if (unavailCount === 0) return 'text-emerald-700';
  const ratio = unavailCount / total;
  if (ratio <= 0.5) return 'text-gray-700';
  return 'text-white';
}

export default function ChinbaHeatmapGrid({
  dates,
  heatmap,
  startHour,
  endHour,
  totalParticipants,
}: ChinbaHeatmapGridProps) {
  const [tooltip, setTooltip] = useState<{ dt: string; members: string[]; count: number } | null>(null);

  // Build heatmap lookup
  const heatmapMap = useMemo(() => {
    const map = new Map<string, ChinbaHeatmapSlot>();
    for (const slot of heatmap) {
      map.set(slot.dt, slot);
    }
    return map;
  }, [heatmap]);

  // Time slots
  const timeSlots: string[] = [];
  for (let h = startHour; h < endHour; h++) {
    timeSlots.push(`${String(h).padStart(2, '0')}:00`);
    timeSlots.push(`${String(h).padStart(2, '0')}:30`);
  }

  // Date info
  const dateInfos = dates.map((d) => {
    const dt = new Date(d);
    return {
      dateStr: d,
      label: `${dt.getMonth() + 1}/${dt.getDate()}`,
      day: DAY_LABELS[dt.getDay()],
    };
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(40);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const calculate = () => {
      const containerWidth = el.clientWidth;
      // 28px for time label column, remaining space divided by number of dates
      setCellSize(Math.floor((containerWidth - 28) / dates.length));
    };
    calculate();
    const observer = new ResizeObserver(calculate);
    observer.observe(el);
    return () => observer.disconnect();
  }, [dates.length]);

  return (
    <div ref={containerRef} className="overflow-hidden">
      <div className="inline-block min-w-full">
        {/* Header */}
        <div className="flex justify-center">
          <div className="w-6 shrink-0" />
          {dateInfos.map((info) => (
            <div
              key={info.dateStr}
              className="flex flex-col items-center justify-center py-1"
              style={{ width: cellSize }}
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
              const dtKey = `${info.dateStr}T${time}:00`;
              const slot = heatmapMap.get(dtKey);
              const unavailCount = slot?.unavailable_count ?? 0;
              const bgColor = getHeatColor(unavailCount, totalParticipants);
              const txtColor = getTextColor(unavailCount, totalParticipants);
              const isHourBorder = time.endsWith(':00');

              return (
                <div
                  key={dtKey}
                  data-slot-key={dtKey}
                  className={`relative flex items-center justify-center border-r border-gray-100 ${bgColor} ${isHourBorder ? 'border-t border-t-gray-200' : 'border-t border-t-gray-100/50'
                    } cursor-pointer transition-opacity hover:opacity-80`}
                  // 셀 크기 조정
                  style={{ width: cellSize, height: 22 }}
                  onClick={() => {
                    if (slot && slot.unavailable_count > 0) {
                      setTooltip(
                        tooltip?.dt === dtKey
                          ? null
                          : { dt: dtKey, members: slot.unavailable_members, count: slot.unavailable_count }
                      );
                    } else {
                      setTooltip(null);
                    }
                  }}
                >
                  {totalParticipants > 0 && (() => {
                    const availCount = totalParticipants - unavailCount;
                    return availCount > 0 ? (
                      <span className={`text-[9px] font-bold ${txtColor}`}>{availCount}</span>
                    ) : null;
                  })()}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div className="mt-2 mx-2 rounded-lg bg-gray-800 px-3 py-2 text-xs text-white">
          <p className="font-medium mb-1">
            {tooltip.dt.substring(5, 10)} {tooltip.dt.substring(11, 16)} - {tooltip.count}명 불가
          </p>
          <p className="text-gray-300">{tooltip.members.join(', ')}</p>
          <button
            onClick={() => setTooltip(null)}
            className="mt-1 text-[10px] text-gray-400 hover:text-white"
          >
            닫기
          </button>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-2 mt-3 px-2">
        <span className="text-[10px] text-gray-400">가능</span>
        <div className="w-4 h-3 rounded-sm bg-emerald-300" />
        <div className="w-4 h-3 rounded-sm bg-emerald-200" />
        <div className="w-4 h-3 rounded-sm bg-emerald-100" />
        <div className="w-4 h-3 rounded-sm bg-red-300" />
        <div className="w-4 h-3 rounded-sm bg-red-500" />
        <div className="w-4 h-3 rounded-sm bg-red-800" />
        <span className="text-[10px] text-gray-400">불가</span>
      </div>
    </div>
  );
}
