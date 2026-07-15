'use client';

import { useEffect, useState, useMemo, useRef, Suspense, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useInView } from 'react-intersection-observer';
import { fetchNoticesInfinite, searchNotices, Notice } from '@/_lib/api';
import { smoothScrollToTop } from '@/_lib/utils/scroll';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useSelectedCategories } from '@/_lib/hooks/useSelectedCategories';
import { usePullToRefresh } from '@/_lib/hooks/usePullToRefresh';
import { useUser } from '@/_lib/hooks/useUser';
import { useToast } from '@/_context/ToastContext';
import { useNotificationBadge } from '@/_context/NotificationBadgeContext';
import { useFilterState } from './_hooks/useFilterState';
import { useNoticeActions } from './_hooks/useNoticeActions';
import { useNoticeFiltering } from './_hooks/useNoticeFiltering';
import OnboardingModal from './_components/OnboardingModal';
import NoticeList from './_components/NoticeList';
import CategoryFilter from '@/_components/ui/CategoryFilter';
import KeywordSettingsBar from '@/_components/ui/KeywordSettingsBar';
import ScrollToTop from '@/_components/ui/ScrollToTop';
import PullToRefreshIndicator from '@/_components/ui/PullToRefreshIndicator';
import UserStatsBanner from '@/_components/ui/UserStatsBanner';
import { useGuestSchool } from '@/_lib/hooks/useGuestSchool';

// Dayjs 설정
dayjs.extend(relativeTime);
dayjs.locale('ko');


