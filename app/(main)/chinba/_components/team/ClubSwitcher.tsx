'use client';

import { useCallback, useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';
import { LuCheck, LuChevronDown, LuX } from 'react-icons/lu';

import { useMyTeams } from '@/_lib/hooks/useTeam';
import { setLastTeamId } from '@/_lib/utils/chinbaSelection';

// 동아리가 처음으로 2개 이상이 됐을 때 드롭다운 안내를 1회 보여주기 위한 플래그
// (게시판 필터의 hasSeenFilterTooltip과 같은 패턴)
const HINT_STORAGE_KEY = 'hasSeenClubSwitcherHint';

interface ClubSwitcherProps {
  currentTeamId: number;
  currentName: string;
}

export default function ClubSwitcher({ currentTeamId, currentName }: ClubSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const { data } = useMyTeams();
  const teams = data?.teams ?? [];

  // 동아리가 2개 이상이 된 뒤 처음 이 화면을 보면 드롭다운 안내를 띄운다
  useEffect(() => {
    if (teams.length <= 1) return;
    try {
      if (!localStorage.getItem(HINT_STORAGE_KEY)) setShowHint(true);
    } catch {
      // ignore localStorage errors
    }
  }, [teams.length]);

  const dismissHint = useCallback(() => {
    setShowHint(false);
    try {
      localStorage.setItem(HINT_STORAGE_KEY, 'true');
    } catch {
      // ignore localStorage errors
    }
  }, []);

  // 10초 지나면 자동으로 닫는다 (닫힘 = 봤음 처리 — 다시 안 뜸)
  useEffect(() => {
    if (!showHint) return;
    const timer = setTimeout(dismissHint, 10_000);
    return () => clearTimeout(timer);
  }, [showHint, dismissHint]);

  // 전환할 다른 동아리가 없으면 이름만 표시 (드롭다운 미노출)
  // 제목 태그·스타일은 FullPageModal 헤더가 소유한다 — 여기서 h1을 쓰면 h1 중첩이 된다
  if (teams.length <= 1) {
    return <span className="truncate">{currentName}</span>;
  }

  const handleSelect = (id: number) => {
    setOpen(false);
    if (id === currentTeamId) return;
    setLastTeamId(id);
    // tab 파라미터 제외 → 새 동아리는 기본 탭(mannaja)으로 진입
    router.replace(`/chinba/team/detail?id=${id}`);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          if (showHint) dismissHint();
          setOpen((v) => !v);
        }}
        className="flex items-center gap-1 rounded-lg px-2 py-1 text-base font-bold text-gray-800 transition-colors hover:bg-gray-100 active:scale-95"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="max-w-[60vw] truncate">{currentName}</span>
        <LuChevronDown
          size={18}
          strokeWidth={2.5}
          className={`shrink-0 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* 동아리 전환 안내 툴팁 — 처음으로 동아리가 2개 이상이 됐을 때 1회 노출 */}
      {showHint && !open && (
        <div className="absolute left-1/2 top-full z-[70] mt-2 -translate-x-1/2 animate-fadeIn">
          <div className="relative flex items-center gap-2 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white shadow-lg">
            <span>다른 동아리로 바꾸고 싶다면 클릭하세요</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                dismissHint();
              }}
              className="rounded-full p-0.5 hover:bg-gray-700"
              aria-label="안내 닫기"
            >
              <LuX size={12} />
            </button>
            {/* 화살표 (위쪽 동아리 이름을 향함) */}
            <div className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-gray-900" />
          </div>
        </div>
      )}

      {open && (
        <>
          {/* 바깥 클릭 시 닫힘 */}
          <div className="fixed inset-0 z-[65]" onClick={() => setOpen(false)} />

          <ul
            role="listbox"
            className="absolute left-1/2 top-full z-[70] mt-2 max-h-72 w-56 -translate-x-1/2 overflow-y-auto rounded-2xl border border-gray-100 bg-white p-2 shadow-xl"
          >
            {teams.map((team) => {
              const isCurrent = team.id === currentTeamId;
              return (
                <li key={team.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isCurrent}
                    onClick={() => handleSelect(team.id)}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left transition-colors ${
                      isCurrent ? 'bg-gray-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <span
                      className={`truncate text-sm ${
                        isCurrent ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'
                      }`}
                    >
                      {team.name}
                    </span>
                    {isCurrent && (
                      <LuCheck size={16} strokeWidth={2.5} className="shrink-0 text-gray-900" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
