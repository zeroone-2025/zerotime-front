import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';

import './globals.css';
import DevHostMetaTag from './_components/system/DevHostMetaTag';
import ServiceWorkerRegistration from './_components/system/ServiceWorkerRegistration';
import NavigationTracker from './_lib/navigation/NavigationTracker';
import Providers from './providers';

const inter = Inter({ subsets: ['latin'] });

// GA4 측정 ID — 빌드 시점 주입. 미설정 환경(로컬·dev·beta)에서는 GA를 로드하지 않는다
const gaId = process.env.NEXT_PUBLIC_GA_ID;

export const metadata: Metadata = {
  title: '제로타임 - 전북대 공지사항 통합 알리미',
  description: '전북대학교(JBNU)의 모든 공지사항을 한눈에. 학사, 장학, 취업 정보를 놓치지 않고 제로타임(ZeroTime)에서 확인하세요.',
  keywords: ['제로타임', 'ZeroTime', '전북대', '전북대학교', 'JBNU', '공지사항', '알림', '알리미', '대학생활', '전주', '취업', '장학금'],
  openGraph: {
    title: '제로타임 - 전북대 공지사항 통합 알림',
    description: '놓치기 쉬운 학교 공지, 제로타임으로 완벽하게 확인하세요.',
    siteName: '제로타임 (ZeroTime)',
    locale: 'ko_KR',
    type: 'website',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '제로타임',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#3b82f6',
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.getItem('sidebar_collapsed') === 'true') {
                  document.documentElement.classList.add('sidebar-collapsed');
                }
              } catch (e) {}
            `,
          }}
        />
        <DevHostMetaTag />
        {gaId && (
          <>
            <Script async src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} />
            <Script id="ga-init">
              {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${gaId}');`}
            </Script>
          </>
        )}
      </head>
      <body className={`${inter.className} flex h-dvh flex-col bg-gray-50 text-gray-900`}>
        <ServiceWorkerRegistration />
        <Providers>
          <NavigationTracker />
          <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
