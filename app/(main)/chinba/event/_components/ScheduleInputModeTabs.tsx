'use client';

export type ScheduleInputMode = 'drag' | 'manual';

const TABS: { key: ScheduleInputMode; label: string }[] = [
  { key: 'drag', label: '드래그' },
  { key: 'manual', label: '직접 입력' },
];

interface ScheduleInputModeTabsProps {
  mode: ScheduleInputMode;
  onModeChange: (mode: ScheduleInputMode) => void;
}

/**
 * "내 일정"의 입력 방식 전환. 안내 배너 안 오른쪽에 들어가므로 폭을 차지하지 않는 알약형이다
 * (밑줄형 TeamSegmentTabs는 flex-1로 가로를 다 먹어 배너 안에서 쓸 수 없다).
 */
export default function ScheduleInputModeTabs({ mode, onModeChange }: ScheduleInputModeTabsProps) {
  return (
    <div className="inline-flex shrink-0 rounded-lg bg-white/70 p-0.5" role="group">
      {TABS.map((tab) => {
        const isActive = mode === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onModeChange(tab.key)}
            aria-pressed={isActive}
            className={`rounded-md px-2.5 py-1 text-[11px] whitespace-nowrap transition-colors ${
              isActive
                ? 'bg-white font-bold text-emerald-700 shadow-sm'
                : 'font-medium text-emerald-600/70 hover:text-emerald-700'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
