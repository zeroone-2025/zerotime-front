'use client';

import type { TutorialToastItem } from './useTutorialEngine';

/** 앱 Toast의 마크업을 복제한 튜토리얼 전용 토스트 스택 (실제 ToastContext와 독립) */
export default function TutorialToasts({ toasts }: { toasts: TutorialToastItem[] }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-28 left-1/2 z-[200] flex -translate-x-1/2 flex-col-reverse gap-2">
      {toasts.map((toast) => (
        <div key={toast.id} className="animate-slide-up">
          <div
            className={`max-w-[90vw] whitespace-nowrap rounded-lg px-4 py-2.5 text-sm text-white shadow-lg ${
              toast.type === 'success' ? 'bg-gray-700' : 'bg-gray-900'
            }`}
          >
            {toast.message}
          </div>
        </div>
      ))}
    </div>
  );
}
