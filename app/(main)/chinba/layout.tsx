'use client';

import { usePathname } from 'next/navigation';

import BottomTabBar from './_components/BottomTabBar';

const BOTTOM_TAB_PATHS = new Set([
  '/chinba',
  '/chinba/team',
  '/chinba/team/detail',
  '/chinba/my',
]);

export default function ChinbaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const normalized = pathname.replace(/\/$/, '') || '/';
  const showBottomTab = BOTTOM_TAB_PATHS.has(normalized);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
      {showBottomTab && <BottomTabBar />}
    </div>
  );
}
