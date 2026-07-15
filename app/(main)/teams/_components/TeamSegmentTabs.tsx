'use client';

import type { IconType } from 'react-icons';
import { LuCalendar, LuPencil, LuMedal } from 'react-icons/lu';

export type TeamSegment = 'mannaja' | 'mwoheni' | 'jabahbwa';

interface TeamSegmentTabsProps {
  activeTab: TeamSegment;
  onTabChange: (tab: TeamSegment) => void;
}

const TABS: { key: TeamSegment; label: string; icon: IconType }[] = [
  { key: 'mannaja', label: '일정', icon: LuCalendar },
  { key: 'mwoheni', label: '기록', icon: LuPencil },
  { key: 'jabahbwa', label: '랭킹', icon: LuMedal },
];

export default function TeamSegmentTabs({ activeTab, onTabChange }: TeamSegmentTabsProps) {
  return (
    <div className="flex border-b border-gray-100">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        const Icon = tab.icon;
        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`flex-1 py-3 text-center text-sm font-medium transition-colors relative ${
              isActive
                ? 'text-gray-900 font-bold'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <span className="inline-flex items-center justify-center gap-1.5">
              <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
              {tab.label}
            </span>
            {isActive && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-12 rounded-full bg-gray-900" />
            )}
          </button>
        );
      })}
    </div>
  );
}
