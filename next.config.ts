import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";
import {
  createMobileReleaseBuildManifest,
  MOBILE_RELEASE_ARTIFACT,
  MOBILE_RELEASE_BUILD_ENV,
} from "./app/_lib/native/mobileRelease";
import {
  NATIVE_LOCAL_DEV_BUILD_ENV,
  nativeLocalDevApiOriginFromEnvironment,
} from "./app/_lib/native/nativeLocalDev";

const isCapacitorBuild = process.env.CAPACITOR_BUILD === "true";
const playwrightPort = process.env.PLAYWRIGHT_PORT;
if (playwrightPort && !/^[0-9]{2,5}$/.test(playwrightPort)) {
  throw new Error('PLAYWRIGHT_PORT must be a decimal TCP port.');
}
const playwrightDistDir = playwrightPort ? `.next/playwright-${playwrightPort}` : undefined;
// 로컬 개발 빌드(nativeLocalDev.ts)는 릴리스 매니페스트 없이 로컬 http origin으로만
// 빌드된다 — origin이 로컬이 아니거나 매니페스트 env와 겹치면 여기서 빌드가 실패한다.
const nativeLocalDevOrigin = isCapacitorBuild
  ? nativeLocalDevApiOriginFromEnvironment({
      [NATIVE_LOCAL_DEV_BUILD_ENV.flag]: process.env.NEXT_PUBLIC_NATIVE_LOCAL_DEV,
      [NATIVE_LOCAL_DEV_BUILD_ENV.apiOrigin]: process.env.NEXT_PUBLIC_API_BASE_URL_WEB,
      [NATIVE_LOCAL_DEV_BUILD_ENV.releaseArtifact]: process.env.NEXT_PUBLIC_MOBILE_RELEASE_ARTIFACT,
      [NATIVE_LOCAL_DEV_BUILD_ENV.releasePlane]: process.env.NEXT_PUBLIC_MOBILE_RELEASE_PLANE,
    })
  : null;
const mobileReleaseManifest = isCapacitorBuild && nativeLocalDevOrigin === null
  ? createMobileReleaseBuildManifest({
      plane: process.env.NEXT_PUBLIC_MOBILE_RELEASE_PLANE,
      frontendGitSha: process.env.NEXT_PUBLIC_MOBILE_RELEASE_FRONTEND_GIT_SHA,
      backendGitSha: process.env.NEXT_PUBLIC_MOBILE_RELEASE_BACKEND_GIT_SHA,
      backendImageDigest: process.env.NEXT_PUBLIC_MOBILE_RELEASE_BACKEND_IMAGE_DIGEST,
      backendDeploymentId: process.env.NEXT_PUBLIC_MOBILE_RELEASE_BACKEND_DEPLOYMENT_ID,
      backendDeployedAtUtc: process.env.NEXT_PUBLIC_MOBILE_RELEASE_BACKEND_DEPLOYED_AT_UTC,
      contractVersion: process.env.NEXT_PUBLIC_MOBILE_RELEASE_CONTRACT_VERSION,
      contractSha256: process.env.NEXT_PUBLIC_MOBILE_RELEASE_CONTRACT_SHA256,
      firebaseProjectId: process.env.NEXT_PUBLIC_MOBILE_RELEASE_FIREBASE_PROJECT_ID,
      apiOrigin: process.env.NEXT_PUBLIC_API_BASE_URL_NATIVE,
      platform: process.env.NEXT_PUBLIC_MOBILE_RELEASE_PLATFORM,
      appVersion: process.env.NEXT_PUBLIC_MOBILE_RELEASE_APP_VERSION,
      buildNumber: process.env.NEXT_PUBLIC_MOBILE_RELEASE_BUILD_NUMBER,
      bundleId: process.env.NEXT_PUBLIC_MOBILE_RELEASE_BUNDLE_ID,
    })
  : null;

