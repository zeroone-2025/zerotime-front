'use client';

import { FiBell, FiBookOpen, FiExternalLink, FiUser, FiUsers } from 'react-icons/fi';
import { SiNaver } from 'react-icons/si';

/**
 * 실제 앱 왼쪽 사이드바(SidebarContent)의 정적 복제 — 튜토리얼 배경용.
 * 클릭 동작은 없다(스포트라이트 오버레이가 덮거나, 오버레이 없는 스텝에서도 inert).
 */
export default function FakeSidebar() {
  return (
    <aside className="hidden w-[260px] shrink-0 select-none flex-col border-r border-gray-100 bg-white md:flex">
      <div className="px-5 pb-2 pt-6">
        <span className="text-lg font-extrabold tracking-tight text-gray-900">ZeroTime</span>
      </div>

      {/* 사용자 영역 */}
      <div className="border-b border-gray-100 px-5 pb-4 pt-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-100 bg-gray-50 text-gray-400">
            <FiUser size={18} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-gray-800">홍길동</p>
            <p className="truncate text-[11px] text-gray-400">전북대학교</p>
          </div>
        </div>
      </div>

      {/* 서비스 목록 */}
      <div className="px-3 pt-4">
        <div className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-gray-700">
          <FiBell size={18} />
          <span className="text-sm font-medium">전북대학교 알리미</span>
        </div>
        <div className="flex w-full items-center gap-3 rounded-lg bg-blue-50 px-3 py-2.5 text-left text-blue-700">
          <FiUsers size={18} />
          <span className="text-sm font-medium">타임라인</span>
          <span className="ml-auto rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-500">
            현재
          </span>
        </div>

        <div className="mt-3 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-gray-500">
          <SiNaver size={16} />
          <span className="text-sm font-medium">제로타임 앱 사용하기</span>
          <FiExternalLink size={13} className="ml-auto text-gray-300" />
        </div>
        <div className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-gray-500">
          <FiBookOpen size={16} />
          <span className="text-sm font-medium">타임라인 설명서</span>
        </div>
      </div>

      <div className="flex-1" />
      <div className="px-5 pb-6 text-[11px] text-gray-300">© ZeroTime</div>
    </aside>
  );
}
