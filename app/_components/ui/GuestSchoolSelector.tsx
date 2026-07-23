'use client';

import { useEffect, useRef, useState } from 'react';
import { FiShield, FiChevronDown, FiCheck } from 'react-icons/fi';

import { GUEST_SCHOOL_OPTIONS, SCHOOL_FULL_NAME } from '@/_lib/constants/boards';
import { useGuestSchool } from '@/_lib/hooks/useGuestSchool';

/**
 * 게스트(비로그인) 전용 학교 선택 드롭다운.
 * 로그인 사용자는 이 컴포넌트를 아예 렌더링하지 않는다 — 학교는
 * 프로필 수정 화면(UserInfoForm)에서만 바꾼다.
 *
 * 실제 학교 로고/엠블럼 이미지가 없어 FiShield 아이콘으로 대체 —
 * 로고 파일이 생기면 학교별 이미지로 교체.
 */
export default function GuestSchoolSelector() {
  const { guestSchool, setGuestSchool } = useGuestSchool();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (school: string) => {
    setGuestSchool(school);
    setIsOpen(false);
  };

  return (
    <div className="relative w-fit shrink-0" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm"
        aria-label="둘러볼 학교 선택"
        aria-expanded={isOpen}
      >
        <FiShield className="shrink-0 text-blue-900" size={18} />
        <span className="text-sm font-semibold text-gray-800">
          {SCHOOL_FULL_NAME[guestSchool] ?? guestSchool}
        </span>
        <FiChevronDown
          className={`shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          size={14}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-10 mt-2 w-full min-w-40 overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-lg">
          {GUEST_SCHOOL_OPTIONS.map((school) => (
            <button
              key={school}
              type="button"
              onClick={() => handleSelect(school)}
              className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm hover:bg-gray-50"
            >
              <span
                className={school === guestSchool ? 'font-semibold text-gray-900' : 'text-gray-600'}
              >
                {SCHOOL_FULL_NAME[school] ?? school}
              </span>
              {school === guestSchool && <FiCheck className="text-blue-900" size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
