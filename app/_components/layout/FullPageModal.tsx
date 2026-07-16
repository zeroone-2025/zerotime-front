'use client';

import { useEffect, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { LuChevronLeft } from 'react-icons/lu';

interface FullPageModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  mode?: 'inline' | 'overlay';
  showBackButton?: boolean;
  headerRight?: ReactNode;
}

export default function FullPageModal({
  isOpen,
  onClose,
  title,
  children,
  mode = 'inline',
  showBackButton = true,
  headerRight,
}: FullPageModalProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (mode !== 'overlay' || !isOpen || typeof document === 'undefined') return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const modalContent = (
    <div className="flex-1 h-full min-h-0 flex flex-col animate-fadeIn bg-white">
      {/* 헤더 */}
      <div className="shrink-0 px-4 pb-3">
        <div className="pt-safe md:pt-0" />
        <div className="relative mt-4 flex items-center justify-center md:mt-4">
          {showBackButton && (
            <button
              onClick={onClose}
              className="absolute left-0 z-10 group -ml-1 rounded-full p-2 text-gray-600 transition-all hover:bg-gray-100 hover:text-gray-900 active:scale-95"
              aria-label="뒤로가기"
            >
              <LuChevronLeft size={24} strokeWidth={2.5} className="transition-transform group-hover:-translate-x-0.5" />
            </button>
          )}
          <h1 className="text-base font-bold text-gray-800">{title}</h1>
          {headerRight && (
            <div className="absolute right-0 z-10">{headerRight}</div>
          )}
        </div>
      </div>
      {/* 컨텐츠 영역 */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">{children}</div>
    </div>
  );

  if (mode === 'inline') {
    return modalContent;
  }

  if (!isMounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] bg-white">
      <div className="mx-auto flex h-full w-full max-w-md md:max-w-[56rem]">
        <div className="flex h-full w-full min-w-0 flex-1 flex-col border-x border-gray-100 bg-white shadow-xl md:shadow-none">
          {modalContent}
        </div>
      </div>
    </div>,
    document.body,
  );
}
