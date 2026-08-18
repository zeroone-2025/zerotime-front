'use client';

import { FiXCircle } from 'react-icons/fi';

import SceneFrame from '../SceneFrame';
import { TutorialTarget } from '../Spotlight';
import type { TutorialEngine } from '../useTutorialEngine';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
// 8월 셋째 주 한 줄만 축약 렌더 (16~22일, 19=오늘, 20·21·22 선택 가능)
const WEEK_DAYS = [16, 17, 18, 19, 20, 21, 22];
const SELECTABLE = new Set([20, 21, 22]);

/** 회장 트랙 5(전반): 일정 잡기 — 이름 타이핑 + 달력 날짜 선택 (TeamEventCreate + DateSelector 재현) */
export default function SceneEventCreate({ engine }: { engine: TutorialEngine }) {
  const { state, dispatch } = engine;
  const canCreate = state.eventTitle.trim().length > 0 && state.eventDates.length >= 2;

  return (
    <SceneFrame title="일정 잡기">
      <div className="mb-5">
        <label className="mb-2 block text-sm font-bold text-gray-700">모임 이름</label>
        <TutorialTarget id="ev-title" engine={engine}>
          <div className="relative">
            <input
              type="text"
              value={state.eventTitle}
              onChange={(e) => dispatch({ type: 'SET_EVENT_TITLE', value: e.target.value })}
              placeholder="예: 조별과제 회의, 동아리 정기모임"
              maxLength={100}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 pr-10 text-sm text-gray-800 placeholder-gray-400 outline-none transition-colors focus:border-gray-900"
            />
            {state.eventTitle.length > 0 && (
              <button
                type="button"
                onClick={() => dispatch({ type: 'SET_EVENT_TITLE', value: '' })}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 transition-colors hover:text-gray-500"
              >
                <FiXCircle size={18} />
              </button>
            )}
          </div>
        </TutorialTarget>
      </div>

      <div className="mb-5">
        <label className="mb-1 block text-sm font-bold text-gray-700">날짜 선택</label>
        <p className="mb-2 text-xs text-gray-400">후보 날짜를 클릭하거나 드래그하여 선택하세요</p>
        <TutorialTarget id="ev-dates" engine={engine}>
          <div className="mx-auto w-full max-w-[26rem] p-1">
            <div className="mb-2 flex items-center justify-center">
              <span className="text-sm font-bold text-gray-800">2026년 8월</span>
            </div>
            <div className="mb-1 grid grid-cols-7">
              {DAY_LABELS.map((d) => (
                <div
                  key={d}
                  className="flex h-8 items-center justify-center text-[11px] font-medium text-gray-400"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {WEEK_DAYS.map((day) => {
                const selectable = SELECTABLE.has(day);
                const selected = state.eventDates.includes(day);
                const isToday = day === 19;
                return (
                  <button
                    key={day}
                    type="button"
                    disabled={!selectable}
                    onClick={() => dispatch({ type: 'TOGGLE_DATE', day })}
                    className={`flex aspect-square items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                      selected
                        ? 'bg-gray-900 text-white'
                        : isToday
                          ? 'bg-blue-50 text-blue-700'
                          : selectable
                            ? 'text-gray-700 hover:bg-gray-100'
                            : 'cursor-default text-gray-200'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
            {state.eventDates.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {state.eventDates.map((day) => (
                  <span
                    key={day}
                    className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600"
                  >
                    8/{day}({DAY_LABELS[new Date(2026, 7, day).getDay()]})
                    <span className="ml-0.5 text-gray-400">&times;</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </TutorialTarget>
      </div>

      <div className="border-t border-gray-100 pt-3">
        <TutorialTarget id="ev-create" engine={engine}>
          <div
            className={`w-full rounded-xl py-3 text-center text-base font-semibold text-white ${
              canCreate ? 'bg-gray-900' : 'bg-gray-300'
            }`}
          >
            만들기
          </div>
        </TutorialTarget>
      </div>
    </SceneFrame>
  );
}
