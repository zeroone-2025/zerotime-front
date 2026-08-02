'use client';

import type { IconType } from 'react-icons';
import { FiClock, FiEdit2 } from 'react-icons/fi';

export type ScheduleInputMode = 'drag' | 'manual';

const TABS: { key: ScheduleInputMode; label: string; icon: IconType }[] = [
  { key: 'drag', label: '드래그', icon: FiEdit2 },
  { key: 'manual', label: '직접 입력', icon: FiClock },
];

interface ScheduleInputModeTabsProps {
  mode: ScheduleInputMode;
  onModeChange: (mode: ScheduleInputMode) => void;
}

/** "내 일정"의 입력 방식 전환. 스타일은 teams/TeamSegmentTabs의 밑줄형 세그먼트와 맞춘다. */
export default function ScheduleInputModeTabs({ mode, onModeChange }: ScheduleInputModeTabsProps) {
  return (
    <div className="flex border-b border-gray-100">
      {TABS.map((tab) => {
        const isActive = mode === tab.key;
        const Icon = tab.icon;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onModeChange(tab.key)}
            aria-pressed={isActive}
            className={`relative flex-1 py-2.5 text-center text-[13px] font-medium transition-colors ${
              isActive ? 'font-bold text-gray-900' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <span className="inline-flex items-center justify-center gap-1.5">
              <Icon size={14} />
              {tab.label}
            </span>
            {isActive && (
              <span className="absolute bottom-0 left-1/2 h-0.5 w-12 -translate-x-1/2 rounded-full bg-gray-900" />
            )}
          </button>
        );
      })}
    </div>
  );
}
