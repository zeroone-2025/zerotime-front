'use client';

import { useState, useCallback, useRef } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

interface DateSelectorProps {
  selectedDates: string[];
  onChange: (dates: string[]) => void;
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return { firstDay, daysInMonth };
}

export default function DateSelector({ selectedDates, onChange }: DateSelectorProps) {
  const today = new Date();
  const todayStr = formatDate(today.getFullYear(), today.getMonth(), today.getDate());

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  // Drag state
  const isDragging = useRef(false);
  const dragAction = useRef<'add' | 'remove'>('add');

  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1);
      setViewMonth(11);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear(viewYear + 1);
      setViewMonth(0);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const isPastDate = (dateStr: string) => dateStr < todayStr;

  const toggleDate = useCallback(
    (dateStr: string, action?: 'add' | 'remove') => {
      if (isPastDate(dateStr)) return;
      const act = action || (selectedDates.includes(dateStr) ? 'remove' : 'add');
      if (act === 'add' && !selectedDates.includes(dateStr)) {
        onChange([...selectedDates, dateStr].sort());
      } else if (act === 'remove' && selectedDates.includes(dateStr)) {
        onChange(selectedDates.filter((d) => d !== dateStr));
      }
    },
    [selectedDates, onChange]
  );

  const handlePointerDown = (dateStr: string) => {
    if (isPastDate(dateStr)) return;
    isDragging.current = true;
    dragAction.current = selectedDates.includes(dateStr) ? 'remove' : 'add';
    toggleDate(dateStr, dragAction.current);
  };

  const handlePointerEnter = (dateStr: string) => {
    if (!isDragging.current || isPastDate(dateStr)) return;
    toggleDate(dateStr, dragAction.current);
  };

  const handlePointerUp = () => {
    isDragging.current = false;
  };

  const { firstDay, daysInMonth } = getMonthDays(viewYear, viewMonth);

  // Can't go before current month
  const canGoPrev = viewYear > today.getFullYear() || (viewYear === today.getFullYear() && viewMonth > today.getMonth());

  const cells = [];
  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    cells.push(<div key={`empty-${i}`} className="aspect-square" />);
  }
  // Day cells
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = formatDate(viewYear, viewMonth, day);
    const isSelected = selectedDates.includes(dateStr);
    const isPast = isPastDate(dateStr);
    const isToday = dateStr === todayStr;

    cells.push(
      <div
        key={dateStr}
        onPointerDown={() => handlePointerDown(dateStr)}
        onPointerEnter={() => handlePointerEnter(dateStr)}
        className={`aspect-square flex items-center justify-center rounded-lg text-sm font-medium select-none transition-colors cursor-pointer ${
          isPast
            ? 'text-gray-200 cursor-default'
            : isSelected
            ? 'bg-gray-900 text-white'
            : isToday
            ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
        style={{ touchAction: 'none' }}
      >
        {day}
      </div>
    );
  }

  return (
    <div
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      className="select-none mx-auto w-full max-w-[26rem]"
    >
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={goToPrevMonth}
          disabled={!canGoPrev}
          className="p-1.5 rounded-full hover:bg-gray-100 disabled:opacity-30 disabled:cursor-default transition-colors"
        >
          <FiChevronLeft size={18} />
        </button>
        <span className="text-sm font-bold text-gray-800">
          {viewYear}년 {viewMonth + 1}월
        </span>
        <button
          onClick={goToNextMonth}
          className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
        >
          <FiChevronRight size={18} />
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((label) => (
          <div key={label} className="flex items-center justify-center h-8 text-[11px] font-medium text-gray-400">
            {label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells}
      </div>

      {/* Selected dates summary */}
      {selectedDates.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {selectedDates.map((d) => {
            const dt = new Date(d);
            const dayOfWeek = DAY_LABELS[dt.getDay()];
            return (
              <button
                key={d}
                onClick={() => toggleDate(d, 'remove')}
                className="inline-flex items-center gap-0.5 px-2 py-1 rounded-full bg-gray-100 text-xs text-gray-600 hover:bg-gray-200 transition-colors"
              >
                {dt.getMonth() + 1}/{dt.getDate()}({dayOfWeek})
                <span className="text-gray-400 ml-0.5">&times;</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
