import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';


import type { BoardInfo } from '@/_lib/api/boards';
import { GUEST_FILTER_KEY, GUEST_FILTER_SCHOOL_KEY, GUEST_DEFAULT_BOARDS, DEFAULT_GUEST_SCHOOL } from '@/_lib/constants/boards';
import { useGuestSchoolStore } from '@/_lib/store/useGuestSchoolStore';

import { useSelectedCategories } from './useSelectedCategories';

const mocks = vi.hoisted(() => ({
  getBoards: vi.fn(),
}));

vi.mock('@/_lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/_lib/api')>();
  return {
    ...actual,
    getBoards: mocks.getBoards,
  };
});

vi.mock('@/_lib/api/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/_lib/api/auth')>();
  return {
    ...actual,
    checkHasToken: () => false, // 항상 게스트
  };
});

vi.mock('@/providers', () => ({
  useAuthInitialized: () => true,
}));

function makeBoards(school: string, codes: string[]): BoardInfo[] {
  return codes.map((code) => ({
    board_code: code,
    name: code,
    school,
    category: '본부' as const,
    default_subscribe: true,
  }));
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient();
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useSelectedCategories (guest)', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.getBoards.mockReset();
    useGuestSchoolStore.setState({ guestSchool: DEFAULT_GUEST_SCHOOL, isHydrated: true });
  });

  it('전남대 선택 → /boards 성공 → 전남대 기본 게시판을 저장한다', async () => {
    useGuestSchoolStore.setState({ guestSchool: '전남대', isHydrated: true });
    mocks.getBoards.mockResolvedValue(makeBoards('전남대', ['jnu_home_a', 'jnu_home_b']));

    const { result } = renderHook(() => useSelectedCategories(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.selectedCategories).toEqual(['jnu_home_a', 'jnu_home_b']);
    expect(JSON.parse(localStorage.getItem(GUEST_FILTER_KEY)!)).toEqual(['jnu_home_a', 'jnu_home_b']);
    expect(localStorage.getItem(GUEST_FILTER_SCHOOL_KEY)).toBe('전남대');
  });

  it('경북대 선택 → /boards 실패 → []와 경북대 마커를 저장하지 않는다', async () => {
    useGuestSchoolStore.setState({ guestSchool: '경북대', isHydrated: true });
    mocks.getBoards.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useSelectedCategories(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // 화면이 빈 배열로 굳어지면 안 된다 — 실패를 확정 저장하지 않는다.
    expect(localStorage.getItem(GUEST_FILTER_KEY)).toBeNull();
    expect(localStorage.getItem(GUEST_FILTER_SCHOOL_KEY)).toBeNull();
  });

  it('실패 후 새로고침(재마운트) 시 API를 다시 호출한다', async () => {
    useGuestSchoolStore.setState({ guestSchool: '경북대', isHydrated: true });
    mocks.getBoards.mockRejectedValueOnce(new Error('network down'));

    const first = renderHook(() => useSelectedCategories(), { wrapper });
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    first.unmount();

    mocks.getBoards.mockResolvedValueOnce(makeBoards('경북대', ['knu_home_a']));
    const second = renderHook(() => useSelectedCategories(), { wrapper });
    await waitFor(() => expect(second.result.current.isLoading).toBe(false));

    expect(mocks.getBoards).toHaveBeenCalledTimes(2);
    expect(second.result.current.selectedCategories).toEqual(['knu_home_a']);
    expect(localStorage.getItem(GUEST_FILTER_SCHOOL_KEY)).toBe('경북대');
  });

  it('localStorage에 경북대 + []가 이미 있으면 자동으로 재조회해 복구한다', async () => {
    localStorage.setItem(GUEST_FILTER_SCHOOL_KEY, '경북대');
    localStorage.setItem(GUEST_FILTER_KEY, JSON.stringify([]));
    useGuestSchoolStore.setState({ guestSchool: '경북대', isHydrated: true });
    mocks.getBoards.mockResolvedValue(makeBoards('경북대', ['knu_home_a', 'knu_home_b']));

    const { result } = renderHook(() => useSelectedCategories(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mocks.getBoards).toHaveBeenCalledWith('경북대');
    expect(result.current.selectedCategories).toEqual(['knu_home_a', 'knu_home_b']);
    expect(JSON.parse(localStorage.getItem(GUEST_FILTER_KEY)!)).toEqual(['knu_home_a', 'knu_home_b']);
  });

  it('전남대→경북대 빠른 전환에서 전남대의 늦은 응답이 경북대 상태를 덮어쓰지 않는다', async () => {
    let resolveJnu: (boards: BoardInfo[]) => void;
    const jnuPromise = new Promise<BoardInfo[]>((resolve) => {
      resolveJnu = resolve;
    });

    mocks.getBoards.mockImplementation((school?: string) => {
      if (school === '전남대') return jnuPromise;
      if (school === '경북대') return Promise.resolve(makeBoards('경북대', ['knu_home_a']));
      return Promise.resolve([]);
    });

    useGuestSchoolStore.setState({ guestSchool: '전남대', isHydrated: true });
    const { result, rerender } = renderHook(() => useSelectedCategories(), { wrapper });

    // 전남대 응답이 오기 전에 경북대로 전환
    act(() => {
      useGuestSchoolStore.setState({ guestSchool: '경북대' });
    });
    rerender();

    await waitFor(() => expect(result.current.selectedCategories).toEqual(['knu_home_a']));

    // 뒤늦게 전남대 응답이 도착해도 경북대 상태를 덮어쓰면 안 된다.
    resolveJnu!(makeBoards('전남대', ['jnu_home_a']));
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.selectedCategories).toEqual(['knu_home_a']);
    expect(localStorage.getItem(GUEST_FILTER_SCHOOL_KEY)).toBe('경북대');
  });

  it('경상국립대 선택 → /boards 성공했지만 본부 게시판이 0건 → 빈 배열로 확정한다 (API 실패와 구분)', async () => {
    useGuestSchoolStore.setState({ guestSchool: '경상국립대', isHydrated: true });
    mocks.getBoards.mockResolvedValue(makeBoards('경상국립대', [])); // 성공, 결과만 0건

    const { result } = renderHook(() => useSelectedCategories(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.selectedCategories).toEqual([]);
    expect(JSON.parse(localStorage.getItem(GUEST_FILTER_KEY)!)).toEqual([]);
    expect(localStorage.getItem(GUEST_FILTER_SCHOOL_KEY)).toBe('경상국립대');
  });

  it('전남대 선택 후 경상국립대(본부 게시판 0건)로 전환 → 전남대 게시판이 남지 않는다', async () => {
    useGuestSchoolStore.setState({ guestSchool: '전남대', isHydrated: true });
    mocks.getBoards.mockImplementation((school?: string) =>
      Promise.resolve(school === '전남대' ? makeBoards('전남대', ['jnu_home_a']) : makeBoards('경상국립대', [])),
    );

    const { result, rerender } = renderHook(() => useSelectedCategories(), { wrapper });
    await waitFor(() => expect(result.current.selectedCategories).toEqual(['jnu_home_a']));

    act(() => {
      useGuestSchoolStore.setState({ guestSchool: '경상국립대' });
    });
    rerender();

    await waitFor(() => expect(localStorage.getItem(GUEST_FILTER_SCHOOL_KEY)).toBe('경상국립대'));
    // 전남대의 board_code가 남아있으면 안 된다 — 학교 전환이 확정되며 빈 배열로 갱신돼야 한다.
    expect(result.current.selectedCategories).toEqual([]);
  });

  it('전북대 + 캐시 없음 + API 실패 시에는 GUEST_DEFAULT_BOARDS로 폴백하되 저장하지는 않는다', async () => {
    useGuestSchoolStore.setState({ guestSchool: DEFAULT_GUEST_SCHOOL, isHydrated: true });
    mocks.getBoards.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useSelectedCategories(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.selectedCategories).toEqual(GUEST_DEFAULT_BOARDS);
    expect(localStorage.getItem(GUEST_FILTER_KEY)).toBeNull();
    expect(localStorage.getItem(GUEST_FILTER_SCHOOL_KEY)).toBeNull();
  });
});
