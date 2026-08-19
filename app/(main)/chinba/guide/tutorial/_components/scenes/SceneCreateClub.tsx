'use client';

import { FiXCircle } from 'react-icons/fi';

import SceneFrame from '../SceneFrame';
import { TutorialTarget } from '../Spotlight';
import type { TutorialEngine } from '../useTutorialEngine';

const CATEGORY_OPTIONS = ['동아리', '학과', '스터디', '연구실', '학회', '기타'];

/** 회장 트랙 1: 동아리 만들기 (TeamCreateView 재현 — 이름은 실제 타이핑) */
export default function SceneCreateClub({ engine }: { engine: TutorialEngine }) {
  const { state, dispatch } = engine;
  return (
    <SceneFrame title="동아리 만들기">
      <div className="mb-6">
        <label className="mb-2 block text-sm font-bold text-gray-700">동아리 이름</label>
        <TutorialTarget id="cc-name" engine={engine}>
          <div className="relative">
            <input
              type="text"
              value={state.clubName}
              onChange={(e) => dispatch({ type: 'SET_CLUB_NAME', value: e.target.value })}
              placeholder="예: 코딩 동아리, 졸업 프로젝트"
              maxLength={50}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 pr-10 text-sm text-gray-800 placeholder-gray-400 outline-none transition-colors focus:border-gray-900"
            />
            {state.clubName.length > 0 && (
              <button
                type="button"
                onClick={() => dispatch({ type: 'SET_CLUB_NAME', value: '' })}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 transition-colors hover:text-gray-500"
              >
                <FiXCircle size={18} />
              </button>
            )}
          </div>
        </TutorialTarget>
        <p className="mt-1 text-right text-[11px] text-gray-400">{state.clubName.length}/50</p>
      </div>

      <div className="mb-6">
        <label className="mb-2 block text-sm font-bold text-gray-700">
          카테고리
          <span className="ml-1 text-xs font-normal text-gray-400">(선택)</span>
        </label>
        <TutorialTarget id="cc-category" engine={engine}>
          <div className="flex flex-wrap gap-2 p-1">
            {CATEGORY_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => dispatch({ type: 'SET_CATEGORY', value: opt })}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors active:scale-95 ${
                  state.category === opt
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </TutorialTarget>
      </div>

      <div className="border-t border-gray-100 pt-3">
        <TutorialTarget id="cc-create" engine={engine}>
          <div
            className={`w-full rounded-xl py-3 text-center text-base font-semibold text-white ${
              state.clubName.trim() ? 'bg-gray-900' : 'bg-gray-300'
            }`}
          >
            만들기
          </div>
        </TutorialTarget>
      </div>
    </SceneFrame>
  );
}
