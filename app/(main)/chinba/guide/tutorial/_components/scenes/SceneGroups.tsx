'use client';

import { FiPlus } from 'react-icons/fi';

import SceneFrame from '../SceneFrame';
import { TutorialTarget } from '../Spotlight';
import type { TutorialEngine } from '../useTutorialEngine';

/**
 * 조 편성(GroupManageView + GroupSettingsSection 재현) — 세 화면을 스텝에 따라 전환:
 * ① 그룹세트 이름 입력(G-setname) → ② 조 편성(G-add1~G-save) → ③ 그룹세트 목록(G-set2)
 */
export default function SceneGroups({ engine }: { engine: TutorialEngine }) {
  const { state, dispatch, step } = engine;
  const stepId = step?.id ?? '';

  const nameOf = (id: string) => state.members.find((m) => m.id === id)?.name ?? id;
  const unassigned = state.members.filter(
    (m) => !state.group1Ids.includes(m.id) && !state.group2Ids.includes(m.id),
  );
  const setName = state.groupSetName.trim() || '그룹세트';

  /* ── ① 그룹세트 이름 입력 ── */
  if (stepId === 'G-setname') {
    return (
      <SceneFrame title="조 편성">
        <label className="mb-2 block text-sm font-bold text-gray-700">새 그룹세트</label>
        <p className="mb-3 text-xs text-gray-400">
          조 편성 한 벌의 이름이에요. 활동 이름으로 지으면 알아보기 쉬워요.
        </p>
        <TutorialTarget id="grp-set-name" engine={engine}>
          <input
            type="text"
            value={state.groupSetName}
            onChange={(e) => dispatch({ type: 'SET_GROUP_SET_NAME', value: e.target.value })}
            placeholder="예: 친바, 스터디, 프로젝트"
            maxLength={30}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 outline-none transition-colors focus:border-gray-900"
          />
        </TutorialTarget>
        <div className="mt-6 border-t border-gray-100 pt-3">
          <div
            className={`w-full rounded-xl py-3 text-center text-base font-semibold text-white ${
              state.groupSetName.trim() ? 'bg-gray-900' : 'bg-gray-300'
            }`}
          >
            다음
          </div>
        </div>
      </SceneFrame>
    );
  }

  /* ── ③ 그룹세트 목록 ── */
  if (stepId === 'G-set2') {
    return (
      <SceneFrame title="조 / 그룹 관리">
        <div className="space-y-3">
          <div className="rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-gray-800">{setName}</span>
              <span className="text-[11px] text-gray-400">2개 조</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">
                1조({state.group1Ids.length})
              </span>
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">
                2조({state.group2Ids.length})
              </span>
            </div>
            <div className="mt-3 flex gap-1.5 text-[11px] text-gray-400">
              <span>이름변경</span>·<span>조 수정</span>·<span>재편성</span>·<span>삭제</span>
            </div>
          </div>

          {state.studySetCreated && (
            <div className="animate-fadeIn rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-gray-800">스터디</span>
                <span className="text-[11px] text-gray-400">2개 조</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">
                  월요일반(3)
                </span>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">
                  수요일반(2)
                </span>
              </div>
            </div>
          )}

          <TutorialTarget id="grp-newset" engine={engine}>
            <div className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-3 text-sm font-medium text-gray-500">
              <FiPlus size={16} />새 그룹 생성
            </div>
          </TutorialTarget>
        </div>
      </SceneFrame>
    );
  }

  /* ── ② 조 편성 ── */
  const groupCards: { name: string; ids: string[] }[] = [];
  if (state.groupsCreated >= 1) groupCards.push({ name: '1조', ids: state.group1Ids });
  if (state.groupsCreated >= 2) groupCards.push({ name: '2조', ids: state.group2Ids });

  return (
    <SceneFrame title={`조 편성 — ${setName}`}>
      <div className="space-y-3">
        {groupCards.map((group, idx) => (
          <div key={group.name} className="animate-fadeIn rounded-xl border border-gray-200 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-bold text-gray-800">{group.name}</span>
              {group.ids.length === 0 && <span className="text-[11px] text-red-400">멤버 필요</span>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {group.ids.map((id, memberIdx) => (
                <span
                  key={id}
                  className={`inline-flex animate-fadeIn items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                    memberIdx === 0 ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {nameOf(id)}
                  {memberIdx === 0 && ' ★'}
                </span>
              ))}
            </div>
            {idx === 0 && (
              <TutorialTarget id="grp-fill" engine={engine} className="mt-2 inline-block">
                <span className="px-1 text-xs font-medium text-gray-400">
                  <FiPlus className="mr-0.5 inline" size={12} />
                  멤버 추가
                </span>
              </TutorialTarget>
            )}
          </div>
        ))}

        {state.groupsCreated < 2 && (
          <TutorialTarget id="grp-add" engine={engine}>
            <div className="w-full rounded-xl border-2 border-dashed border-gray-200 py-3 text-center text-sm font-medium text-gray-400">
              <FiPlus className="mr-1 inline" size={14} />새 조 추가
            </div>
          </TutorialTarget>
        )}

        {unassigned.length > 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">미배정 멤버</span>
              <span className="text-[11px] text-gray-400">눌러서 조에 배정</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {unassigned.map((m) => (
                <span key={m.id} className="rounded-full bg-gray-50 px-2.5 py-1 text-xs text-gray-500">
                  {m.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 border-t border-gray-100 pt-3">
        <div className="flex gap-2">
          <div className="flex-1 rounded-lg border border-gray-200 py-3 text-center text-base font-semibold text-gray-700">
            돌아가기
          </div>
          <TutorialTarget id="grp-save" engine={engine} className="flex-1">
            <div
              className={`w-full rounded-lg py-3 text-center text-base font-semibold text-white ${
                unassigned.length === 0 && state.groupsCreated === 2 ? 'bg-gray-900' : 'bg-gray-300'
              }`}
            >
              저장하기
            </div>
          </TutorialTarget>
        </div>
      </div>
    </SceneFrame>
  );
}
