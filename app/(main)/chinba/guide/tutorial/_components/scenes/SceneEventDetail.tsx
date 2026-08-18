'use client';

import { useState } from 'react';

import {
  FiCheck,
  FiCheckCircle,
  FiClock,
  FiLink,
  FiRotateCcw,
  FiShare2,
  FiTrash2,
  FiUpload,
} from 'react-icons/fi';

import SceneFrame from '../SceneFrame';
import { TutorialTarget } from '../Spotlight';
import TutorialConfirmModal from '../TutorialConfirmModal';
import type { TutorialEngine } from '../useTutorialEngine';

const DATES = ['목 8/20', '금 8/21'];
const ROWS = ['18시', '', '19시', ''];

// [내 시간표 불러오기]가 자동으로 칠하는 수업 시간(회장 본인)
const TIMETABLE_CELLS = new Set(['0-0', '1-0']);

// 다른 멤버들의 불가능 시간 — 제출 연출이 진행될수록 히트맵이 채워진다
const MEMBER_UNAVAIL: Record<string, string[]> = {
  yh: ['3-1'],
  cs: ['2-1', '3-1'],
  pjm: ['1-1', '3-1'],
  sj: ['2-1', '3-1'],
};

// 이 스텝들에서는 "내 일정" 탭을, 나머지는 "전체 일정" 탭을 보여준다
const MY_TAB_STEP_IDS = new Set(['E-import', 'E-paint', 'E-save']);

function heatColor(unavail: number, total: number): string {
  if (total === 0) return 'bg-gray-50';
  if (unavail === 0) return 'bg-[#21a278]';
  const ratio = unavail / total;
  if (ratio <= 0.25) return 'bg-[#41b47e]';
  if (ratio <= 0.5) return 'bg-[#62c784]';
  if (ratio <= 0.75) return 'bg-[#a3ec8f]';
  if (ratio < 1) return 'bg-[#c4fe95]';
  return 'bg-red-500';
}

