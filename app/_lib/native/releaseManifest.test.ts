import { describe, expect, it } from 'vitest';
import {
  createMobileReleaseBuildManifest,
  MOBILE_RELEASE_ARTIFACT,
  MOBILE_RELEASE_BUILD_ENV,
  MOBILE_RELEASE_CONTRACT,
  MOBILE_RELEASE_CONTRACT_SHA256,
  NATIVE_API_ORIGIN_BY_PLANE,
  readMobileReleaseBuildManifestFromEnvironment,
  type CreateMobileReleaseBuildManifestInput,
  type MobileReleaseBuildEnvironment,
} from './mobileRelease';

function validInput(): CreateMobileReleaseBuildManifestInput {
  return {
    plane: 'beta',
    frontendGitSha: 'a'.repeat(40),
    backendGitSha: 'b'.repeat(40),
    backendImageDigest: `sha256:${'c'.repeat(64)}`,
    backendDeploymentId: 'release-20260713.1',
    backendDeployedAtUtc: '2026-07-13T12:34:56Z',
    contractVersion: MOBILE_RELEASE_CONTRACT,
    contractSha256: MOBILE_RELEASE_CONTRACT_SHA256,
    firebaseProjectId: 'zerotime-beta-fcm',
    apiOrigin: NATIVE_API_ORIGIN_BY_PLANE.beta,
    platform: 'ios',
    appVersion: '1.0',
    buildNumber: '42',
    bundleId: 'kr.zerotime.app',
  };
}

function nativeEnvironment(
  input: CreateMobileReleaseBuildManifestInput = validInput(),
): MobileReleaseBuildEnvironment {
  return {
    [MOBILE_RELEASE_BUILD_ENV.artifact]: MOBILE_RELEASE_ARTIFACT,
    [MOBILE_RELEASE_BUILD_ENV.plane]: input.plane,
    [MOBILE_RELEASE_BUILD_ENV.frontendGitSha]: input.frontendGitSha,
    [MOBILE_RELEASE_BUILD_ENV.backendGitSha]: input.backendGitSha,
    [MOBILE_RELEASE_BUILD_ENV.backendImageDigest]: input.backendImageDigest,
    [MOBILE_RELEASE_BUILD_ENV.backendDeploymentId]: input.backendDeploymentId,
    [MOBILE_RELEASE_BUILD_ENV.backendDeployedAtUtc]: input.backendDeployedAtUtc,
    [MOBILE_RELEASE_BUILD_ENV.contractVersion]: input.contractVersion,
    [MOBILE_RELEASE_BUILD_ENV.contractSha256]: input.contractSha256,
    [MOBILE_RELEASE_BUILD_ENV.firebaseProjectId]: input.firebaseProjectId,
    [MOBILE_RELEASE_BUILD_ENV.apiOrigin]: input.apiOrigin,
    [MOBILE_RELEASE_BUILD_ENV.platform]: input.platform,
    [MOBILE_RELEASE_BUILD_ENV.appVersion]: input.appVersion,
    [MOBILE_RELEASE_BUILD_ENV.buildNumber]: input.buildNumber,
    [MOBILE_RELEASE_BUILD_ENV.bundleId]: input.bundleId,
  };
}

describe('mobile release build manifest', () => {
  it('returns the complete immutable beta tuple', () => {
    const manifest = createMobileReleaseBuildManifest(validInput());

    expect(manifest).toEqual({
      contract: MOBILE_RELEASE_CONTRACT,
      contract_sha256: MOBILE_RELEASE_CONTRACT_SHA256,
      plane: 'beta',
      frontend_git_sha: 'a'.repeat(40),
      backend_git_sha: 'b'.repeat(40),
      backend_image_digest: `sha256:${'c'.repeat(64)}`,
      backend_deployment_id: 'release-20260713.1',
      backend_deployed_at_utc: '2026-07-13T12:34:56Z',
      firebase_project_id: 'zerotime-beta-fcm',
      api_origin: NATIVE_API_ORIGIN_BY_PLANE.beta,
      platform: 'ios',
      app_version: '1.0',
      build_number: '42',
      bundle_id: 'kr.zerotime.app',
    });
    expect(Object.isFrozen(manifest)).toBe(true);
  });

  it('accepts the independent production API and Firebase plane', () => {
    const manifest = createMobileReleaseBuildManifest({
      ...validInput(),
      plane: 'prod',
      firebaseProjectId: 'zerotime-prod-fcm',
      apiOrigin: NATIVE_API_ORIGIN_BY_PLANE.prod,
      platform: 'android',
    });

    expect(manifest.plane).toBe('prod');
    expect(manifest.firebase_project_id).toBe('zerotime-prod-fcm');
    expect(manifest.api_origin).toBe(NATIVE_API_ORIGIN_BY_PLANE.prod);
  });

  it.each([
    ['missing backend SHA', { backendGitSha: undefined }],
    ['localhost API', { apiOrigin: 'http://localhost:8080' }],
    ['cross-plane API', { apiOrigin: NATIVE_API_ORIGIN_BY_PLANE.prod }],
    ['cross-plane Firebase project', { firebaseProjectId: 'zerotime-prod-fcm' }],
    ['mixed Firebase plane', { firebaseProjectId: 'zerotime-beta-prod-fcm' }],
    ['development Firebase project', { firebaseProjectId: 'zerotime-beta-dev-fcm' }],
    ['non-canonical contract hash', { contractSha256: 'd'.repeat(64) }],
    ['malformed deployment timestamp', { backendDeployedAtUtc: '2026-07-13T12:34:56+09:00' }],
    ['wrong bundle identity', { bundleId: 'kr.zerotime.app.beta' }],
  ])('rejects %s', (_label, invalidFields) => {
    expect(() =>
      createMobileReleaseBuildManifest({
        ...validInput(),
        ...invalidFields,
      }),
    ).toThrow();
  });

  it('reads exactly the native tuple and fails closed without its native artifact marker', () => {
    const environment = nativeEnvironment();

    expect(readMobileReleaseBuildManifestFromEnvironment(environment)).toEqual(
      createMobileReleaseBuildManifest(validInput()),
    );
    expect(() =>
      readMobileReleaseBuildManifestFromEnvironment({
        ...environment,
        [MOBILE_RELEASE_BUILD_ENV.artifact]: undefined,
      }),
    ).toThrow('outside a validated native artifact');
  });
});
