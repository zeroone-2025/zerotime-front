/**
 * 네이티브 로컬 개발 모드 — mobile-release 계약 밖의 개발 전용 경로.
 *
 * 릴리스 계약(mobileRelease.ts)은 네이티브 런타임에 beta/prod 매니페스트를 강제한다.
 * 이 모듈은 그 계약을 완화하지 않는다: 로컬 개발 빌드는 네이티브 릴리스 런타임으로
 * 승격되는 것이 아니라 웹 동작(쿠키 인증, 알림 코디네이터 없음)으로 강등되고, API는
 * localhost·사설 LAN의 http origin만 허용된다. 실서버(dev/beta/prod API)로 붙는
 * 네이티브 빌드는 여전히 검증된 릴리스 매니페스트 없이는 존재할 수 없다.
 */

export const NATIVE_LOCAL_DEV_BUILD_ENV = {
  flag: 'NEXT_PUBLIC_NATIVE_LOCAL_DEV',
  apiOrigin: 'NEXT_PUBLIC_API_BASE_URL_WEB',
  releaseArtifact: 'NEXT_PUBLIC_MOBILE_RELEASE_ARTIFACT',
  releasePlane: 'NEXT_PUBLIC_MOBILE_RELEASE_PLANE',
} as const;

export type NativeLocalDevBuildEnvironment = Readonly<Record<string, string | undefined>>;

function isLocalDevelopmentHost(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, '');
  if (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized === '127.0.0.1' ||
    normalized === '::1'
  ) {
    return true;
  }

  const octets = normalized.split('.');
  if (octets.length !== 4 || octets.some((octet) => !/^\d{1,3}$/.test(octet))) {
    return false;
  }

  const [first, second, third, fourth] = octets.map(Number);
  if ([first, second, third, fourth].some((octet) => octet > 255)) {
    return false;
  }
  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

/**
 * 로컬 개발 모드가 켜져 있으면 검증된 로컬 API origin을, 꺼져 있으면 null을 반환한다.
 * 릴리스 매니페스트 env와의 동시 지정, 로컬이 아닌 origin은 전부 즉시 throw — fail closed.
 */
export function nativeLocalDevApiOriginFromEnvironment(
  environment: NativeLocalDevBuildEnvironment,
): string | null {
  if (environment[NATIVE_LOCAL_DEV_BUILD_ENV.flag] !== 'true') {
    return null;
  }

  if (
    environment[NATIVE_LOCAL_DEV_BUILD_ENV.releaseArtifact] !== undefined ||
    environment[NATIVE_LOCAL_DEV_BUILD_ENV.releasePlane] !== undefined
  ) {
    throw new Error(
      `${NATIVE_LOCAL_DEV_BUILD_ENV.flag} must never be combined with a mobile release manifest.`,
    );
  }

  const rawOrigin = environment[NATIVE_LOCAL_DEV_BUILD_ENV.apiOrigin];
  if (typeof rawOrigin !== 'string' || rawOrigin.length === 0) {
    throw new Error(
      `${NATIVE_LOCAL_DEV_BUILD_ENV.apiOrigin} is required for native local development.`,
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(rawOrigin);
  } catch {
    throw new Error(
      `${NATIVE_LOCAL_DEV_BUILD_ENV.apiOrigin} must be a valid local development origin.`,
    );
  }

  if (
    parsed.protocol !== 'http:' ||
    parsed.username !== '' ||
    parsed.password !== '' ||
    (parsed.pathname !== '/' && parsed.pathname !== '') ||
    parsed.search !== '' ||
    parsed.hash !== '' ||
    !isLocalDevelopmentHost(parsed.hostname)
  ) {
    throw new Error(
      `${NATIVE_LOCAL_DEV_BUILD_ENV.apiOrigin} must be an http origin on localhost or a private LAN.`,
    );
  }

  return parsed.origin;
}

export function nativeLocalDevApiOrigin(): string | null {
  return nativeLocalDevApiOriginFromEnvironment({
    [NATIVE_LOCAL_DEV_BUILD_ENV.flag]: process.env.NEXT_PUBLIC_NATIVE_LOCAL_DEV,
    [NATIVE_LOCAL_DEV_BUILD_ENV.apiOrigin]: process.env.NEXT_PUBLIC_API_BASE_URL_WEB,
    [NATIVE_LOCAL_DEV_BUILD_ENV.releaseArtifact]: process.env.NEXT_PUBLIC_MOBILE_RELEASE_ARTIFACT,
    [NATIVE_LOCAL_DEV_BUILD_ENV.releasePlane]: process.env.NEXT_PUBLIC_MOBILE_RELEASE_PLANE,
  });
}
