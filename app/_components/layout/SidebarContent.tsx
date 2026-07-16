'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  FiUser,
  FiSettings,
  FiBell,
  FiUsers,
  FiZap,
  FiLogOut,
  FiHome,
  FiInstagram,
  FiMail,
  FiExternalLink,
  FiChevronsLeft,
} from 'react-icons/fi';
import { SiNaver } from 'react-icons/si';

import { IconType } from 'react-icons';
import { useUser } from '@/_lib/hooks/useUser';
import { getAllDepartments, logoutUser } from '@/_lib/api';
import { useUserStore } from '@/_lib/store/useUserStore';
import { useMyChinbaEvents } from '@/_lib/hooks/useChinba';
import { getLoginUrl } from '@/_lib/utils/requireLogin';
import { ChinbaEventList } from '@/(main)/chinba/_components/ChinbaEventList';
import LoadingSpinner from '@/_components/ui/LoadingSpinner';
import Logo from '@/_components/ui/Logo';
import { getQueryClient } from '@/providers';

interface SidebarContentProps {
  onNavigate: (path: string) => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onCollapse?: () => void;
}

interface ServiceItem {
  id: string;
  label: string;
  icon: IconType;
  href?: string;
  isDisabled?: boolean;
  matchPath?: string;
}

const SERVICE_ITEMS: ServiceItem[] = [
  { id: 'profile', label: '프로필', icon: FiUser, href: '/profile', matchPath: '/profile' },
  { id: 'jbnu-alarm', label: '전북대 알리미', icon: FiBell, matchPath: '/' },
  { id: 'chinba', label: '친해지길 바래', icon: FiUsers, matchPath: '/chinba' },
  { id: 'flow', label: 'FLOW', icon: FiZap, href: '/flow', matchPath: '/flow' },
];

function formatAdmissionYear(year: number | null | undefined): string | null {
  if (!year) return null;
  return `${String(year).slice(-2)}학번`;
}

