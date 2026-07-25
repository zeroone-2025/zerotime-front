'use client';

interface MemberActionBarProps {
  nickname: string;
  isLeader: boolean;
  onSetLeader: () => void;
  onMove: () => void;
  onUnassign: () => void;
  onClose: () => void;
}

export default function MemberActionBar({
  nickname,
  isLeader,
  onSetLeader,
  onMove,
  onUnassign,
  onClose,
}: MemberActionBarProps) {
  // 바닥에 붙으면 잘 안 보여서 safe-area 위로 12px 더 띄운 카드형 바
  return (
    <div className="shrink-0 mx-3 mb-[calc(env(safe-area-inset-bottom)+0.75rem)] rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-800">{nickname}</span>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          닫기
        </button>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSetLeader}
          disabled={isLeader}
          className={`flex-1 rounded-xl py-2.5 text-xs font-medium transition-all active:scale-95 ${
            isLeader
              ? 'bg-gray-100 text-gray-400'
              : 'bg-gray-900 text-white hover:bg-gray-800'
          }`}
        >
          조장 지정
        </button>
        <button
          type="button"
          onClick={onMove}
          className="flex-1 rounded-xl border border-gray-200 py-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-all active:scale-95"
        >
          이동
        </button>
        <button
          type="button"
          onClick={onUnassign}
          className="flex-1 rounded-xl border border-gray-200 py-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-all active:scale-95"
        >
          미배정으로
        </button>
      </div>
    </div>
  );
}