/** 일정 상세(ChinbaEventDetailBody 재현) — 내 일정 제출 → 링크 공유 → 완료 처리까지 한 화면 */
export default function SceneEventDetail({ engine }: { engine: TutorialEngine }) {
  const { state, dispatch, step } = engine;
  const [showComplete, setShowComplete] = useState(false);

  const isMyTab = !!step && MY_TAB_STEP_IDS.has(step.id);
  const total = state.submissions.length;
  const allSubmitted = total === state.members.length && total > 0;

  const myUnavail = (key: string) =>
    (state.importedTimetable && TIMETABLE_CELLS.has(key)) || state.paintedCells.includes(key);
  const unavailCount = (key: string) =>
    state.submissions.filter((id) =>
      id === 'me' ? myUnavail(key) : (MEMBER_UNAVAIL[id]?.includes(key) ?? false),
    ).length;

  return (
    <SceneFrame title={state.eventTitle || '일정'}>
      {/* 날짜 요약 + 액션 아이콘 */}
      <div className="border-b border-gray-100 pb-2">
        <div className="flex items-center justify-between">
          <p className="truncate text-[11px] text-gray-500">8/20(목) ~ 8/21(금)</p>
          <TutorialTarget id="ev-icons" engine={engine}>
            <div className="flex shrink-0 items-center gap-1 p-0.5">
              <TutorialTarget id="ev-complete" engine={engine}>
                <button
                  type="button"
                  onClick={() => setShowComplete(true)}
                  className="rounded-full p-2 text-emerald-600 transition-colors hover:bg-emerald-50"
                  title="완료 처리"
                >
                  <FiCheckCircle size={18} />
                </button>
              </TutorialTarget>
              <TutorialTarget id="ev-share" engine={engine}>
                <span className="block rounded-full p-2 text-gray-600" title="링크 복사">
                  <FiLink size={17} />
                </span>
              </TutorialTarget>
              <span className="rounded-full p-2 text-gray-600" title="공유">
                <FiShare2 size={18} />
              </span>
              <span className="rounded-full p-2 text-red-500" title="삭제">
                <FiTrash2 size={16} />
              </span>
            </div>
          </TutorialTarget>
        </div>
      </div>

      {/* 상태 배너 */}
      {state.eventCompleted && (
        <div className="border-b border-emerald-100 bg-emerald-50 px-4 py-2">
          <p className="text-center text-xs font-medium text-emerald-700">완료된 일정입니다</p>
        </div>
      )}

      {/* 서브탭 (진행중일 때만) */}
      {!state.eventCompleted && (
        <div className="flex border-b border-gray-200">
          {(
            [
              { key: 'team', label: '전체 일정' },
              { key: 'my', label: '내 일정' },
            ] as const
          ).map(({ key, label }) => {
            const isActive = (key === 'my') === isMyTab;
            return (
              <div
                key={key}
                className={`relative flex-1 py-2.5 text-center text-sm ${
                  isActive ? 'font-bold text-gray-900' : 'font-medium text-gray-400'
                }`}
              >
                {label}
                {isActive && (
                  <span className="absolute bottom-0 left-1/2 h-0.5 w-16 -translate-x-1/2 rounded-full bg-gray-900" />
                )}
              </div>
            );
          })}
        </div>
      )}

      {isMyTab ? (
        /* ── 내 일정 탭 ── */
        <div className="pt-3">
          <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-100 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold leading-tight text-emerald-900">
                불가능한 시간을 칠하세요
              </p>
              <p className="mt-0.5 text-[10px] text-emerald-700">빨간색이 불가능한 시간입니다</p>
            </div>
            <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-medium text-gray-600">
              드래그 | 직접 입력
            </span>
          </div>

          <div className="mb-3 flex items-stretch gap-2">
            <TutorialTarget id="ev-import" engine={engine} className="flex-1">
              <span className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-[11px] font-medium text-gray-600">
                <FiUpload size={12} />내 시간표 불러오기
              </span>
            </TutorialTarget>
            <span className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-[11px] font-medium text-red-500">
              <FiRotateCcw size={12} />
              초기화
            </span>
          </div>

          <TutorialTarget id="ev-grid" engine={engine}>
            <div className="rounded-xl border border-gray-200 p-2">
              <div className="flex">
                <div className="w-7 shrink-0" />
                {DATES.map((label) => (
                  <div key={label} className="flex flex-1 flex-col items-center justify-center py-1">
                    <span className="text-[10px] text-gray-400">{label.split(' ')[0]}</span>
                    <span className="text-xs font-medium text-gray-700">{label.split(' ')[1]}</span>
                  </div>
                ))}
              </div>
              {ROWS.map((label, row) => (
                <div key={row} className="flex">
                  <div className="flex w-7 shrink-0 items-center justify-start">
                    {label && <span className="-mt-2 text-[10px] text-gray-400">{label}</span>}
                  </div>
                  {[0, 1].map((col) => {
                    const key = `${row}-${col}`;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => dispatch({ type: 'TOGGLE_CELL', key })}
                        className={`h-6 flex-1 border-t border-gray-100 transition-colors ${
                          col === 0 ? 'border-r' : ''
                        } ${myUnavail(key) ? 'bg-red-400' : 'bg-white hover:bg-red-50'}`}
                        aria-label={`${DATES[col]} ${row}번째 칸`}
                      />
                    );
                  })}
                </div>
              ))}
              <div className="mt-2 flex items-center justify-center gap-3 text-[10px] text-gray-400">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm border border-gray-200 bg-white" />
                  가능
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-400" />
                  불가능
                </span>
              </div>
            </div>
          </TutorialTarget>

          <div className="mt-3 border-t border-gray-100 pt-3">
            <TutorialTarget id="ev-save" engine={engine}>
              <div className="w-full rounded-xl bg-gray-900 py-3 text-center text-base font-semibold text-white">
                저장하기
              </div>
            </TutorialTarget>
          </div>
        </div>
      ) : (
        /* ── 전체 일정 탭 ── */
        <div className="pt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-gray-500">
              참여자 ({total}/{state.members.length} 제출)
            </span>
            {state.members.map((member) => {
              const submitted = state.submissions.includes(member.id);
              return (
                <span
                  key={member.id}
                  className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs transition-colors ${
                    submitted ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {submitted && <FiCheck size={10} />}
                  {member.name}
                </span>
              );
            })}
          </div>

          <div className="mt-3">
            {total === 0 ? (
              <div className="rounded-xl border border-gray-100 bg-gray-50 py-8 text-center">
                <p className="text-sm text-gray-400">아직 제출한 사람이 없습니다</p>
                <p className="mt-1 text-xs text-gray-300">링크를 공유해 시간을 모아보세요</p>
              </div>
            ) : (
              <div>
                <div className="flex">
                  <div className="w-7 shrink-0" />
                  {DATES.map((label) => (
                    <div key={label} className="flex flex-1 flex-col items-center justify-center py-1">
                      <span className="text-[10px] text-gray-400">{label.split(' ')[0]}</span>
                      <span className="text-xs font-medium text-gray-700">{label.split(' ')[1]}</span>
                    </div>
                  ))}
                </div>
                {ROWS.map((label, row) => (
                  <div key={row} className="flex">
                    <div className="flex w-7 shrink-0 items-center justify-start">
                      {label && <span className="-mt-2 text-[10px] text-gray-400">{label}</span>}
                    </div>
                    {[0, 1].map((col) => {
                      const key = `${row}-${col}`;
                      const unavail = unavailCount(key);
                      const avail = total - unavail;
                      return (
                        <div
                          key={key}
                          className={`flex h-[22px] flex-1 items-center justify-center border-t border-gray-100 transition-colors ${
                            col === 0 ? 'border-r' : ''
                          } ${heatColor(unavail, total)}`}
                        >
                          {avail > 0 && (
                            <span className="text-[9px] font-bold text-gray-800">{avail}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
                <div className="mt-2 flex items-center justify-center gap-2 px-2">
                  <span className="text-[10px] text-gray-400">가능</span>
                  <div className="h-3 w-4 rounded-sm bg-[#21a278]" />
                  <div className="h-3 w-4 rounded-sm bg-[#41b47e]" />
                  <div className="h-3 w-4 rounded-sm bg-[#62c784]" />
                  <div className="h-3 w-4 rounded-sm bg-[#a3ec8f]" />
                  <div className="h-3 w-4 rounded-sm bg-[#c4fe95]" />
                  <div className="h-3 w-4 rounded-sm bg-red-500" />
                  <span className="text-[10px] text-gray-400">불가</span>
                </div>
              </div>
            )}
          </div>

          {allSubmitted && !state.eventCompleted && (
            <div className="mt-4 animate-fadeIn">
              <h4 className="mb-2 text-xs font-bold text-gray-500">추천 시간</h4>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <div className="flex items-center gap-1.5">
                  <FiClock size={14} className="text-emerald-600" />
                  <span className="text-sm font-bold text-emerald-700">8/20(목) 18:00~19:00</span>
                </div>
                <p className="mt-1 text-xs text-emerald-600">{total}명 전원 가능</p>
              </div>
            </div>
          )}
        </div>
      )}

      <TutorialConfirmModal
        isOpen={showComplete}
        title="일정 완료"
        confirmLabel="완료 처리"
        onConfirm={() => {
          setShowComplete(false);
          dispatch({ type: 'COMPLETE_EVENT' });
        }}
        onCancel={() => setShowComplete(false)}
      >
        이 일정을 완료 처리하시겠습니까?
      </TutorialConfirmModal>
    </SceneFrame>
  );
}
