// Tailwind 커스텀 md 브레이크포인트(globals.css @theme --breakpoint-md: 52rem)와 같은 기준.
// 데스크톱 레이아웃(사이드바 셸)이 적용되는 뷰포트인지 판별한다.
export const isDesktopViewport = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(min-width: 52rem)').matches;

export const DESKTOP_MEDIA_QUERY = '(min-width: 52rem)';
