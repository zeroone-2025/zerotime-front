'use client';

import { useState, useEffect, useCallback } from 'react';

import { GUEST_SCHOOL_KEY, DEFAULT_GUEST_SCHOOL } from '@/_lib/constants/boards';

/**
 * 게스트(비로그인)가 둘러볼 학교를 localStorage에 저장/조회하는 훅.
 * 로그인 사용자는 이 훅을 쓰지 않는다 — user.school이 기준이다.
 *
 * SSR-safe: 서버 렌더와 클라이언트 최초 렌더를 일치시키기 위해, 마운트
 * 전에는 항상 DEFAULT_GUEST_SCHOOL을 반환하고 마운트 후 localStorage
 * 값으로 갱신한다(useSelectedCategories와 동일 패턴).
 */
export function useGuestSchool() {
  const [guestSchool, setGuestSchoolState] = useState(DEFAULT_GUEST_SCHOOL);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsLoading(false);
      return;
    }

    const saved = localStorage.getItem(GUEST_SCHOOL_KEY);
    if (saved) {
      setGuestSchoolState(saved);
    }
    setIsLoading(false);
  }, []);

  const setGuestSchool = useCallback((school: string) => {
    setGuestSchoolState(school);
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(GUEST_SCHOOL_KEY, school);
    } catch (error) {
      console.error('Failed to save guest school to localStorage:', error);
    }
  }, []);

  return { guestSchool, setGuestSchool, isLoading };
}
