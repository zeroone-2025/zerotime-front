'use client';

import type { ReactNode } from 'react';

interface SpeechBubbleProps {
  content: ReactNode;
  placement: 'top' | 'bottom' | 'left' | 'right';
  align?: 'center' | 'right';
  /** 오버레이 클릭 시 증가 — key 리마운트로 fadeIn 재생해 시선 유도 */
  nudgeKey: number;
  showNext?: boolean;
  nextEnabled?: boolean;
  onNext?: () => void;
}

/**
 * 클릭 유도 말풍선 — ClubSwitcher의 1회성 힌트 말풍선 마크업을 재현.
 * 부모(TutorialTarget)가 relative인 것을 전제로 absolute 배치한다.
 */
export default function SpeechBubble({
  content,
  placement,
  align = 'center',
  nudgeKey,
  showNext = false,
  nextEnabled = true,
  onNext,
}: SpeechBubbleProps) {
  let positionClass = '';
  let arrowClass = '';
  const horizontal = align === 'right' ? 'right-0' : 'left-1/2 -translate-x-1/2';
  const arrowHorizontal = align === 'right' ? 'right-4' : 'left-1/2 -translate-x-1/2';

  switch (placement) {
    case 'bottom':
      positionClass = `absolute top-full z-[95] mt-3 ${horizontal}`;
      arrowClass = `absolute -top-1 h-2 w-2 rotate-45 bg-gray-900 ${arrowHorizontal}`;
      break;
    case 'top':
      positionClass = `absolute bottom-full z-[95] mb-3 ${horizontal}`;
      arrowClass = `absolute -bottom-1 h-2 w-2 rotate-45 bg-gray-900 ${arrowHorizontal}`;
      break;
    case 'left':
      positionClass = 'absolute right-full top-1/2 z-[95] mr-3 -translate-y-1/2';
      arrowClass = 'absolute -right-1 top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 bg-gray-900';
      break;
    case 'right':
      positionClass = 'absolute left-full top-1/2 z-[95] ml-3 -translate-y-1/2';
      arrowClass = 'absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 bg-gray-900';
      break;
  }

  return (
    <div key={nudgeKey} className={`${positionClass} animate-fadeIn`}>
      <div className="relative w-max max-w-[17rem] rounded-lg bg-gray-900 px-3.5 py-2.5 text-xs font-medium leading-relaxed text-white shadow-lg">
        <div>{content}</div>
        {showNext && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNext?.();
            }}
            disabled={!nextEnabled}
            className="mt-2 w-full rounded-md bg-white px-3 py-1.5 text-xs font-bold text-gray-900 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            다음
          </button>
        )}
        <div className={arrowClass} />
      </div>
    </div>
  );
}
