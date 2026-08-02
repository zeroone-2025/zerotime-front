'use client';

import { useEffect, useMemo, useState } from 'react';

import Button from '@/_components/ui/Button';
import Modal from '@/_components/ui/Modal';

import {
  buildEndOptions,
  buildStartOptions,
  toMinutes,
  type TimeRange,
} from './chinbaSlotRanges';

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

const SELECT_CLASS =
  'w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-900 bg-white';

/**
 * 불가능 시간 구간 하나를 추가하는 모달.
 * 30분 눈금 단일 select 두 개 — 시/분을 나누지 않는 이유는 분이 00/30 두 가지뿐이기 때문.
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
      <div className="space-y-3 px-5 py-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="range-start">
            시작
          </label>
          <select
            id="range-start"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className={SELECT_CLASS}
          >
            {startOptions.map((time) => (
              <option key={time} value={time}>
                {time}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="range-end">
            종료
          </label>
          <select
            id="range-end"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className={SELECT_CLASS}
          >
            {endOptions.map((time) => (
              <option key={time} value={time}>
                {time}
              </option>
            ))}
          </select>
        </div>

        <p className="text-[11px] text-gray-400">30분 단위로 선택할 수 있습니다.</p>

        <div className="flex gap-2 pt-1">
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
