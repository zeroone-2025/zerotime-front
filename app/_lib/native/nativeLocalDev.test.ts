import { describe, expect, it } from 'vitest';

import {
  NATIVE_LOCAL_DEV_BUILD_ENV,
  nativeLocalDevApiOriginFromEnvironment,
  type NativeLocalDevBuildEnvironment,
} from './nativeLocalDev';

function localDevEnvironment(
  overrides: NativeLocalDevBuildEnvironment = {},
): NativeLocalDevBuildEnvironment {
  return {
    [NATIVE_LOCAL_DEV_BUILD_ENV.flag]: 'true',
    [NATIVE_LOCAL_DEV_BUILD_ENV.apiOrigin]: 'http://localhost:8080',
    ...overrides,
  };
}

describe('native local development origin', () => {
  it('is disabled without the explicit flag', () => {
    expect(nativeLocalDevApiOriginFromEnvironment({})).toBeNull();
    expect(
      nativeLocalDevApiOriginFromEnvironment({
        [NATIVE_LOCAL_DEV_BUILD_ENV.flag]: 'TRUE',
        [NATIVE_LOCAL_DEV_BUILD_ENV.apiOrigin]: 'http://localhost:8080',
      }),
    ).toBeNull();
  });

  it('returns the validated localhost origin', () => {
    expect(nativeLocalDevApiOriginFromEnvironment(localDevEnvironment())).toBe(
      'http://localhost:8080',
    );
  });

  it.each([
    'http://127.0.0.1:8080',
    'http://10.0.0.5:8080',
    'http://172.16.0.9:8080',
    'http://172.31.255.1:8080',
    'http://192.168.0.10:8080',
  ])('accepts the private LAN origin %s', (origin) => {
    expect(
      nativeLocalDevApiOriginFromEnvironment(
        localDevEnvironment({ [NATIVE_LOCAL_DEV_BUILD_ENV.apiOrigin]: origin }),
      ),
    ).toBe(origin);
  });

  it('fails closed when combined with a mobile release manifest', () => {
    expect(() =>
      nativeLocalDevApiOriginFromEnvironment(
        localDevEnvironment({ [NATIVE_LOCAL_DEV_BUILD_ENV.releaseArtifact]: 'native' }),
      ),
    ).toThrow(/must never be combined/);
    expect(() =>
      nativeLocalDevApiOriginFromEnvironment(
        localDevEnvironment({ [NATIVE_LOCAL_DEV_BUILD_ENV.releasePlane]: 'beta' }),
      ),
    ).toThrow(/must never be combined/);
  });

  it('requires an API origin', () => {
    expect(() =>
      nativeLocalDevApiOriginFromEnvironment({
        [NATIVE_LOCAL_DEV_BUILD_ENV.flag]: 'true',
      }),
    ).toThrow(/is required/);
  });

  it.each([
    'https://beta-api.zerotime.kr',
    'https://api.zerotime.kr',
    'https://dev-api.zerotime.kr',
    'http://beta-api.zerotime.kr',
    'http://8.8.8.8:8080',
    'http://172.32.0.1:8080',
    'http://192.169.0.1:8080',
    'http://evil.example:8080',
    'http://user:pw@localhost:8080',
    'http://localhost:8080/api',
    'http://localhost:8080?x=1',
    'http://localhost:8080#x',
    'not-a-url',
  ])('rejects the non-local origin %s', (origin) => {
    expect(() =>
      nativeLocalDevApiOriginFromEnvironment(
        localDevEnvironment({ [NATIVE_LOCAL_DEV_BUILD_ENV.apiOrigin]: origin }),
      ),
    ).toThrow();
  });
});
