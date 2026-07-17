'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useToast } from '@/_context/ToastContext';
import SidebarContent from './SidebarContent';
import { useRouter } from 'next/navigation';
import { FiUser, FiBell, FiUsers, FiSettings, FiChevronsRight, FiZap } from 'react-icons/fi';
import { SCHOOL_FULL_NAME } from '@/_lib/constants/boards';
import { useGuestSchool } from '@/_lib/hooks/useGuestSchool';
import { useUser } from '@/_lib/hooks/useUser';

interface DesktopSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

interface CollapsedNavItem {
  id: string;
  icon: typeof FiBell;
  href: string;
  label: string;
  matchPath: string;
}

const NAV_ITEMS: CollapsedNavItem[] = [
  // jbnu-alarm 라벨(툴팁)은 렌더 시점에 `<학교 전체명> 알리미`로 치환한다(아래 alarmLabel 참고).
  { id: 'jbnu-alarm', icon: FiBell, href: '/', label: '알리미', matchPath: '/' },
  { id: 'chinba', icon: FiUsers, href: '/chinba', label: '친해지길 바래', matchPath: '/chinba' },
  { id: 'flow', icon: FiZap, href: '/flow', label: 'FLOW', matchPath: '/flow' },
];

export default function DesktopSidebar({ collapsed, onToggle }: DesktopSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { showToast } = useToast();
  const { user, isLoggedIn } = useUser();
  const { guestSchool } = useGuestSchool();
  const activeSchool = user?.school || guestSchool;
  const alarmLabel = `${SCHOOL_FULL_NAME[activeSchool] ?? activeSchool} 알리미`;

  const [transitionEnabled, setTransitionEnabled] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setTransitionEnabled(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const isActive = (matchPath: string) => {
    if (matchPath === '/') return pathname === '/';
    return pathname.startsWith(matchPath);
  };

  return (
    <aside
      className={`hidden md:flex md:shrink-0 h-full border-r border-gray-100 bg-white overflow-hidden relative${
        transitionEnabled ? ' transition-[width] duration-300 ease-in-out' : ''
      } ${collapsed ? 'md:w-[60px]' : 'md:w-[260px]'}`}
    >
      <div
        className={`absolute inset-y-0 left-0 w-[60px] flex flex-col items-center py-4 gap-1 bg-white z-10${
          transitionEnabled ? ' transition-opacity duration-200' : ''
        } ${collapsed ? 'opacity-100 delay-100' : 'opacity-0 pointer-events-none'}`}
        {...(!collapsed ? { inert: true } : {})}
      >
        {/* Expand toggle */}
        <button
          onClick={onToggle}
          className="flex items-center justify-center w-10 h-10 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors mb-4"
          title="사이드바 펼치기"
        >
          <FiChevronsRight size={20} />
        </button>

        {/* Profile icon */}
        {isLoggedIn && (
          <button
            onClick={() => router.push('/profile')}
            className={`flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
              isActive('/profile')
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
            }`}
            title="프로필"
          >
            <FiUser size={20} />
          </button>
        )}

        {/* Nav icons */}
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => router.push(item.href)}
              className={`flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
                isActive(item.matchPath)
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
              }`}
              title={item.id === 'jbnu-alarm' ? alarmLabel : item.label}
            >
              <Icon size={20} />
            </button>
          );
        })}

        {/* Admin icon */}
        {isAdmin && (
          <button
            onClick={() => {
              const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL || 'http://dev-office.zerotime.kr';
              window.location.href = `${adminUrl}/dashboard`;
            }}
            className="flex items-center justify-center w-10 h-10 rounded-lg text-purple-500 hover:bg-purple-50 transition-colors"
            title="관리자 페이지"
          >
            <FiSettings size={20} />
          </button>
        )}
      </div>

      <div
        className={`w-[260px] shrink-0 h-full overflow-y-auto overflow-x-hidden${
          transitionEnabled ? ' transition-opacity duration-200' : ''
        } ${collapsed ? 'opacity-0 pointer-events-none' : 'opacity-100 delay-100'}`}
        {...(collapsed ? { inert: true } : {})}
      >
        <SidebarContent
          onNavigate={(path) => router.push(path)}
          onShowToast={showToast}
          onCollapse={onToggle}
        />
      </div>
    </aside>
  );
}