const mobileReleaseEnv = mobileReleaseManifest
  ? {
      [MOBILE_RELEASE_BUILD_ENV.artifact]: MOBILE_RELEASE_ARTIFACT,
      [MOBILE_RELEASE_BUILD_ENV.plane]: mobileReleaseManifest.plane,
      [MOBILE_RELEASE_BUILD_ENV.frontendGitSha]: mobileReleaseManifest.frontend_git_sha,
      [MOBILE_RELEASE_BUILD_ENV.backendGitSha]: mobileReleaseManifest.backend_git_sha,
      [MOBILE_RELEASE_BUILD_ENV.backendImageDigest]: mobileReleaseManifest.backend_image_digest,
      [MOBILE_RELEASE_BUILD_ENV.backendDeploymentId]: mobileReleaseManifest.backend_deployment_id,
      [MOBILE_RELEASE_BUILD_ENV.backendDeployedAtUtc]: mobileReleaseManifest.backend_deployed_at_utc,
      [MOBILE_RELEASE_BUILD_ENV.contractVersion]: mobileReleaseManifest.contract,
      [MOBILE_RELEASE_BUILD_ENV.contractSha256]: mobileReleaseManifest.contract_sha256,
      [MOBILE_RELEASE_BUILD_ENV.firebaseProjectId]: mobileReleaseManifest.firebase_project_id,
      [MOBILE_RELEASE_BUILD_ENV.apiOrigin]: mobileReleaseManifest.api_origin,
      [MOBILE_RELEASE_BUILD_ENV.platform]: mobileReleaseManifest.platform,
      [MOBILE_RELEASE_BUILD_ENV.appVersion]: mobileReleaseManifest.app_version,
      [MOBILE_RELEASE_BUILD_ENV.buildNumber]: mobileReleaseManifest.build_number,
      [MOBILE_RELEASE_BUILD_ENV.bundleId]: mobileReleaseManifest.bundle_id,
    }
  : {
      [MOBILE_RELEASE_BUILD_ENV.artifact]: "",
      ...(nativeLocalDevOrigin !== null
        ? {
            [NATIVE_LOCAL_DEV_BUILD_ENV.flag]: "true",
            [NATIVE_LOCAL_DEV_BUILD_ENV.apiOrigin]: nativeLocalDevOrigin,
          }
        : {}),
    };

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: false, // API 응답 캐싱 문제 방지
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development" || isCapacitorBuild,

  // register: true, // 수동 등록(ServiceWorkerRegistration.tsx)을 사용하므로 자동 등록 비활성화
  workboxOptions: {
    disableDevLogs: true,
    cleanupOutdatedCaches: true,
    clientsClaim: true,
    skipWaiting: true,
    runtimeCaching: [
      {
        // 인증·개인정보 API 응답은 서비스 워커에 저장하지 않는다.
        urlPattern: ({ url }: { url: URL }) =>
          /^(?:dev-api|beta-api|api)\.zerotime\.kr$/.test(url.hostname),
        handler: "NetworkOnly",
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
        // 문서 탐색만 캐시한다. API/XHR/fetch 응답은 이 규칙에 들어오지 않는다.
        urlPattern: ({
          request,
          sameOrigin,
        }: {
          request: Request;
          sameOrigin: boolean;
        }) => sameOrigin && request.mode === "navigate",
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
  distDir: playwrightDistDir,
  output: 'export', // Capacitor용 정적 빌드
  outputFileTracingRoot: __dirname, // 프로젝트 루트 명시 (다중 lockfile 경고 방지)
  trailingSlash: true,
  images: {
    unoptimized: true, // Static export에서는 이미지 최적화 비활성화
  },
  env: {
    // .env 파일에서 읽어온 값을 빌드 타임에 고정
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    ...mobileReleaseEnv,
  },
};

// 개발 모드에서는 withPWA로 감싸지 않는다 — PWA는 dev에서 어차피 disable이지만,
// 래퍼가 config에 webpack 키를 남겨 Turbopack dev가 "webpack 설정 감지" 경고를 낸다.
// 프로덕션 빌드(next build --webpack)에서만 PWA 플러그인이 실제로 동작한다.
export default process.env.NODE_ENV === "development"
  ? nextConfig
  : withPWA(nextConfig);
