import type { Metadata } from 'next';
import Link from 'next/link';

import GuideExecFlow from './_components/GuideExecFlow';
import GuideExtras from './_components/GuideExtras';
import GuideInvites from './_components/GuideInvites';
import GuideMemberFlow from './_components/GuideMemberFlow';
import GuideOpsTools from './_components/GuideOpsTools';
import GuideRecordsRanking from './_components/GuideRecordsRanking';

export const metadata: Metadata = {
  title: '타임라인 설명서 | 제로타임',
  description:
    '동아리 개설부터 조 편성, 일정 조율, 활동 기록까지 타임라인 사용법을 화면과 함께 안내합니다.',
};

const TOC: { href: string; no: number; title: string; desc: string }[] = [
  { href: '#exec-flow', no: 1, title: '임원진 플로우', desc: '동아리 개설 → 조 편성 → 일정 잡기 → 확정' },
  { href: '#member-flow', no: 2, title: '일반 사용자 플로우', desc: '가입 → 시간표 등록 → 내 시간 제출' },
  { href: '#ops-tools', no: 3, title: '운영 도구', desc: '운영 사이드바 · 멤버 관리' },
  { href: '#invites', no: 4, title: '링크와 초대', desc: '초대링크 · 일정 전용 링크' },
  { href: '#records-ranking', no: 5, title: '기록과 랭킹', desc: '활동 기록 · 조별 랭킹(예정)' },
  { href: '#extras', no: 6, title: '알아두면 좋은 기능', desc: 'MY 탭 · 동아리 전환 · 일정 상태' },
  { href: '#faq', no: 7, title: '자주 묻는 질문', desc: '짧게 묻고 짧게 답하기' },
];

const CHARACTERS: { emoji: string; name: string; role: string; desc: string }[] = [
  { emoji: '👑', name: '홍길동', role: '회장', desc: '동아리를 만들고 일정을 잡는다' },
  { emoji: '🛠️', name: '이영희', role: '부회장', desc: '멤버와 조를 관리한다' },
  { emoji: '🌱', name: '김철수', role: '신입 부원', desc: '초대받아 시간을 제출한다' },
];

// (main) 셸이 overflow-hidden flex 체인이라 min-h-screen 대신 h-full + overflow-y-auto를 쓴다.
export default function ChinbaGuidePage() {
  return (
    <main className="h-full overflow-y-auto bg-white">
      <div className="mx-auto w-full max-w-3xl px-5 py-12 text-gray-900">
        {/* 표지 */}
        <div className="flex items-start justify-between gap-4">
          <p className="text-xs font-bold tracking-widest text-emerald-600">TIMELINE GUIDE</p>
          <Link
            href="/chinba/guide/tutorial/"
            className="inline-flex shrink-0 items-center gap-2 bg-gray-900 px-5 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-gray-800 active:scale-[0.98]"
          >
            🎮 타임라인 튜토리얼 들어가기
          </Link>
        </div>
        <h1 className="mt-2 text-3xl font-bold leading-snug">
          타임라인 설명서
        </h1>
        <p className="mt-4 text-[15px] leading-7 text-gray-700">
          타임라인은 <strong>단톡방 투표 없이 모임 시간을 찾아 주는</strong> 서비스입니다.
          임원진이 후보 날짜만 던져 두면, 멤버들은 각자 안 되는 시간을 표시하고, 타임라인이
          모두가 되는 시간을 찾아 줍니다.
        </p>
        <p className="mt-4 text-[15px] leading-7 text-gray-700">
          이 설명서는 가상의 <strong>&lsquo;전북대 코딩 동아리&rsquo;</strong> 세 사람을
          따라갑니다. 동아리를 운영하는 입장이라면 1장부터, 초대를 받은 입장이라면 2장부터
          읽으면 됩니다.
        </p>

        {/* 등장인물 */}
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {CHARACTERS.map(({ emoji, name, role, desc }) => (
            <div key={name} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-2xl">{emoji}</p>
              <p className="mt-2 text-sm font-bold text-gray-900">
                {name} <span className="ml-1 text-xs font-medium text-gray-400">{role}</span>
              </p>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">{desc}</p>
            </div>
          ))}
        </div>

        {/* 목차 */}
        <nav className="mt-10 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">목차</p>
          <ol className="mt-3 divide-y divide-gray-50">
            {TOC.map(({ href, no, title, desc }) => (
              <li key={href}>
                <a href={href} className="group flex items-center gap-3 py-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500 group-hover:bg-blue-100 group-hover:text-blue-700">
                    {no}
                  </span>
                  <span className="text-sm font-semibold text-gray-800 group-hover:text-blue-700">
                    {title}
                  </span>
                  <span className="ml-auto hidden text-xs text-gray-400 sm:block">{desc}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <p className="mt-6 text-xs leading-relaxed text-gray-400">
          아래 화면들은 실제 앱 화면을 그대로 재현한 예시 그림입니다. 등장하는 이름과
          숫자는 모두 가상의 예시입니다.
        </p>

        <GuideExecFlow />
        <GuideMemberFlow />
        <GuideOpsTools />
        <GuideInvites />
        <GuideRecordsRanking />
        <GuideExtras />

        {/* 마무리 */}
        <section className="mt-16 border-t border-gray-100 pt-10 pb-12">
          <p className="text-xs font-bold tracking-widest text-emerald-600">WRAP-UP</p>
          <h2 className="mt-1.5 text-2xl font-bold">한눈에 정리</h2>
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-5">
              <p className="text-sm font-bold text-gray-900">임원진은</p>
              <p className="mt-1.5 text-sm leading-7 text-gray-700">
                동아리 만들기 → 조 편성 → 일정 잡기 → 완료 후 기록. 초대링크로 사람을 모으고,
                운영 사이드바에서 응답 현황을 챙깁니다.
              </p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-5">
              <p className="text-sm font-bold text-gray-900">멤버는</p>
              <p className="mt-1.5 text-sm leading-7 text-gray-700">
                초대링크로 가입 → 시간표 한 번 등록 → 일정마다 안 되는 시간 저장. 이게
                전부입니다.
              </p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-5">
              <p className="text-sm font-bold text-emerald-800">나머지는 타임라인이</p>
              <p className="mt-1.5 text-sm leading-7 text-emerald-900">
                모두가 되는 시간 찾기, 응답 현황 집계, 활동 기록 정리. 단톡방 투표는 이제
                없습니다.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
