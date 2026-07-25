'use client';

import { useMemo, useState } from 'react';

import { FiSearch, FiUser } from 'react-icons/fi';

import type { TeamRole } from '@/_types/team';

export interface PickableMember {
  member_id: number;
  nickname: string;
  profile_image?: string | null;
  role?: TeamRole;
}

const ROLE_LABELS: Partial<Record<TeamRole, string>> = {
  captain: '회장',
  executive: '운영진',
};

interface MemberPickerSheetProps {
  title: string;
  members: PickableMember[];
  onConfirm: (memberIds: number[]) => void;
  onCancel: () => void;
}

/**
 * 멤버를 눌러서 고르는 다중 선택 시트 (카톡 초대 화면 대응).
 * 오버레이 z-[60] — FullPageModal 안에서 열려도 위로 올라온다.
 */
export default function MemberPickerSheet({
  title,
  members,
  onConfirm,
  onCancel,
}: MemberPickerSheetProps) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => m.nickname.toLowerCase().includes(q));
  }, [members, query]);

  const toggle = (memberId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[70vh] w-full max-w-xs flex-col overflow-hidden rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-3 text-center text-base font-semibold text-gray-900">{title}</p>

        {members.length > 0 && (
          <div className="relative mb-3">
            <FiSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="이름 검색"
              aria-label="이름 검색"
              className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-3 text-sm text-gray-800 outline-none transition-colors focus:border-gray-900"
            />
          </div>
        )}

        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {members.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">추가할 멤버가 없습니다</p>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">검색 결과가 없습니다</p>
          ) : (
            filtered.map((m) => {
              const isSelected = selected.has(m.member_id);
              const roleLabel = m.role ? ROLE_LABELS[m.role] : undefined;
              return (
                <button
                  key={m.member_id}
                  type="button"
                  onClick={() => toggle(m.member_id)}
                  aria-pressed={isSelected}
                  className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors ${
                    isSelected ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-xs ${
                      isSelected ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300'
                    }`}
                  >
                    {isSelected && '✓'}
                  </span>

                  {m.profile_image ? (
                    <img
                      src={m.profile_image}
                      alt=""
                      className="h-8 w-8 shrink-0 rounded-full border border-gray-100 object-cover"
                    />
                  ) : (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-100 bg-gray-50 text-gray-400">
                      <FiUser size={14} />
                    </span>
                  )}

                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-700">
                    {m.nickname}
                  </span>

                  {roleLabel && (
                    <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                      {roleLabel}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="mt-4 flex shrink-0 gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50 active:scale-95"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => onConfirm(Array.from(selected))}
            disabled={selected.size === 0}
            className="flex-1 rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white transition-all hover:bg-gray-800 active:scale-95 disabled:opacity-50"
          >
            {selected.size > 0 ? `${selected.size}명 추가` : '추가'}
          </button>
        </div>
      </div>
    </div>
  );
}
