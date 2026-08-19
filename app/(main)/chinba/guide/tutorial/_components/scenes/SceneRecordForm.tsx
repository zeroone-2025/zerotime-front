'use client';

import { LuPencil } from 'react-icons/lu';

import ClubShell from '../ClubShell';
import { TutorialTarget } from '../Spotlight';
import type { TutorialEngine } from '../useTutorialEngine';

/**
 * 기록 탭 위에 자동으로 열린 활동 기록 폼(ActivityTab 기록 모달 재현).
 * 모달 z-[85] + 이 장면의 스텝은 overlay:false — 모달 백드롭이 게이팅 담당.
 */
export default function SceneRecordForm({ engine }: { engine: TutorialEngine }) {
  const { state, dispatch } = engine;
  const canSave = state.record.title.trim().length > 0 && state.record.desc.trim().length > 0;

  return (
    <>
      <ClubShell engine={engine} tab="mwoheni">
        <div className="py-10 text-center">
          <p className="text-sm text-gray-400">일정을 완료하면 기록 폼이 자동으로 열려요</p>
        </div>
      </ClubShell>

      <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/40 p-4">
        {/* 본문에 overflow를 걸지 않는다 — 말풍선(absolute)이 잘리면 [다음] 버튼이 클릭 불가가 된다 */}
        <div className="flex w-full max-w-md flex-col rounded-2xl bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
              <LuPencil size={16} className="text-gray-500" />
              활동 기록하기
            </h2>
          </div>

          <div className="px-5 py-4">
            <TutorialTarget id="rec-form" engine={engine}>
              <div className="space-y-3 p-1">
                <input
                  type="text"
                  value={state.record.title}
                  onChange={(e) => dispatch({ type: 'SET_RECORD', patch: { title: e.target.value } })}
                  placeholder="활동 제목"
                  maxLength={100}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                />
                <div className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800">
                  2026-08-20
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800">
                    18:00
                  </div>
                  <div className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800">
                    19:00
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-gray-500">활동 설명</p>
                  <textarea
                    value={state.record.desc}
                    onChange={(e) => dispatch({ type: 'SET_RECORD', patch: { desc: e.target.value } })}
                    placeholder="무엇을 했는지 적어주세요"
                    rows={2}
                    className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-gray-500">사용 금액 (선택)</p>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={state.record.amount}
                    onChange={(e) =>
                      dispatch({
                        type: 'SET_RECORD',
                        patch: { amount: e.target.value.replace(/[^0-9,]/g, '') },
                      })
                    }
                    placeholder="예: 24,000"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                  />
                </div>
              </div>
            </TutorialTarget>

            <div className="mt-4 flex gap-2">
              <div className="flex-1 rounded-lg bg-gray-200 py-2 text-center text-sm font-medium text-gray-600">
                기록하지 않기
              </div>
              <TutorialTarget id="rec-save" engine={engine} className="flex-1">
                <div
                  className={`w-full rounded-lg py-2 text-center text-sm font-medium text-white ${
                    canSave ? 'bg-gray-900' : 'bg-gray-300'
                  }`}
                >
                  기록하기
                </div>
              </TutorialTarget>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
