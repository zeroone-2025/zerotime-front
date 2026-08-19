'use client';

import { Fragment } from 'react';

import { FiUpload } from 'react-icons/fi';

import SceneFrame from '../SceneFrame';
import { TutorialTarget } from '../Spotlight';
import type { TutorialEngine } from '../useTutorialEngine';

const HOURS = ['9시', '10시', '11시'];
// 업로드 후 채워지는 가짜 수업 배치: [row][col]
const CLASSES: Record<string, string> = {
  '0-1': '자료구조',
  '1-1': '자료구조',
  '1-3': '운영체제',
  '2-0': '선형대수',
};

/** 부원 트랙 2: 내 시간표 (TimetableTab 재현 — 에브리타임 업로드 → AI 분석 연출) */
export default function SceneTimetable({ engine }: { engine: TutorialEngine }) {
  const loaded = engine.state.timetableLoaded;
  return (
    <SceneFrame title="내 시간표">
      <div className="flex items-center justify-between pb-2">
        <span className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-700">
          2학기 ▾
        </span>
        <TutorialTarget id="tt-upload" engine={engine}>
          <span className="flex items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-gray-600">
            <FiUpload size={12} />
            에브리타임 시간표 업로드
          </span>
        </TutorialTarget>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-2">
        <div className="grid grid-cols-6 gap-px text-center">
          <div />
          {['월', '화', '수', '목', '금'].map((d) => (
            <div key={d} className="py-1 text-[10px] font-medium text-gray-400">
              {d}
            </div>
          ))}
          {HOURS.map((hour, row) => (
            <Fragment key={hour}>
              <div className="py-2 pr-1 text-right text-[10px] text-gray-400">{hour}</div>
              {[0, 1, 2, 3, 4].map((col) => {
                const label = loaded ? CLASSES[`${row}-${col}`] : undefined;
                return (
                  <div
                    key={`${hour}-${col}`}
                    className={`flex h-9 items-center justify-center rounded-sm border border-gray-100 ${
                      label ? 'animate-fadeIn bg-blue-100' : 'bg-white'
                    }`}
                  >
                    {label && <span className="text-[8px] font-medium text-blue-700">{label}</span>}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
        <p className="mt-2 text-center text-[10px] text-gray-300">
          {loaded ? '수업이 자동으로 채워졌어요' : '드래그하여 내 고정 일정 추가/수정'}
        </p>
      </div>
    </SceneFrame>
  );
}