export default function SidebarContent({
  onNavigate,
  onShowToast,
  onCollapse,
}: SidebarContentProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoggedIn, isAuthLoaded, isLoading } = useUser();
  const clearUser = useUserStore((state) => state.clearUser);
  const [chinbaExpanded, setChinbaExpanded] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const {
    data: chinbaEvents,
    isLoading: isLoadingChinbaEvents,
    refetch,
  } = useMyChinbaEvents(isLoggedIn);

  useEffect(() => {
    localStorage.setItem('sidebar_chinba_expanded', String(chinbaExpanded));
  }, [chinbaExpanded]);

  const handleAdminClick = () => {
    const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL || 'http://dev-office.zerotime.kr';
    window.location.href = `${adminUrl}/dashboard`;
  };
  const handleLogout = async () => {
    if (!confirm('로그아웃 하시겠습니까?')) return;

    setIsLoggingOut(true);
    try {
      // logoutUser waits for the native privacy barrier and server acknowledgement
      // before credentials or user-visible local state are purged.
      await logoutUser();
      localStorage.removeItem('my_subscribed_categories');
      getQueryClient()?.clear();
      clearUser();
      window.location.assign('/?logout=success');
    } catch (error) {
      console.error('Logout failed:', error);
      onShowToast('로그아웃이 완료되지 않았습니다.', 'error');
      setIsLoggingOut(false);
    }
  };


  const isItemActive = (item: ServiceItem) => {
    if (!item.matchPath) return false;
    if (item.matchPath === '/') return pathname === '/';
    return pathname.startsWith(item.matchPath);
  };

  const handleServiceClick = (item: ServiceItem) => {
    if (item.isDisabled) {
      onShowToast('준비 중입니다', 'info');
      return;
    }

    if (item.id === 'chinba') {
      onNavigate('/chinba');
      return;
    }

    if (item.id === 'jbnu-alarm') {
      onNavigate('/');
      return;
    }

    if (item.href) {
      onNavigate(item.href);
      return;
    }

    if (item.matchPath && isItemActive(item)) {
      // Already on page, do nothing (caller closes sidebar)
      return;
    }
  };

  const handleChinbaToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLoggedIn) {
      onShowToast('로그인이 필요합니다', 'info');
      return;
    }
    setChinbaExpanded((prev) => !prev);
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const admissionYearText = formatAdmissionYear(user?.admission_year);

  const [deptName, setDeptName] = useState<string | null>(null);
  useEffect(() => {
    if (!user?.dept_code) {
      setDeptName(null);
      return;
    }
    getAllDepartments(true, user.school)
      .then((depts) => {
        const found = depts.find((d) => d.dept_code === user.dept_code);
        setDeptName(found?.dept_name || null);
      })
      .catch(() => setDeptName(null));
  }, [user?.dept_code]);

  return (
    <div className="flex h-full w-full flex-col">
      {/* Brand + user summary */}
      <div className="pt-safe px-5 pb-4 md:pt-0">
        <div className="flex items-center justify-between pt-7">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            aria-label="제로타임 홈"
            className="text-gray-900 transition-colors hover:text-blue-600"
          >
            <Logo className="h-6 w-auto" />
          </button>
          {onCollapse && (
          <button
            onClick={onCollapse}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            title="사이드바 접기"
          >
            <FiChevronsLeft size={18} />
          </button>
          )}
        </div>

        <div className="pt-6">
          {!isAuthLoaded || (isLoading && !user) ? (
            <div className="animate-pulse space-y-2">
              <div className="h-4 w-24 rounded bg-gray-200" />
              <div className="h-3 w-20 rounded bg-gray-200" />
              <div className="h-3 w-36 rounded bg-gray-200" />
            </div>
          ) : !isLoggedIn ? (
            <div className="flex flex-col items-start gap-3">
              <p className="px-1 text-sm font-medium text-gray-700">
                로그인하여 설정을 저장하고
                <br />더 많은 기능을 이용해보세요.
              </p>
              <button
                onClick={() => router.push(getLoginUrl())}
                className="w-full rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800 active:bg-gray-700"
              >
                로그인하기
              </button>
            </div>
          ) : (
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-gray-900">
                {user?.nickname || '사용자'}
              </p>
              <p className="mt-0.5 truncate text-xs font-medium text-gray-500">
                {user?.username ? `@${user.username}` : user?.email}
              </p>
              {(user?.school || deptName || admissionYearText) && (
                <p className="mt-1 truncate text-[11px] text-gray-400">
                  {[user?.school, deptName, admissionYearText].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Service List */}
      <div className="px-3 pt-4">
        {SERVICE_ITEMS.map((item) => {
          if (!isLoggedIn && item.id === 'profile') {
            return null;
          }

          const Icon = item.icon;
          return (
            <div key={item.id}>
              <button
                onClick={() => handleServiceClick(item)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                  isItemActive(item)
                    ? 'bg-blue-50 text-blue-700'
                    : item.isDisabled
                      ? 'text-gray-400'
                      : 'text-gray-700 hover:bg-gray-50 active:bg-gray-100'
                }`}
              >
                <Icon size={18} />
                <span className="text-sm font-medium">{item.label}</span>
                {isItemActive(item) && (
                  <span className="ml-auto rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-500">
                    현재
                  </span>
                )}
              </button>

              {item.id === 'chinba' && chinbaExpanded && (
                <div className="mt-2 mr-1 mb-3 ml-6 max-h-[300px] space-y-2 overflow-y-auto rounded-lg">
                  <ChinbaEventList
                    events={chinbaEvents}
                    isLoading={isLoadingChinbaEvents}
                    onEventClick={(eventId) => {
                      onNavigate(`/chinba/event?id=${eventId}`);
                    }}
                    onDeleteSuccess={refetch}
                    onShowToast={onShowToast}
                    compact
                    emptyMessage="참여한 방이 없습니다"
                  />
                </div>
              )}
            </div>
          );
        })}
        {isAdmin && (
          <button
            onClick={handleAdminClick}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-purple-600 transition-colors hover:bg-purple-50 active:bg-purple-100"
          >
            <FiSettings size={18} />
            <span className="text-sm font-medium">관리자 페이지</span>
          </button>
        )}

        {/* 제로타임 앱 사용하기 - 외부 링크 */}
        <div className="mt-3">
          <a
            href="https://blog.naver.com/zerotime_official/224159496874"
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-gray-500 transition-colors hover:bg-gray-50 active:bg-gray-100"
          >
            <SiNaver size={16} />
            <span className="text-sm font-medium">제로타임 앱 사용하기</span>
            <FiExternalLink size={13} className="ml-auto text-gray-300" />
          </a>
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Logout */}
      {isLoggedIn && (
        <div className="px-5 pb-3">
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex items-center gap-2 text-sm font-medium text-gray-400 transition-colors hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiLogOut size={16} />
            {isLoggingOut ? '로그아웃 중...' : '로그아웃'}
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-gray-100 bg-gray-50/30 p-5">
        <div className="flex flex-col gap-4 text-center">
          <p className="text-[11px] leading-relaxed break-keep text-gray-400">
            이 프로젝트는 전북대학교
            <br />
            컴퓨터인공지능학부, 경영학과 학생들이 협력하여
            <br />
            운영 중인 서비스입니다.
          </p>

          <div className="space-y-0.5">
            <p className="text-[10px] font-semibold tracking-wide text-gray-400">
              Powered by <span className="text-[#034286]">JEduTools</span>
            </p>
          </div>
          <nav
            aria-label="정책 및 계정 관리"
            className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] font-medium text-gray-500"
          >
            <a href="/privacy/" className="hover:text-gray-700 hover:underline">
              개인정보처리방침
            </a>
            <a href="/terms/" className="hover:text-gray-700 hover:underline">
              이용약관
            </a>
            <a href="/account-deletion/" className="hover:text-gray-700 hover:underline">
              계정 삭제
            </a>
          </nav>
          {/* Social Links */}
          <div className="flex items-center justify-center gap-4">
            <a
              href="https://home.zerotime.kr"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700"
              aria-label="Landing Page"
            >
              <FiHome size={18} />
            </a>
            <a
              href="https://www.instagram.com/zerotime_official/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700"
              aria-label="Instagram"
            >
              <FiInstagram size={18} />
            </a>
            <a
              href="https://blog.naver.com/zerotime_official/224159496874"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700"
              aria-label="Blog"
            >
              <SiNaver size={16} />
            </a>
            <a
              href="mailto:zeroone012025@gmail.com"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700"
              aria-label="Email"
            >
              <FiMail size={18} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
