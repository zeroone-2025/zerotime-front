'use client';

import { Suspense, useState, useLayoutEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { ToastProvider } from '@/_context/ToastContext';
import { NotificationBadgeProvider } from '@/_context/NotificationBadgeContext';
import DesktopSidebar from '@/_components/layout/DesktopSidebar';
import MobileSidebar from '@/_components/layout/MobileSidebar';
import SharedHeader from '@/_components/layout/SharedHeader';

const MAIN_PAGES = new Set(['/', '/profile', '/chinba', '/flow']);
const CHINBA_HEADER_PATHS = new Set(['/chinba', '/chinba/team', '/chinba/my', '/chinba/guide']);
const FLOW_HEADER_PATHS = new Set(['/flow', '/flow/career', '/flow/companies', '/flow/profile']);

/**
 * SharedHeader를 path와 query string에 따라 분기 노출.
 * /flow/companies는 ?id 가 있을 때(=상세 모드) 자체 헤더를 사용하므로 SharedHeader 숨김.
 * Suspense 분리: useSearchParams 가 client-only 라 정적 export 시 hydration 일관성 확보.
 */
function MaybeSharedHeader({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const normalizedPath = pathname === '/' ? '/' : pathname.replace(/\/$/, '');
  const hasIdQuery = Boolean(searchParams.get('id'));
  const isCompanyDetail = normalizedPath === '/flow/companies' && hasIdQuery;

  const showHeader =
    !isCompanyDetail &&
    (MAIN_PAGES.has(normalizedPath) ||
      CHINBA_HEADER_PATHS.has(normalizedPath) ||
      FLOW_HEADER_PATHS.has(normalizedPath));

  if (!showHeader) return null;
  return (
    <div className="shrink-0" style={{ touchAction: 'none' }}>
      <SharedHeader title="logo" onMenuClick={onMenuClick} />
    </div>
  );
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // SSR과 클라이언트 초기값을 false(펼침)로 일치시켜 hydration mismatch 방지.
  // useLayoutEffect로 페인트 전에 localStorage 값을 반영하여 깜빡임 없이 보정.
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);

  useLayoutEffect(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    if (saved !== null) {
      setDesktopCollapsed(saved === 'true');
    } else if (window.innerWidth < 1200) {
      setDesktopCollapsed(true);
    }
  }, []);

  const handleDesktopToggle = () => {
    setDesktopCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      if (next) {
        document.documentElement.classList.add('sidebar-collapsed');
      } else {
        document.documentElement.classList.remove('sidebar-collapsed');
      }
      return next;
    });
  };

  // SharedHeader 노출 여부는 MaybeSharedHeader가 useSearchParams로 분기 (?id 상세는 자체 헤더)
  void pathname;

  const collapsed = desktopCollapsed;
  // sidebar(60 or 260) + content — iPad Pro 12.9" 가로(1366px)까지 꽉 채움
  const desktopMaxWidth = 1366;

  return (
    <ToastProvider>
      <NotificationBadgeProvider>
        <div className="h-full w-full overflow-hidden bg-gray-50">
        {/* Desktop max-width varies with sidebar state */}
        <style>{`@media(min-width:52rem){[data-sidebar-layout]{max-width:${desktopMaxWidth}px!important}}`}</style>

        {/* 사이드바 + 콘텐츠를 하나의 박스로 묶어 가운데 정렬 */}
        <div
          data-sidebar-layout
          className="mx-auto flex h-full w-full md:shadow-xl transition-[max-width] duration-300"
        >
          {/* Desktop: persistent sidebar */}
          <DesktopSidebar collapsed={collapsed} onToggle={handleDesktopToggle} />

          {/* Main content */}
          <div className="relative flex h-full w-full min-w-0 flex-1 flex-col border-x border-gray-100 bg-white shadow-xl md:border-l-0 md:shadow-none overflow-hidden">
            <Suspense fallback={null}>
              <MaybeSharedHeader onMenuClick={() => setMobileSidebarOpen(true)} />
            </Suspense>
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              {children}
            </div>

            {/* Mobile: overlay sidebar (inside main content for absolute positioning) */}
            <MobileSidebar
              isOpen={mobileSidebarOpen}
              onClose={() => setMobileSidebarOpen(false)}
            />
          </div>
        </div>
        </div>
      </NotificationBadgeProvider>
    </ToastProvider>
  );
}
