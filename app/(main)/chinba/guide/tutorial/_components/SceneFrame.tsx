'use client';

import type { ReactNode } from 'react';

import { LuChevronLeft } from 'react-icons/lu';

interface SceneFrameProps {
  title?: ReactNode;
  headerRight?: ReactNode;
  showBack?: boolean;
  children: ReactNode;
}

/**
 * 풀페이지 장면 프레임 — 실제 FullPageModal(inline) 헤더 구조를 재현한다.
 * 주의: transform/filter/opacity를 걸면 안 된다 — 스포트라이트 z-승격이 깨진다.
 */
export default function SceneFrame({
  title,
  headerRight,
  showBack = true,
  children,
}: SceneFrameProps) {
  return (
    <div className="flex min-h-full flex-col bg-white">
      {title !== undefined && (
        <div className="shrink-0 px-4 pb-3 pt-4">
          <div className="relative flex items-center justify-center">
            {showBack && (
              <span className="absolute left-0 -ml-1 rounded-full p-2 text-gray-600">
                <LuChevronLeft size={24} strokeWidth={2.5} />
              </span>
            )}
            <h1 className="text-base font-bold text-gray-800">{title}</h1>
            {headerRight && <div className="absolute right-0">{headerRight}</div>}
          </div>
        </div>
      )}
      <div className="flex-1 px-4 pb-8">{children}</div>
    </div>
  );
}
