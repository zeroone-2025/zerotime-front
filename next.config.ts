import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: false, // API 응답 캐싱 문제 방지
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development" || process.env.CAPACITOR_BUILD === "true",

  // register: true, // 수동 등록(ServiceWorkerRegistration.tsx)을 사용하므로 자동 등록 비활성화
  workboxOptions: {
    disableDevLogs: true,
    cleanupOutdatedCaches: true,
    clientsClaim: true,
    skipWaiting: true,
    runtimeCaching: [
      {
        // API 응답은 항상 네트워크 우선 (캐시는 fallback으로만 사용)
        urlPattern: /^https?:\/\/.*\/api\/.*/i,
        handler: "NetworkFirst",
        options: {
          cacheName: "api-cache",
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 5 * 60, // 5분
          },
          networkTimeoutSeconds: 10,
        },
      },
      {
        // Next.js 정적 번들은 최신을 우선시 (업데이트 시 hydration mismatch 방지)
        urlPattern: /^https?:\/\/.*\/_next\/static\/.*\.(?:js|css|woff2?)$/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "next-static",
          expiration: {
            maxEntries: 200,
            maxAgeSeconds: 24 * 60 * 60, // 1일
          },
        },
      },
      {
        // 이미지/기타 정적 리소스는 캐시 우선
        urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "static-resources",
          expiration: {
            maxEntries: 200,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30일
          },
        },
      },
      {
        // 페이지는 네트워크 우선 (빠른 네비게이션을 위해)
        urlPattern: /^https?:\/\/.*/i,
        handler: "NetworkFirst",
        options: {
          cacheName: "pages-cache",
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 24 * 60 * 60, // 1일
          },
        },
      },
    ],
  },
});

const nextConfig: NextConfig = {
  /* config options here */
  output: 'export', // Capacitor용 정적 빌드
  outputFileTracingRoot: __dirname, // 프로젝트 루트 명시 (다중 lockfile 경고 방지)
  trailingSlash: true,
  images: {
    unoptimized: true, // Static export에서는 이미지 최적화 비활성화
  },
  env: {
    // .env 파일에서 읽어온 값을 빌드 타임에 고정
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  },
};

// 개발 모드에서는 withPWA로 감싸지 않는다 — PWA는 dev에서 어차피 disable이지만,
// 래퍼가 config에 webpack 키를 남겨 Turbopack dev가 "webpack 설정 감지" 경고를 낸다.
// 프로덕션 빌드(next build --webpack)에서만 PWA 플러그인이 실제로 동작한다.
export default process.env.NODE_ENV === "development"
  ? nextConfig
  : withPWA(nextConfig);
