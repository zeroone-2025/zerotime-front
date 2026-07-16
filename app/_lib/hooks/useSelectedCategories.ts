import { useState, useEffect } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { getUserInit, getUserSubscriptions, updateUserSubscriptions, getBoards } from '@/_lib/api';
import { checkHasToken } from '@/_lib/api/auth';
import { GUEST_FILTER_KEY, GUEST_FILTER_SCHOOL_KEY, GUEST_DEFAULT_BOARDS, DEFAULT_GUEST_SCHOOL, getDefaultBoardCodes } from '@/_lib/constants/boards';
import { useGuestSchool } from '@/_lib/hooks/useGuestSchool';
import { useAuthInitialized } from '@/providers';

const USER_STORAGE_KEY = 'my_subscribed_categories'; // 로그인 사용자 캐시 키

/**
 * 선택된 카테고리를 관리하는 hook
 *
 * **하이브리드 저장소 전략:**
 * - Guest (비로그인): localStorage (GUEST_FILTER_KEY)만 사용, 학교별 기본값은
 *   guestSchool(useGuestSchool)이 바뀔 때마다 GET /boards의 default_subscribe로 재계산
 * - User (로그인): DB (API) + localStorage 캐시
 */
export function useSelectedCategories() {
  // SSR-safe: 서버와 클라이언트의 초기 상태를 동일하게 유지
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isAuthInitialized = useAuthInitialized();
  const queryClient = useQueryClient();
  const hasToken = isAuthInitialized && checkHasToken();
  const isLoggedIn = hasToken;
  const { guestSchool, isLoading: isGuestSchoolLoading } = useGuestSchool();

  // 초기 로딩: 로그인 여부에 따라 다른 저장소 사용
  useEffect(() => {
    const loadCategories = async () => {
      // 인증 상태 확인이 안 되었다면 대기
      if (!isAuthInitialized) return;

      // 클라이언트에서만 실행
      if (typeof window === 'undefined') {
        setIsLoading(false);
        return;
      }

      if (isLoggedIn) {
        // ✅ User: ensureQueryData로 ['user', 'init'] 캐시 활용 (race condition 해결)
        try {
          const initData = await queryClient.ensureQueryData({
            queryKey: ['user', 'init'],
            queryFn: getUserInit,
          });
          const subscriptions = initData.subscriptions;
          const boardCodes = subscriptions.map(sub => sub.board_code);
          setSelectedCategories(boardCodes);

          // localStorage에 캐시 저장
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(boardCodes));
        } catch (error) {
          try {
            const subscriptions = await getUserSubscriptions();
            const boardCodes = subscriptions.map(sub => sub.board_code);
            setSelectedCategories(boardCodes);
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(boardCodes));
          } catch (fallbackError) {
            console.error('Failed to load subscriptions:', fallbackError);
            // API 실패 시 빈 배열 (page.tsx에서 home_campus로 fallback)
            setSelectedCategories([]);
          }
        }
      } else {
        // ✅ Guest: localStorage에서만 읽기 (구독 저장 자체는 API 호출 안 함)
        // 게스트가 고른 학교가 아직 안 정해졌으면(useGuestSchool 마운트 전) 대기
        if (isGuestSchoolLoading) return;

        const savedSchool = localStorage.getItem(GUEST_FILTER_SCHOOL_KEY);
        const saved = localStorage.getItem(GUEST_FILTER_KEY);

        // 학교가 바뀌었는지 판단. 마커가 없는 기존 사용자는 아직 기본 학교(전북대)를
        // 보고 있는 한 "안 바뀐 것"으로 간주해 기존 선택을 건드리지 않는다.
        const schoolChanged = savedSchool
          ? savedSchool !== guestSchool
          : guestSchool !== DEFAULT_GUEST_SCHOOL;

        if (schoolChanged || !saved) {
          // 새 학교의 기본 구독 게시판을 API에서 가져와 초기화
          let defaultCategories: string[];
          try {
            const boards = await getBoards(guestSchool);
            defaultCategories = getDefaultBoardCodes(boards);
          } catch (error) {
            console.error('Failed to fetch default boards, falling back:', error);
            defaultCategories = guestSchool === DEFAULT_GUEST_SCHOOL ? [...GUEST_DEFAULT_BOARDS] : [];
          }
          localStorage.setItem(GUEST_FILTER_KEY, JSON.stringify(defaultCategories));
          localStorage.setItem(GUEST_FILTER_SCHOOL_KEY, guestSchool);
          setSelectedCategories(defaultCategories);
        } else {
          // 기존 값 사용 (같은 학교)
          try {
            const parsed = JSON.parse(saved);
            setSelectedCategories(Array.isArray(parsed) ? parsed : []);
          } catch {
            setSelectedCategories([]);
          }
        }
      }

      setIsLoading(false);
    };

    loadCategories();
  }, [isAuthInitialized, hasToken, isLoggedIn, queryClient, guestSchool, isGuestSchoolLoading]);

  // 선택 변경: 로그인 여부에 따라 다른 저장소에 저장
  const updateSelectedCategories = async (categories: string[]) => {
    const previousCategories = selectedCategories;

    // 1. UI 먼저 업데이트 (Optimistic Update)
    setSelectedCategories(categories);

    if (isLoggedIn) {
      // ✅ User: 백엔드 API 호출 (DB 저장)
      try {
        await updateUserSubscriptions(categories);
        // 성공 시 localStorage 캐시 저장
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(categories));
        // ['user', 'init'] 캐시 무효화 → 홈 페이지 마운트 시 최신 구독 정보 로드
        queryClient.invalidateQueries({ queryKey: ['user', 'init'] });
        // 공지 목록 캐시 무효화 → 변경된 게시판 구독에 맞는 공지 다시 로드
        queryClient.invalidateQueries({ queryKey: ['notices', 'infinite'] });
      } catch (error) {
        console.error('Failed to save subscriptions to backend:', error);
        // 실패 시 롤백
        setSelectedCategories(previousCategories);
        alert('설정 저장에 실패했습니다. 다시 시도해주세요.');
      }
    } else {
      // ✅ Guest: localStorage에만 저장 (API 호출 차단)
      try {
        localStorage.setItem(GUEST_FILTER_KEY, JSON.stringify(categories));
      } catch (error) {
        console.error('Failed to save to localStorage:', error);
        setSelectedCategories(previousCategories);
        alert('설정 저장에 실패했습니다.');
      }
    }
  };

  // 카테고리 토글
  const toggleCategory = async (categoryId: string) => {
    const previousCategories = selectedCategories;
    const newSelection = previousCategories.includes(categoryId)
      ? previousCategories.filter((id) => id !== categoryId)
      : [...previousCategories, categoryId];

    await updateSelectedCategories(newSelection);
  };

  // 전체 선택 (현재 로그인 사용자의 학교 게시판 전체 — 미지정 시 전체 학교)
  const selectAll = async () => {
    const boards = await getBoards();
    await updateSelectedCategories(boards.map((board) => board.board_code));
  };

  // 전체 해제
  const deselectAll = async () => {
    await updateSelectedCategories([]);
  };

  return {
    selectedCategories,
    isLoading,
    updateSelectedCategories,
    toggleCategory,
    selectAll,
    deselectAll,
  };
}
