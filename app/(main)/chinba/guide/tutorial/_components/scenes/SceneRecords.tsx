'use client';

import { LuCalendar, LuClock } from 'react-icons/lu';

import ClubShell from '../ClubShell';
import { TutorialTarget } from '../Spotlight';
import type { TutorialEngine } from '../useTutorialEngine';

/** 동아리 상세 기록 탭 — 방금 작성한 기록이 카드로 쌓인 모습 (ActivityCard 재현) */
export default function SceneRecords({ engine }: { engine: TutorialEngine }) {
  const { state } = engine;
  const amount = state.record.amount.replace(/,/g, '');

  return (
    <ClubShell engine={engine} tab="mwoheni">
      <TutorialTarget id="rec-card" engine={engine}>
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-bold text-gray-800">{state.record.title || '활동 기록'}</p>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-400">
                <span className="inline-flex items-center gap-0.5">
                  <LuCalendar size={11} /> 2026-08-20
                </span>
                <span className="inline-flex items-center gap-0.5">
                  <LuClock size={11} /> 18:00~19:00
                </span>
              </div>
            </div>
            <span className="shrink-0 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-500">
              1조
            </span>
          </div>
          {state.record.desc && <p className="mt-2 text-xs text-gray-600">{state.record.desc}</p>}
          <div className="mt-2 flex items-center gap-2">
            {amount && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2.5 py-1 text-xs text-gray-600">
                💸 {Number(amount).toLocaleString()}원
              </span>
            )}
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
              기록: 홍길동
            </span>
          </div>
        </div>
      </TutorialTarget>
    </ClubShell>
  );
}
