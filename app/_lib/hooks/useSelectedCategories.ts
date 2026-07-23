import { useState, useEffect } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { getUserInit, getUserSubscriptions, updateUserSubscriptions, getBoards } from '@/_lib/api';
import { checkHasToken } from '@/_lib/api/auth';
import { GUEST_FILTER_KEY, GUEST_FILTER_SCHOOL_KEY, GUEST_DEFAULT_BOARDS, DEFAULT_GUEST_SCHOOL, getDefaultBoardCodes } from '@/_lib/constants/boards';
import { useGuestSchool } from '@/_lib/hooks/useGuestSchool';
import { useGuestSchoolStore } from '@/_lib/store/useGuestSchoolStore';
import { useAuthInitialized } from '@/providers';

/** localStorage(JSON 배열)를 안전하게 파싱한다 — 실패/비배열/빈 배열은 전부 "유효한 캐시 없음"으로 취급. */
function parseNonEmptyBoardCodes(raw: string | null): string[] | null {
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

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

        const requestedSchool = guestSchool;
        const savedSchool = localStorage.getItem(GUEST_FILTER_SCHOOL_KEY);
        const parsedSaved = parseNonEmptyBoardCodes(localStorage.getItem(GUEST_FILTER_KEY));

        // 학교가 바뀌었는지 판단. 마커가 없는 기존 사용자는 아직 기본 학교(전북대)를
        // 보고 있는 한 "안 바뀐 것"으로 간주해 기존 선택을 건드리지 않는다.
        const schoolChanged = savedSchool
          ? savedSchool !== requestedSchool
          : requestedSchool !== DEFAULT_GUEST_SCHOOL;

        // 학교가 바뀌었거나, 캐시가 아예 없거나(첫 방문/파싱 실패), 예전에 API 실패로
        // []가 잘못 저장돼 있던 경우(자동 복구 대상)엔 새로 받아온다.
        if (schoolChanged || parsedSaved === null) {
          let confirmedCategories: string[] | null = null;
          try {
            const boards = await getBoards(requestedSchool);
            const codes = getDefaultBoardCodes(boards);
            // 빈 결과는 "확정된 게시판 없음"이 아니라 API 이상 신호로 취급 — 성공해도
            // 1개 이상일 때만 새 학교 캐시로 확정한다.
            if (codes.length > 0) confirmedCategories = codes;
          } catch (error) {
            console.error('Failed to fetch default boards, falling back:', error);
          }

          // 응답을 기다리는 사이 사용자가 다른 학교로 또 전환했다면 이 응답은 오래된
          // 것이므로 버린다 — 늦게 도착한 응답이 최신 학교 선택을 덮어쓰지 않게 한다.
          if (useGuestSchoolStore.getState().guestSchool !== requestedSchool) {
            return;
          }

          if (confirmedCategories) {
            // API 성공 + 기본 게시판 1개 이상일 때만 새 학교 캐시를 확정 저장한다.
            localStorage.setItem(GUEST_FILTER_KEY, JSON.stringify(confirmedCategories));
            localStorage.setItem(GUEST_FILTER_SCHOOL_KEY, requestedSchool);
            setSelectedCategories(confirmedCategories);
          } else if (requestedSchool === DEFAULT_GUEST_SCHOOL && parsedSaved === null) {
            // 유지할 기존 캐시가 전혀 없고 전북대인 경우에만 하드코딩 폴백을 쓴다.
            // 이 폴백은 API 확정 결과가 아니므로 localStorage엔 저장하지 않는다 —
            // 다음 로드 때 다시 API를 시도한다.
            setSelectedCategories([...GUEST_DEFAULT_BOARDS]);
          }
          // 그 외(실패/빈 응답 + 유지할 기존 캐시 없음 + 전북대도 아님)엔 아무것도
          // 하지 않는다 — 기존 selectedCategories를 그대로 두어 화면이 갑자기
          // 비워지지 않게 하고, localStorage에도 실패를 "확정"으로 남기지 않아
          // 다음 로드(새로고침)에서 API를 다시 시도하게 한다.
        } else {
          // 기존 값 사용 (같은 학교 + 유효한 비어있지 않은 캐시)
          setSelectedCategories(parsedSaved);
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
