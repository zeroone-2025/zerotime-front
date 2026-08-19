'use client';

import { FiCalendar, FiChevronRight, FiEdit3, FiGrid, FiLink, FiUsers } from 'react-icons/fi';

import { TutorialTarget } from './Spotlight';
import type { TutorialEngine } from './useTutorialEngine';

function PanelRow({
  icon: Icon,
  label,
  trailing = '›',
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  trailing?: string;
}) {
  return (
    <div className="group flex w-full cursor-pointer items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-blue-50 hover:text-blue-700">
      <Icon size={16} className="shrink-0 text-gray-500" />
      <span className="flex-1 text-left">{label}</span>
      <span className="text-xs text-gray-300">{trailing}</span>
    </div>
  );
}

/**
 * 실제 TeamOpsPanel(데스크톱 우측 운영 패널)의 튜토리얼 판.
 * lg 이상에서는 오른쪽 사이드바, 그 아래 해상도에서는 본문 아래에 쌓인다
 * (실제 앱은 모바일에서 설정 페이지로 대체되지만, 튜토리얼 진행을 위해 항상 노출).
 */
export default function FakeOpsPanel({ engine }: { engine: TutorialEngine }) {
  const { state } = engine;
  const hasEvent = state.eventTitle.trim().length > 0 && state.eventDates.length > 0;

  return (
    <aside className="w-full shrink-0 border-t border-gray-100 bg-white lg:w-[236px] lg:border-l lg:border-t-0">
      <div className="flex flex-col gap-6 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-800">운영</h2>
          <span className="rounded-full p-1.5 text-gray-400">
            <FiChevronRight size={16} />
          </span>
        </div>

        <section className="flex flex-col">
          <span className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wide text-gray-400">
            운영 도구
          </span>
          <TutorialTarget id="ops-members" engine={engine}>
            <PanelRow icon={FiUsers} label="멤버 관리" trailing="⤢" />
          </TutorialTarget>
          <TutorialTarget id="ops-groups" engine={engine}>
            <PanelRow icon={FiGrid} label="조 / 그룹 관리" trailing="⤢" />
          </TutorialTarget>
          <TutorialTarget id="ops-invite" engine={engine}>
            <PanelRow icon={FiLink} label="초대링크 복사" trailing="⧉" />
          </TutorialTarget>
        </section>

        <TutorialTarget id="ops-response" engine={engine}>
          <section className="flex flex-col p-1">
            <span className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wide text-gray-400">
              응답 현황
            </span>
            {hasEvent ? (
              <div className="px-3 py-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate font-medium text-gray-700">{state.eventTitle}</span>
                  <span className="shrink-0 text-gray-400">
                    {state.submissions.length}/{state.members.length}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-emerald-400 transition-all"
                    style={{
                      width: `${
                        state.members.length === 0
                          ? 0
                          : Math.round((state.submissions.length / state.members.length) * 100)
                      }%`,
                    }}
                  />
                </div>
                {state.submissions.length < state.members.length && (
                  <p className="mt-1.5 text-[11px] text-gray-400">
                    미제출:{' '}
                    {state.members
                      .filter((m) => !state.submissions.includes(m.id))
                      .map((m) => m.name)
                      .join(', ')}{' '}
                    <span className="text-gray-500">[복사]</span>
                  </p>
                )}
              </div>
            ) : (
              <p className="px-3 py-1 text-[11px] text-gray-400">아직 진행 중인 일정이 없어요</p>
            )}
          </section>
        </TutorialTarget>

        <section className="flex flex-col border-t border-gray-100 pt-5">
          <span className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wide text-gray-400">
            바로가기
          </span>
          <PanelRow icon={FiCalendar} label="일정 잡기" />
          <PanelRow icon={FiEdit3} label="활동 기록하기" />
        </section>
      </div>
    </aside>
  );
}
