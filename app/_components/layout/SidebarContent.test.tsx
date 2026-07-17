import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { useGuestSchool } from '@/_lib/hooks/useGuestSchool';
import { useUser } from '@/_lib/hooks/useUser';

import SidebarContent from './SidebarContent';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
}));

vi.mock('@/_lib/hooks/useUser', () => ({ useUser: vi.fn() }));
vi.mock('@/_lib/hooks/useGuestSchool', () => ({ useGuestSchool: vi.fn() }));
vi.mock('@/_lib/hooks/useChinba', () => ({
  useMyChinbaEvents: () => ({ data: [], isLoading: false, refetch: vi.fn() }),
}));

const mockedUseUser = vi.mocked(useUser);
const mockedUseGuestSchool = vi.mocked(useGuestSchool);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asUserHook = (value: object) => value as any;

const renderSidebar = () =>
  render(<SidebarContent onNavigate={vi.fn()} onShowToast={vi.fn()} />);

describe('SidebarContent 알리미 라벨 (F008)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseGuestSchool.mockReturnValue(
      asUserHook({ guestSchool: '전북대', setGuestSchool: vi.fn(), isLoading: false }),
    );
  });

  it('로그인 유저 school=전남대 → "전남대학교 알리미"를 렌더한다', () => {
    mockedUseUser.mockReturnValue(
      asUserHook({
        user: { school: '전남대', dept_code: null },
        isLoggedIn: true,
        isAuthLoaded: true,
        isLoading: false,
      }),
    );

    renderSidebar();

    expect(screen.getByText('전남대학교 알리미')).toBeInTheDocument();
    expect(screen.queryByText('전북대학교 알리미')).not.toBeInTheDocument();
  });

  it('비로그인 + guestSchool 기본값 → "전북대학교 알리미"를 렌더한다', () => {
    mockedUseUser.mockReturnValue(
      asUserHook({ user: null, isLoggedIn: false, isAuthLoaded: true, isLoading: false }),
    );

    renderSidebar();

    expect(screen.getByText('전북대학교 알리미')).toBeInTheDocument();
  });

  it('로그인 유저 school="" → guestSchool로 fallback해 "전북대학교 알리미"를 렌더한다', () => {
    mockedUseUser.mockReturnValue(
      asUserHook({
        user: { school: '', dept_code: null },
        isLoggedIn: true,
        isAuthLoaded: true,
        isLoading: false,
      }),
    );

    renderSidebar();

    expect(screen.getByText('전북대학교 알리미')).toBeInTheDocument();
  });
});
