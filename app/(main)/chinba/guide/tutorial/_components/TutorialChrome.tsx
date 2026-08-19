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
      {/* 나가기는 진행 정보(max-w-md)와 분리해 바 오른쪽 끝에 고정 */}
      <button
        type="button"
        onClick={onExit}
        className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-full bg-red-500 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-red-600"
      >
        <FiX size={13} />
        나가기
      </button>
      <div className="mx-auto w-full max-w-md pr-20 sm:pr-0">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-500">{trackLabel}</p>
          <p className="text-xs font-semibold text-gray-500">
            {Math.min(stepIndex + 1, totalSteps)} / {totalSteps}
          </p>
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
