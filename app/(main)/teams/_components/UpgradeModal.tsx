'use client';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: number;
  terminology?: 'team' | 'club';
  onConfirm?: () => void;
}

const PREMIUM_FEATURES = [
  { label: '기록', description: '조별 활동을 기록하고 공유' },
  { label: '랭킹', description: '조별 활동 데이터를 비교·분석·랭킹' },
];

export default function UpgradeModal({ isOpen, onClose, onConfirm }: UpgradeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-[85%] max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        <div className="text-center mb-5">
          <div className="mb-2 flex justify-center">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-xl">
              &#x2B50;
            </span>
          </div>
          <p className="text-base font-bold text-gray-900">지금은 무료 이벤트 기간!</p>
          <p className="mt-1 text-xs text-gray-500">
            아래 기능을 지금 무료로 이용할 수 있어요
          </p>
        </div>

        {/* Feature list */}
        <div className="mb-5 space-y-2.5">
          {PREMIUM_FEATURES.map((feature) => (
            <div key={feature.label} className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-500 text-[10px] text-white">
                &#x2713;
              </span>
              <div>
                <p className="text-sm font-medium text-gray-800">{feature.label}</p>
                <p className="text-xs text-gray-400">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 active:scale-95 transition-all"
          >
            닫기
          </button>
          <button
            onClick={() => {
              onClose();
              onConfirm?.();
            }}
            className="flex-1 rounded-xl bg-blue-500 py-3 text-sm font-semibold text-white hover:bg-blue-600 active:scale-95 transition-all"
          >
            무료로 시작하기
          </button>
        </div>
      </div>
    </div>
  );
}
