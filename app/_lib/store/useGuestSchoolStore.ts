import { create } from 'zustand';

import { GUEST_SCHOOL_KEY, DEFAULT_GUEST_SCHOOL } from '@/_lib/constants/boards';

interface GuestSchoolState {
  guestSchool: string;
  isHydrated: boolean;
  setGuestSchool: (school: string) => void;
  hydrate: () => void;
}

/**
 * 게스트가 고른 학교의 전역 상태.
 *
 * 이전엔 컴포넌트마다 독립된 useState + localStorage로 관리했는데,
 * 같은 화면에 이 상태를 쓰는 컴포넌트가 여러 개(드롭다운, 공지 목록,
 * 상단 배너, 게시판 선택 화면)라 한 곳에서 바꿔도 다른 컴포넌트는
 * localStorage만 갱신되고 자기 자신의 React state는 그대로라 화면
 * 이동 전까지 반영이 안 되는 버그가 있었다(실측 확인됨: 학교를 바꿔도
 * 공지 목록 API가 이전 학교 board_codes로 계속 요청됨).
 * Zustand 전역 스토어(useUserStore와 동일 패턴)로 바꿔 모든 소비처가
 * 하나의 상태를 공유하게 한다.
 */
export const useGuestSchoolStore = create<GuestSchoolState>((set) => ({
  guestSchool: DEFAULT_GUEST_SCHOOL,
  isHydrated: false,
  setGuestSchool: (school) => {
    set({ guestSchool: school });
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(GUEST_SCHOOL_KEY, school);
    } catch (error) {
      console.error('Failed to save guest school to localStorage:', error);
    }
  },
  hydrate: () =>
    set((state) => {
      if (state.isHydrated || typeof window === 'undefined') return state;
      const saved = localStorage.getItem(GUEST_SCHOOL_KEY);
      return { guestSchool: saved || DEFAULT_GUEST_SCHOOL, isHydrated: true };
    }),
}));