function HomeContent() {
  const router = useRouter();
  const { showToast } = useToast();
  const [isMounted, setIsMounted] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  // Infinite scroll root element state
  const [scrollRoot, setScrollRoot] = useState<HTMLElement | null>(null);
  // 초기 마운트 시 visibilitychange 무시를 위한 ref
  const isInitialMount = useRef(true);

  // 검색 상태: 입력값(searchInput)을 300ms 디바운스해 debouncedSearch로 반영
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);
  const isSearching = debouncedSearch.length > 0;

  // 클라이언트 마운트 체크
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Custom Hooks
  const { isLoggedIn, isAuthLoaded, refetch: refetchUser, user } = useUser();
  const { guestSchool } = useGuestSchool();
  const {
    selectedCategories,
    updateSelectedCategories,
    isLoading: isCategoriesLoading
  } = useSelectedCategories();

  // 쿼리 준비 상태 추적
  const [isQueryReady, setIsQueryReady] = useState(false);

  // 모든 의존성이 준비되면 쿼리 활성화
  useEffect(() => {
    if (isMounted && !isCategoriesLoading && selectedCategories.length > 0) {
      setIsQueryReady(true);
    }
  }, [isMounted, isCategoriesLoading, selectedCategories.length]);

  // Pull to Refresh용 스크롤 컨테이너 ref 초기화
  const { scrollContainerRef, isPulling, pullDistance, refreshing } = usePullToRefresh({
    onRefresh: async () => {
      if (filter === 'KEYWORD') {
        await refreshKeywordNotices();
        return;
      }
      await refetch();
    },
    enabled: true,
  });

  const { filter, setFilter } = useFilterState({
    isLoggedIn,
    isAuthLoaded,
    isMounted,
    scrollContainerRef,
  });

  const { keywordNotices, keywordCount, refreshKeywordNotices, markKeywordNoticesSeen } = useNotificationBadge();

  // 게시판 목록
  const selectedBoards = selectedCategories;
  const selectedBoardsParam = useMemo(
    () => (selectedBoards.length > 0 ? [...selectedBoards].sort().join(',') : undefined),
    [selectedBoards],
  );

  // 무한 스크롤 쿼리
  const {
    data: noticePages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['notices', 'infinite', selectedBoardsParam, filter],
    queryFn: ({ pageParam }) => fetchNoticesInfinite(
      pageParam,
      20,
      true,
      selectedBoards,
      filter === 'FAVORITE'
    ),
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    initialPageParam: null as string | null,
    enabled: isQueryReady,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  // 검색 무한 스크롤 쿼리 (검색어가 있을 때만 활성 — 전체 게시판 대상, 필터 무관)
  const {
    data: searchPages,
    fetchNextPage: fetchNextSearchPage,
    hasNextPage: hasNextSearchPage,
    isFetchingNextPage: isFetchingNextSearchPage,
    isLoading: isSearchLoading,
  } = useInfiniteQuery({
    queryKey: ['notices', 'search', debouncedSearch],
    queryFn: ({ pageParam }) => searchNotices(debouncedSearch, pageParam, 20),
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    initialPageParam: null as string | null,
    enabled: isQueryReady && isSearching,
    staleTime: 60_000,
  });

  const searchResults = useMemo<Notice[]>(() => {
    const pages = searchPages?.pages;
    if (!Array.isArray(pages)) return [];
    return pages.flatMap((page) => (Array.isArray(page?.items) ? page.items : []));
  }, [searchPages]);

  const handleLogoTap = useCallback(async () => {
    smoothScrollToTop(scrollContainerRef.current ?? null);
    if (filter === 'KEYWORD') {
      await refreshKeywordNotices();
    } else {
      await refetch();
    }
  }, [filter, refetch, refreshKeywordNotices, scrollContainerRef]);

  useEffect(() => {
    window.addEventListener('logo-tap', handleLogoTap);
    return () => window.removeEventListener('logo-tap', handleLogoTap);
  }, [handleLogoTap]);

  // 모든 페이지의 공지사항을 하나의 배열로 합치기
  const notices = useMemo<Notice[]>(() => {
    const pages = noticePages?.pages;
    if (!Array.isArray(pages)) return [];
    return pages.flatMap((page) =>
      Array.isArray(page?.items) ? page.items : [],
    );
  }, [noticePages]);

  // 공지사항 액션
  const { handleMarkAsRead, handleToggleFavorite } = useNoticeActions(isLoggedIn);

  // 공지사항 필터링
  const { filteredNotices } = useNoticeFiltering(
    notices,
    keywordNotices,
    selectedBoards,
    isLoggedIn,
    filter
  );

  // 검색 중이면 검색 결과를, 아니면 기존 필터 결과를 표시하고
  // 무한 스크롤 제어(다음 페이지 로드)도 활성 쿼리 쪽으로 전환한다
  const displayNotices = isSearching ? searchResults : filteredNotices;
  // 검색 전체 결과 개수 (첫 페이지 응답의 total_count)
  const searchTotalCount = isSearching ? (searchPages?.pages?.[0]?.total_count ?? null) : null;
  const activeHasNextPage = isSearching ? hasNextSearchPage : hasNextPage;
  const activeIsFetchingNextPage = isSearching ? isFetchingNextSearchPage : isFetchingNextPage;
  const activeFetchNextPage = isSearching ? fetchNextSearchPage : fetchNextPage;
  const activeIsLoading = isSearching ? isSearchLoading : isLoading;

  // Intersection Observer로 스크롤 끝 감지
  const { ref: loadMoreRef, inView } = useInView({
    root: scrollRoot,
    rootMargin: '0px 0px 2000px 0px',
    threshold: 0,
  });

  // 스크롤이 끝에 가까워지면 다음 페이지 로드 (검색 중엔 검색 쿼리 기준)
  useEffect(() => {
    if (!isSearching && filter === 'KEYWORD') return;
    if (activeIsLoading) return;
    if (!inView) return;
    if (!activeHasNextPage) return;
    if (activeIsFetchingNextPage) return;
    activeFetchNextPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSearching, filter, activeIsLoading, inView, activeHasNextPage, activeIsFetchingNextPage]);

  // 즐겨찾기 탭 진입 시 최신 목록으로 갱신
  useEffect(() => {
    if (!isMounted) return;
    if (filter === 'FAVORITE') {
      refetch();
    }
  }, [filter, isMounted, refetch]);

  // 페이지 visibility 변경 시 새로고침
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (isInitialMount.current) {
        isInitialMount.current = false;
        return;
      }

      if (document.visibilityState === 'visible') {
        if (isLoggedIn) {
          refetchUser();
        }
        if (filter === 'ALL') {
          refetch();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [filter, isLoggedIn, refetch, refetchUser]);

  useEffect(() => {
    if (!isMounted || !isLoggedIn) return;
    if (filter === 'KEYWORD') {
      refreshKeywordNotices();
    }
  }, [filter, isMounted, isLoggedIn]);

  useEffect(() => {
    if (filter === 'KEYWORD') {
      markKeywordNoticesSeen(keywordNotices);
    }
  }, [filter, keywordNotices]);

  // 온보딩 완료 핸들러
  const handleOnboardingComplete = (categories: string[]) => {
    updateSelectedCategories(categories);
    setShowOnboarding(false);
  };

  // 로그인 결과 처리 (쿼리 파라미터 확인)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const loginStatus = params.get('login');
    const showOnboardingParam = params.get('show_onboarding');
    const logoutStatus = params.get('logout');
    const loginCancelled = params.get('login_cancelled');

    if (loginStatus === 'success') {
      if (showOnboardingParam === 'true') {
        setShowOnboarding(true);
      }
      showToast('로그인에 성공했습니다!', 'success');
      router.replace('/');
    } else if (loginStatus === 'failed') {
      showToast('로그인 처리에 실패했습니다.', 'error');
      router.replace('/');
    } else if (params.get('deleted') === 'success') {
      showToast('회원 탈퇴가 완료되었습니다.', 'info');
      router.replace('/');
    } else if (logoutStatus === 'success') {
      showToast('로그아웃되었습니다.', 'info');
      router.replace('/');
    } else if (loginCancelled === 'true') {
      showToast('로그인이 취소되었습니다.', 'info');
      router.replace('/');
    }
  }, [router, showToast]);

  useEffect(() => {
    if (!isAuthLoaded || !isLoggedIn || !user) return;
    const needsOnboarding = !user.user_type;
    if (needsOnboarding) {
      setShowOnboarding(true);
    }
  }, [isAuthLoaded, isLoggedIn, user]);

  const selectedBoardsForList = filter === 'KEYWORD' ? ['keyword'] : selectedBoards;

  return (
    <>
      <OnboardingModal isOpen={showOnboarding} onComplete={handleOnboardingComplete} onShowToast={showToast} />

      {/* User Stats Banner — 게스트일 땐 배너 우측에 학교 선택 드롭다운도 함께 렌더 (UserStatsBanner 내부) */}
      <UserStatsBanner isLoggedIn={isLoggedIn} school={user?.school || guestSchool} onSignupClick={() => router.push('/login')} />

        {/* 카테고리 필터 */}
        <div className="shrink-0" style={{ touchAction: 'none' }}>
          <CategoryFilter
            activeFilter={filter}
            onFilterChange={(f) => setFilter(f as any)}
            isLoggedIn={isLoggedIn}
            onSettingsClick={() => router.push('/filter')}
            onShowToast={showToast}
            searchValue={searchInput}
            onSearchChange={setSearchInput}
          />
        </div>

      {/* 키워드 필터일 때만 키워드 설정 바 표시 (검색 중엔 숨김) */}
      {filter === 'KEYWORD' && !isSearching && (
        <KeywordSettingsBar
          keywordCount={keywordCount ?? 0}
          onSettingsClick={() => router.push('/keywords')}
        />
      )}

      {/* Pull to Refresh 인디케이터 */}
      <PullToRefreshIndicator
        isPulling={isPulling}
        pullDistance={pullDistance}
        refreshing={refreshing}
      />

      <ScrollToTop containerRef={scrollContainerRef as React.RefObject<HTMLElement>} />

      {/* 공지사항 리스트 */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        <div
          ref={(node) => {
            if (scrollContainerRef && 'current' in scrollContainerRef) {
              (scrollContainerRef as React.MutableRefObject<HTMLElement | null>).current = node;
            }
            if (node !== scrollRoot) {
              setScrollRoot(node);
            }
          }}
          className="h-full overflow-y-auto"
          style={{
            touchAction: 'pan-y',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
          }}
        >
          {/* 검색 결과 개수 표시 (결과가 1건 이상일 때만 — 0건은 아래 빈 상태가 안내) */}
          {isSearching && !activeIsLoading && searchTotalCount !== null && searchTotalCount > 0 && (
            <div className="px-4 pt-3 pb-1 text-sm text-gray-500">
              <span className="font-semibold text-gray-800">&apos;{debouncedSearch}&apos;</span> 검색 결과{' '}
              <span className="font-semibold text-gray-800">{searchTotalCount.toLocaleString()}</span>건
            </div>
          )}

          <NoticeList
            loading={activeIsLoading || isCategoriesLoading}
            selectedCategories={isSearching ? selectedBoards : selectedBoardsForList}
            filteredNotices={displayNotices}
            showKeywordPrefix={isSearching || filter === 'KEYWORD' || filter === 'ALL'}
            onMarkAsRead={handleMarkAsRead}
            onToggleFavorite={handleToggleFavorite}
            isInFavoriteTab={!isSearching && filter === 'FAVORITE'}
            isLoggedIn={isLoggedIn}
            onOpenBoardFilter={() => router.push('/filter')}
            onShowToast={showToast}
            emptyMessage={
              isSearching
                ? `'${debouncedSearch}'에 대한 검색 결과가 없어요`
                : filter === 'KEYWORD'
                  ? (keywordCount === 0
                    ? '키워드를 등록하면 관련 공지가 모여요'
                    : '아직 키워드에 맞는 공지사항이 없어요')
                  : filter === 'UNREAD'
                    ? '모든 공지사항을 다 읽었어요'
                    : '표시할 공지사항이 없어요'
            }
            emptyDescription={
              isSearching
                ? '다른 검색어로 시도해 보세요'
                : filter === 'KEYWORD'
                  ? (keywordCount === 0
                    ? '키워드를 추가해 주세요'
                    : '새 공지가 올라오면 여기에 표시돼요')
                  : undefined
            }
          />

          {/* 무한 스크롤 (검색 중엔 검색 결과 기준, 키워드 탭은 무한스크롤 없음) */}
          {(isSearching || filter !== 'KEYWORD') && (
            <>
              {activeHasNextPage && (
                <div
                  ref={loadMoreRef}
                  className="py-4 text-center cursor-pointer text-gray-400 text-sm hover:text-gray-600 active:scale-95 transition-transform"
                  onClick={() => {
                    if (!activeIsFetchingNextPage) {
                      activeFetchNextPage();
                    }
                  }}
                >
                  {activeIsFetchingNextPage ? (
                    <div className="flex justify-center items-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                      <span>불러오는 중...</span>
                    </div>
                  ) : (
                    <span>더 불러오려면 터치하세요</span>
                  )}
                </div>
              )}

              {!activeHasNextPage && displayNotices.length > 0 && (
                <div className="py-8 text-center text-sm text-gray-400">
                  {isSearching ? '검색 결과를 모두 불러왔어요' : '모든 공지사항을 불러왔어요'}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-gray-900" />
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
