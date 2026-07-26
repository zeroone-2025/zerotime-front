'use client';

import { useMemo, useState, useRef, useEffect } from 'react';

import type { ChinbaHeatmapSlot } from '@/_types/chinba';

import { buildChinbaGridLayout } from './chinbaGridColumns';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

// ChinbaScheduleGrid와 동일 — 탭 전환 시 두 그리드 폭이 일치해야 한다
const TIME_LABEL_WIDTH = 28;
const GAP_COL_WIDTH = 16;

interface ChinbaHeatmapGridProps {
  dates: string[];
  heatmap: ChinbaHeatmapSlot[];
  startHour: number;
  endHour: number;
  totalParticipants: number;
}

// 전원 불가: red-500 바탕 + 회색 사선 빗금
const FULL_UNAVAIL_BG =
  'bg-[repeating-linear-gradient(45deg,#ef4444_0px,#ef4444_9px,#d1d5db_9px,#d1d5db_10px)]';

function getHeatColor(unavailCount: number, total: number): string {
  if (total === 0) return 'bg-gray-50';
  if (unavailCount === 0) return 'bg-[#21a278]';
  const ratio = unavailCount / total;
  if (ratio <= 0.25) return 'bg-[#41b47e]';
  if (ratio <= 0.5) return 'bg-[#62c784]';
  if (ratio <= 0.75) return 'bg-[#a3ec8f]';
  if (ratio < 1) return 'bg-[#c4fe95]';
  return FULL_UNAVAIL_BG;
}

function getTextColor(unavailCount: number, total: number): string {
  if (total === 0) return 'text-gray-300';
  return 'text-gray-800';
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

  // 7열 고정 레이아웃 — ChinbaScheduleGrid(내 일정)와 동일한 열 구성
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

  const containerRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(40);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const calculate = () => {
      const containerWidth = el.clientWidth;
      // 열 폭은 항상 ÷7 고정 — 날짜 수와 무관하게 컨테이너 양끝에 맞춘다
      setCellSize(
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

  const timeLabelClass = `w-7 shrink-0 ${isScroll ? 'sticky left-0 z-10 bg-white' : ''}`;

  return (
    <div ref={containerRef} className={isScroll ? 'overflow-x-auto' : 'overflow-hidden'}>
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
                style={{ width: cellSize }}
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
                  // 패딩/사이 날짜 — 맥락용 비활성 칸 (히트맵 없음)
                  return (
                    <div
                      key={`${info.dateStr}-${time}`}
                      className={`shrink-0 border-r border-gray-100 bg-gray-50 ${hourBorderClass}`}
                      style={{ width: cellSize, height: 22 }}
                    />
                  );
                }
                const dtKey = `${info.dateStr}T${time}:00`;
                const slot = heatmapMap.get(dtKey);
                const unavailCount = slot?.unavailable_count ?? 0;
                const bgColor = getHeatColor(unavailCount, totalParticipants);
                const txtColor = getTextColor(unavailCount, totalParticipants);

                return (
                  <div
                    key={dtKey}
                    data-slot-key={dtKey}
                    className={`shrink-0 relative flex items-center justify-center border-r border-gray-100 ${bgColor} ${hourBorderClass} cursor-pointer transition-opacity hover:opacity-80`}
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
          );
        })}
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
        <div className="w-4 h-3 rounded-sm bg-[#21a278]" />
        <div className="w-4 h-3 rounded-sm bg-[#41b47e]" />
        <div className="w-4 h-3 rounded-sm bg-[#62c784]" />
        <div className="w-4 h-3 rounded-sm bg-[#a3ec8f]" />
        <div className="w-4 h-3 rounded-sm bg-[#c4fe95]" />
        <div className={`w-4 h-3 rounded-sm ${FULL_UNAVAIL_BG}`} />
        <span className="text-[10px] text-gray-400">불가</span>
      </div>
    </div>
  );
}
