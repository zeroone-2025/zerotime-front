'use client';

import { FiPlus } from 'react-icons/fi';
import { LuCalendar } from 'react-icons/lu';

import ClubShell from '../ClubShell';
import { TutorialTarget } from '../Spotlight';
import type { TutorialEngine } from '../useTutorialEngine';

/** 동아리 상세 홈(일정 탭) — 초대·조 편성 진입, 일정 만들기, 기능 투어의 배경 화면 */
export default function SceneClubHome({ engine }: { engine: TutorialEngine }) {
  const { state } = engine;
  const hasEvent = state.eventTitle.trim().length > 0 && state.eventDates.length > 0;

  return (
    <ClubShell engine={engine} tab="mannaja">
      {!state.groupSaved && (
        <div className="mb-4 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-4">
          <p className="text-sm font-bold text-emerald-800">동아리 준비 2단계</p>
          <p className="mt-1 text-xs leading-relaxed text-emerald-700">
            ① 초대링크로 회원을 초대하세요 → ② 조를 편성하세요
          </p>
        </div>
      )}

      {hasEvent ? (
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LuCalendar size={16} className="text-gray-400" />
              <p className="text-sm font-bold text-gray-800">{state.eventTitle}</p>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                state.eventCompleted
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-blue-50 text-blue-600'
              }`}
            >
              {state.eventCompleted ? '완료됨' : '진행중'}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-400">
            8/20(목) ~ 8/21(금) · {state.submissions.length}/{state.members.length} 제출
          </p>
        </div>
      ) : (
        <>
          <TutorialTarget id="home-create-event" engine={engine}>
            <div className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-3 text-sm font-medium text-gray-500">
              <FiPlus size={16} />
              일정 잡기
            </div>
          </TutorialTarget>
          <div className="py-10 text-center">
            <p className="text-sm text-gray-400">아직 잡은 일정이 없어요</p>
            <p className="mt-1 text-xs text-gray-300">일정을 만들면 여기에 쌓입니다</p>
          </div>
        </>
      )}
    </ClubShell>
  );
}
