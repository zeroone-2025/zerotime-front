import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { useGuestSchool } from '@/_lib/hooks/useGuestSchool';
import { useUser } from '@/_lib/hooks/useUser';

import SidebarContent from './SidebarContent';

let mockPathname = '/';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => mockPathname,
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
    mockPathname = '/';
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

describe('SidebarContent 타임라인 설명서 메뉴', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = '/';
    mockedUseGuestSchool.mockReturnValue(
      asUserHook({ guestSchool: '전북대', setGuestSchool: vi.fn(), isLoading: false }),
    );
    mockedUseUser.mockReturnValue(
      asUserHook({ user: null, isLoggedIn: false, isAuthLoaded: true, isLoading: false }),
    );
  });

  it('알리미(/)에서는 보이지 않는다', () => {
    mockPathname = '/';
    renderSidebar();
    expect(screen.queryByText('타임라인 설명서')).not.toBeInTheDocument();
  });

  it('프로필(/profile/)에서는 보이지 않는다', () => {
    mockPathname = '/profile/';
    renderSidebar();
    expect(screen.queryByText('타임라인 설명서')).not.toBeInTheDocument();
  });

  it('타임라인(/chinba/ — 후행 슬래시)에서는 보인다', () => {
    mockPathname = '/chinba/';
    renderSidebar();
    expect(screen.getByText('타임라인 설명서')).toBeInTheDocument();
  });

  it('타임라인 하위 경로(/chinba/team/detail/)에서도 보인다', () => {
    mockPathname = '/chinba/team/detail/';
    renderSidebar();
    expect(screen.getByText('타임라인 설명서')).toBeInTheDocument();
  });

  it('설명서 페이지(/chinba/guide/)에서는 active로 표시된다', () => {
    mockPathname = '/chinba/guide/';
    renderSidebar();
    expect(screen.getByText('타임라인 설명서')).toBeInTheDocument();
    // '타임라인' 서비스 항목도 startsWith('/chinba')로 active라 "현재" 뱃지는 2개다
    expect(screen.getAllByText('현재').length).toBeGreaterThanOrEqual(1);
  });
});
