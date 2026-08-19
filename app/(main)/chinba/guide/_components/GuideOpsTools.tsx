import {
  FiCalendar,
  FiChevronRight,
  FiEdit3,
  FiGrid,
  FiLink,
  FiSearch,
  FiUser,
  FiUsers,
} from 'react-icons/fi';

import { ChapterHeader, GuideTip, StepHeading } from './GuideBlocks';
import MockFrame from './MockFrame';

/**
 * 3장 — 운영 도구 (이영희 부회장 시점)
 * 운영 패널(TeamOpsPanel)과 멤버 관리(TeamMembersModal) 목업.
 */
export default function GuideOpsTools() {
  return (
    <section>
      <ChapterHeader
        no={3}
        id="ops-tools"
        title="운영 도구"
        subtitle="운영 사이드바와 멤버 관리, 부회장 이영희의 하루"
      />

      <StepHeading title="운영 사이드바" />
      <p className="mt-4 text-[15px] leading-7 text-gray-700">
        부회장 이영희가 데스크톱(넓은 화면)으로 동아리에 들어가면 오른쪽에{' '}
        <strong>운영 패널</strong>이 보입니다. 임원진(회장·부회장·운영진)에게만 보이는 전용
        도구 모음으로, 위에서부터 세 구역입니다.
      </p>
      <ol className="mt-3 list-decimal space-y-1.5 pl-6 text-[15px] leading-7 text-gray-700">
        <li>
          <strong>운영 도구</strong> : 멤버 관리, 조/그룹 관리, 초대링크 복사가 모여
          있습니다.
        </li>
        <li>
          <strong>응답 현황</strong> : 일정마다 몇 명이 시간을 제출했는지 진행바로
          보여줍니다.
        </li>
        <li>
          <strong>바로가기</strong> : 일정 잡기와 활동 기록으로 가는 지름길입니다.
        </li>
      </ol>
      <p className="mt-4 text-[15px] leading-7 text-gray-700">
        모바일이나 좁은 화면에서는 이 기능들이 오른쪽 위 <strong>설정(톱니바퀴)</strong>{' '}
        페이지 안에 같은 구성으로 들어 있습니다.
      </p>

      <MockFrame title="운영" caption="운영 패널: 임원진에게만 보이는 오른쪽 사이드바">
        <div className="flex flex-col gap-5">
          <section className="flex flex-col">
            <span className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wide text-gray-400">
              운영 도구
            </span>
            {[
              { icon: FiUsers, label: '멤버 관리', trailing: '⤢' },
              { icon: FiGrid, label: '조 / 그룹 관리', trailing: '⤢' },
              { icon: FiLink, label: '초대링크 복사', trailing: '⧉' },
            ].map(({ icon: Icon, label, trailing }) => (
              <div
                key={label}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-gray-700"
              >
                <Icon size={16} className="shrink-0 text-gray-500" />
                <span className="flex-1 text-left">{label}</span>
                <span className="text-xs text-gray-300">{trailing}</span>
              </div>
            ))}
          </section>
          <section className="flex flex-col">
            <span className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wide text-gray-400">
              응답 현황
            </span>
            <div className="px-3 py-1">
              <div className="flex items-center justify-between text-xs">
                <span className="truncate font-medium text-gray-700">조별과제 회의</span>
                <span className="shrink-0 text-gray-400">3/4</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div className="h-full w-3/4 rounded-full bg-emerald-400" />
              </div>
              <p className="mt-1.5 text-[11px] text-gray-400">
                미제출: <span className="text-gray-500">박지민</span>
              </p>
            </div>
          </section>
          <section className="flex flex-col border-t border-gray-100 pt-4">
            <span className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wide text-gray-400">
              바로가기
            </span>
            {[
              { icon: FiCalendar, label: '일정 잡기' },
              { icon: FiEdit3, label: '활동 기록하기' },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-gray-700"
              >
                <Icon size={16} className="shrink-0 text-gray-500" />
                <span className="flex-1 text-left">{label}</span>
                <span className="text-xs text-gray-300">
                  <FiChevronRight size={12} className="inline" />
                </span>
              </div>
            ))}
          </section>
        </div>
      </MockFrame>

      <GuideTip>
        응답 현황에서 일정을 누르면 <strong>미제출자 이름 목록과 [복사] 버튼</strong>이
        나옵니다. 복사해서 단톡방에 붙이면 독촉 멘트가 완성됩니다.
      </GuideTip>

      <StepHeading title="멤버 관리" />
      <p className="mt-4 text-[15px] leading-7 text-gray-700">
        <strong>[멤버 관리]</strong>를 열면 멤버 목록이 뜹니다. 각 줄에 프로필·닉네임·소속
        조가 보이고, 회장과 부회장은 역할 드롭다운으로 <strong>회원 / 운영진 / 부회장</strong>을
        바로 바꿀 수 있습니다. 회장 자리는 별도의 <strong>회장 위임</strong> 메뉴로만 넘길 수
        있고, 위임하면 본인은 운영진이 됩니다. <strong>[내보내기]</strong>는 확인을 한 번 더
        거친 뒤 동아리에서 내보냅니다.
      </p>
      <p className="mt-4 text-[15px] leading-7 text-gray-700">역할별 권한은 이렇게 나뉩니다.</p>
      <ol className="mt-3 list-decimal space-y-1.5 pl-6 text-[15px] leading-7 text-gray-700">
        <li>일정·기록·조 편성 : 임원진 전체(회장·부회장·운영진)</li>
        <li>역할 변경 : 회장·부회장</li>
        <li>동아리 삭제·회장 위임 : 회장·부회장(위임은 회장만)</li>
      </ol>

      <MockFrame title="멤버 관리 · 4명" caption="역할 드롭다운과 내보내기: 회장·부회장만 조작 가능">
        <div className="relative mb-3">
          <FiSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <div className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-3 text-sm text-gray-400">
            이름 검색
          </div>
        </div>
        <div className="space-y-1">
          {[
            { name: '홍길동', group: '친바 - 1조 (조장)', badge: '회장', badgeClass: 'bg-red-100 text-red-700' },
            { name: '이영희', group: '친바 - 1조', badge: '부회장', badgeClass: 'bg-orange-100 text-orange-700' },
            { name: '박지민', group: '친바 - 2조 (조장)', badge: null, badgeClass: '' },
            { name: '김철수', group: '친바 - 1조', badge: null, badgeClass: '' },
          ].map(({ name, group, badge, badgeClass }) => (
            <div key={name} className="flex items-center gap-3 rounded-lg px-2 py-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-100 bg-gray-50 text-gray-400">
                <FiUser size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-800">{name}</p>
                <p className="mt-0.5 truncate text-[11px] text-gray-400">{group}</p>
              </div>
              {badge ? (
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${badgeClass}`}>
                  {badge}
                </span>
              ) : (
                <>
                  <span className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700">
                    회원 ▾
                  </span>
                  <span className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-red-400">
                    내보내기
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      </MockFrame>
    </section>
  );
}
