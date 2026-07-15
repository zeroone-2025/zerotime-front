'use client';

import { FiHome, FiChevronDown } from 'react-icons/fi';

import { GUEST_SCHOOL_OPTIONS } from '@/_lib/constants/boards';
import { useGuestSchool } from '@/_lib/hooks/useGuestSchool';

const SCHOOL_FULL_NAME: Record<string, string> = {
  전북대: '전북대학교',
  전남대: '전남대학교',
  경북대: '경북대학교',
  충남대: '충남대학교',
};

/**
 * 게스트(비로그인) 전용 학교 선택 드롭다운.
 * 로그인 사용자는 이 컴포넌트를 아예 렌더링하지 않는다 — 학교는
 * 프로필 수정 화면(UserInfoForm)에서만 바꾼다.
 */
export default function GuestSchoolSelector() {
  const { guestSchool, setGuestSchool } = useGuestSchool();

  return (
    <div className="mx-4 mb-3 flex items-center gap-2 rounded-xl border border-dashed border-gray-200 bg-white px-4 py-3">
      <FiHome className="shrink-0 text-gray-500" size={16} />
      <div className="relative flex-1">
        <select
          value={guestSchool}
          onChange={(e) => setGuestSchool(e.target.value)}
          className="w-full appearance-none bg-transparent pr-6 text-sm font-semibold text-gray-800 outline-none"
          aria-label="둘러볼 학교 선택"
        >
          {GUEST_SCHOOL_OPTIONS.map((school) => (
            <option key={school} value={school}>
              {SCHOOL_FULL_NAME[school] ?? school}
            </option>
          ))}
        </select>
        <FiChevronDown
          className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-gray-400"
          size={14}
        />
      </div>
    </div>
  );
}
