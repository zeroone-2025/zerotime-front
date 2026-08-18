'use client';

import { FiX } from 'react-icons/fi';

interface TutorialChromeProps {
  trackLabel: string;
  stepIndex: number;
  totalSteps: number;
  onExit: () => void;
}

/** 튜토리얼 상단 고정 바 — 진행바 + 나가기. 스포트라이트(z-80)보다 위(z-100)라 항상 조작 가능 */
export default function TutorialChrome({
  trackLabel,
  stepIndex,
  totalSteps,
  onExit,
}: TutorialChromeProps) {
  const progress = totalSteps === 0 ? 0 : Math.min((stepIndex / totalSteps) * 100, 100);
  return (
    <div className="relative z-[100] shrink-0 border-b border-gray-100 bg-white px-4 py-3">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-500">{trackLabel}</p>
          <div className="flex items-center gap-3">
            <p className="text-xs font-semibold text-gray-500">
              {Math.min(stepIndex + 1, totalSteps)} / {totalSteps}
            </p>
            <button
              type="button"
              onClick={onExit}
              className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <FiX size={13} />
              나가기
            </button>
          </div>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-blue-500"
            style={{ width: `${progress}%`, transition: 'width 280ms cubic-bezier(0.22, 1, 0.36, 1)' }}
          />
        </div>
      </div>
    </div>
  );
}
