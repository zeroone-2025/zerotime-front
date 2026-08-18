'use client';

import type { ReactNode } from 'react';

interface TutorialConfirmModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
}

/**
 * ConfirmModal 마크업 복제판 — 튜토리얼 스포트라이트(z-80)·크롬(z-100) 위에
 * 떠야 해서 z-[110]으로 올린 것만 다르다. 백드롭이 클릭 게이팅을 대신한다.
 */
export default function TutorialConfirmModal({
  isOpen,
  onConfirm,
  onCancel,
  title,
  children,
  confirmLabel = '확인',
  cancelLabel = '취소',
}: TutorialConfirmModalProps) {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40"
      onClick={onCancel}
    >
      <div
        className="w-[80%] max-w-xs rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {title && <h3 className="mb-2 text-center text-base font-semibold text-gray-900">{title}</h3>}
        <div className="text-center text-sm text-gray-600">{children}</div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50 active:scale-95"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white transition-all hover:bg-gray-800 active:scale-95"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
