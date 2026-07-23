'use client';

import { useEffect } from 'react';

import { useGuestSchoolStore } from '@/_lib/store/useGuestSchoolStore';

/**
 * 게스트(비로그인)가 둘러볼 학교를 조회/변경하는 훅.
 * 로그인 사용자는 이 훅을 쓰지 않는다 — user.school이 기준이다.
 *
 * 실제 상태는 useGuestSchoolStore(Zustand, 전역 공유)에 있다 — 여러
 * 컴포넌트가 동시에 이 훅을 부르므로 각자 로컬 state를 가지면 한 곳의
 * 변경이 다른 곳에 안 퍼진다(과거 실제 버그). 이 훅은 마운트 시
 * localStorage에서 한 번 hydrate하는 역할만 한다.
 */
export function useGuestSchool() {
  const guestSchool = useGuestSchoolStore((state) => state.guestSchool);
  const setGuestSchool = useGuestSchoolStore((state) => state.setGuestSchool);
  const isHydrated = useGuestSchoolStore((state) => state.isHydrated);
  const hydrate = useGuestSchoolStore((state) => state.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return { guestSchool, setGuestSchool, isLoading: !isHydrated };
}
