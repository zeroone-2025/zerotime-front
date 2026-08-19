'use client';

import { FiSearch, FiUser, FiUsers, FiX } from 'react-icons/fi';

import { TutorialTarget } from '../Spotlight';
import type { MemberRole } from '../types';
import type { TutorialEngine } from '../useTutorialEngine';
import SceneClubHome from './SceneClubHome';

const ROLE_BADGE: Record<MemberRole, string> = {
  회장: 'bg-red-100 text-red-700',
  부회장: 'bg-orange-100 text-orange-700',
  운영진: 'bg-blue-100 text-blue-700',
  회원: 'bg-gray-100 text-gray-500',
};

/**
 * 동아리 상세 위에 뜨는 멤버 관리 모달(TeamMembersModal 재현).
 * 모달을 z-[85]로 스포트라이트 오버레이(z-80)보다 위에 두고,
 * 이 장면의 스텝들은 overlay:false — 모달 자체 백드롭이 클릭 게이팅을 담당한다.
 */
export default function SceneMembersModal({ engine }: { engine: TutorialEngine }) {
  const { state, dispatch } = engine;

  return (
    <>
      <SceneClubHome engine={engine} />

      <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/40 p-4">
        <div className="flex max-h-[80vh] w-full max-w-md flex-col overflow-visible rounded-2xl bg-white shadow-xl">
          {/* 헤더 */}
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
              <FiUsers size={18} className="text-gray-500" />
              멤버 관리
              <span className="text-xs font-normal text-gray-400">{state.members.length}명</span>
            </h2>
            <TutorialTarget id="mem-close" engine={engine}>
              <span className="block cursor-pointer rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700">
                <FiX size={18} />
              </span>
            </TutorialTarget>
          </div>

          {/* 본문 */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <div className="relative mb-3">
              <FiSearch
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300"
              />
              <div className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-3 text-sm text-gray-400">
                이름 검색
              </div>
            </div>
            <div className="space-y-1">
              {state.members.map((member) => {
                const isMe = member.id === 'me';
                const row = (
                  <div className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-gray-50">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-100 bg-gray-50 text-gray-400">
                      <FiUser size={16} />
                    </div>
                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800">
                      {member.name}
                      {isMe && <span className="ml-1 text-[11px] text-gray-400">(나)</span>}
                    </p>
                    {isMe ? (
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${ROLE_BADGE[member.role]}`}
                      >
                        {member.role}
                      </span>
                    ) : (
                      <>
                        <select
                          value={member.role}
                          onChange={(e) =>
                            dispatch({
                              type: 'SET_ROLE',
                              id: member.id,
                              role: e.target.value as MemberRole,
                            })
                          }
                          className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 outline-none transition-colors focus:border-gray-900"
                          aria-label={`${member.name} 역할`}
                        >
                          <option value="회원">회원</option>
                          <option value="운영진">운영진</option>
                          <option value="부회장">부회장</option>
                        </select>
                        <span className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-red-400">
                          내보내기
                        </span>
                      </>
                    )}
                  </div>
                );
                return member.id === 'yh' ? (
                  <TutorialTarget key={member.id} id="mem-role" engine={engine}>
                    {row}
                  </TutorialTarget>
                ) : (
                  <div key={member.id}>{row}</div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
