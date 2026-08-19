'use client';

import type { ReactNode } from 'react';

import { FiSettings } from 'react-icons/fi';
import { LuCalendar, LuChevronDown, LuPencil } from 'react-icons/lu';

import FakeOpsPanel from './FakeOpsPanel';
import { TutorialTarget } from './Spotlight';
import type { TutorialEngine } from './useTutorialEngine';

interface ClubShellProps {
  engine: TutorialEngine;
  tab: 'mannaja' | 'mwoheni';
  children: ReactNode;
}

/**
 * 동아리 상세 화면(TeamDetailView)의 튜토리얼 판 —
 * 헤더(동아리명 + 설정 톱니) + 탭(일정|기록) + 본문 + 우측 운영 패널.
 */
export default function ClubShell({ engine, tab, children }: ClubShellProps) {
  const { state } = engine;
  return (
    <div className="flex min-h-full flex-col bg-white">
      {/* 헤더 */}
      <div className="shrink-0 px-4 pb-3 pt-4">
        <div className="relative flex items-center justify-center">
          <span className="inline-flex items-center gap-1 text-base font-bold text-gray-800">
            {state.clubName || '동아리'}
            <LuChevronDown size={16} className="text-gray-400" />
          </span>
          <div className="absolute right-0">
            <TutorialTarget id="club-gear" engine={engine}>
              <span className="block rounded-full p-2 text-gray-500">
                <FiSettings size={18} />
              </span>
            </TutorialTarget>
          </div>
        </div>
      </div>

      {/* 본문 + 운영 패널 */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="min-w-0 flex-1">
          {/* 탭 */}
          <div className="flex border-b border-gray-100">
            {(
              [
                { key: 'mannaja', label: '일정', icon: LuCalendar },
                { key: 'mwoheni', label: '기록', icon: LuPencil },
              ] as const
            ).map(({ key, label, icon: Icon }) => {
              const isActive = tab === key;
              return (
                <div
                  key={key}
                  className={`relative flex-1 py-3 text-center text-sm transition-colors ${
                    isActive ? 'font-bold text-gray-900' : 'font-medium text-gray-400'
                  }`}
                >
                  <span className="inline-flex items-center justify-center gap-1.5">
                    <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                    {label}
                  </span>
                  {isActive && (
                    <span className="absolute bottom-0 left-1/2 h-0.5 w-12 -translate-x-1/2 rounded-full bg-gray-900" />
                  )}
                </div>
              );
            })}
          </div>
          <div className="px-4 py-4">{children}</div>
        </div>

        <FakeOpsPanel engine={engine} />
      </div>
    </div>
  );
}
