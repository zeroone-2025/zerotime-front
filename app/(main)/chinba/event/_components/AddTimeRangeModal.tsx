'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import Button from '@/_components/ui/Button';
import Modal from '@/_components/ui/Modal';

import { buildEndOptions, buildStartOptions, toMinutes, type TimeRange } from './chinbaSlotRanges';

interface AddTimeRangeModalProps {
  isOpen: boolean;
  /** "YYYY-MM-DD" — 어느 날짜에 추가하는지 (제목에 표시) */
  dateStr: string;
  dateLabel: string;
  startHour: number;
  endHour: number;
  onSubmit: (range: TimeRange) => void;
  onClose: () => void;
}

function formatDuration(start: string, end: string): string {
  const minutes = toMinutes(end) - toMinutes(start);
  if (minutes <= 0) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

interface TimeColumnProps {
  label: string;
  options: string[];
  value: string;
  onChange: (time: string) => void;
}

/**
 * 시각 목록 한 열.
 *
 * 네이티브 <select>를 안 쓴다 — OS가 그리는 목록(파란 하이라이트·각진 모서리·시스템 폰트)이
 * 앱과 따로 놀아서다. 목록을 직접 그리면 앱 폰트·초록 강조가 그대로 적용된다.
 * 모달 카드가 overflow-hidden이라 띄우는 팝업 대신 자리를 차지하는 스크롤 목록으로 둔다.
 */
function TimeColumn({ label, options, value, onChange }: TimeColumnProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // 열릴 때·값이 바뀔 때 선택된 항목을 가운데로 — 스크롤을 손으로 찾아 내리지 않게
  useEffect(() => {
    const selected = listRef.current?.querySelector('[data-selected="true"]');
    if (selected instanceof HTMLElement && typeof selected.scrollIntoView === 'function') {
      selected.scrollIntoView({ block: 'center' });
    }
  }, [value, options]);

  return (
    <div className="min-w-0 flex-1">
      <p className="mb-1.5 text-center text-[11px] font-medium text-gray-500">{label}</p>
      <div
        ref={listRef}
        role="listbox"
        aria-label={label}
        className="no-scrollbar h-44 snap-y overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-1"
      >
        {options.map((time) => {
          const isSelected = time === value;
          return (
            <button
              key={time}
              type="button"
              role="option"
              aria-selected={isSelected}
              data-selected={isSelected}
              onClick={() => onChange(time)}
              className={`w-full snap-center rounded-lg py-2 text-sm tabular-nums transition-colors ${
                isSelected
                  ? 'bg-emerald-600 font-bold text-white'
                  : 'font-medium text-gray-600 hover:bg-gray-200/70'
              }`}
            >
              {time}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 불가능 시간 구간 하나를 추가하는 모달.
 * 선택지는 이벤트 범위(startHour~endHour) 안으로 제한된다 — 범위 밖 슬롯은 히트맵에서 무시되므로
 * 애초에 만들 수 없게 한다.
 */
export default function AddTimeRangeModal({
  isOpen,
  dateStr,
  dateLabel,
  startHour,
  endHour,
  onSubmit,
  onClose,
}: AddTimeRangeModalProps) {
  const startOptions = useMemo(() => buildStartOptions(startHour, endHour), [startHour, endHour]);
  const [start, setStart] = useState(startOptions[0] ?? '');
  const [end, setEnd] = useState('');

  const endOptions = useMemo(
    () => buildEndOptions(startHour, endHour, start),
    [startHour, endHour, start]
  );

  // 열릴 때마다 기본값으로 되돌린다 — 이전 날짜의 선택이 남아 있으면 헷갈린다
  useEffect(() => {
    if (!isOpen) return;
    const first = startOptions[0] ?? '';
    setStart(first);
    setEnd(buildEndOptions(startHour, endHour, first)[0] ?? '');
  }, [isOpen, dateStr, startOptions, startHour, endHour]);

  // 시작을 늦추면 종료가 그보다 앞설 수 있다 → 유효한 첫 값으로 당긴다
  useEffect(() => {
    if (!end || toMinutes(end) > toMinutes(start)) return;
    setEnd(endOptions[0] ?? '');
  }, [start, end, endOptions]);

  const isValid = !!start && !!end && toMinutes(end) > toMinutes(start);

  const handleSubmit = () => {
    if (!isValid) return;
    onSubmit({ start, end });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${dateLabel} 시간 추가`} maxWidth="max-w-xs">
      <div className="px-5 py-4">
        {/* 고른 결과를 크게 — 목록 두 열만 보면 무엇을 고른 건지 한눈에 안 들어온다 */}
        <div className="mb-3 text-center">
          <p className="text-lg font-bold tabular-nums text-gray-900">
            {start} <span className="text-gray-300">→</span> {end}
          </p>
          <p className="mt-0.5 text-xs font-medium text-emerald-700">{formatDuration(start, end)}</p>
        </div>

        <div className="flex gap-2">
          <TimeColumn label="시작" options={startOptions} value={start} onChange={setStart} />
          <TimeColumn label="종료" options={endOptions} value={end} onChange={setEnd} />
        </div>

        <p className="mt-2 text-center text-[11px] text-gray-400">30분 단위로 선택할 수 있습니다.</p>

        <div className="flex gap-2 pt-3">
          <Button variant="outline" size="md" fullWidth onClick={onClose}>
            취소
          </Button>
          <Button variant="primary" size="md" fullWidth onClick={handleSubmit} disabled={!isValid}>
            추가
          </Button>
        </div>
      </div>
    </Modal>
  );
}
