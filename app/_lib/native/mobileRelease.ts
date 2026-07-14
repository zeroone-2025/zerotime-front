import { Capacitor } from '@capacitor/core';

export const MOBILE_RELEASE_CONTRACT = 'mobile-release.v1';
export const MOBILE_RELEASE_CONTRACT_SHA256 =
  '0f736c8e90c5ba1ea68370e327f2f405fba5a83e4807c3bc7691aaa8c0711d84';
export const MOBILE_RELEASE_ARTIFACT = 'native';


export const MOBILE_RELEASE_BUILD_ENV = {
  artifact: 'NEXT_PUBLIC_MOBILE_RELEASE_ARTIFACT',
  plane: 'NEXT_PUBLIC_MOBILE_RELEASE_PLANE',
  frontendGitSha: 'NEXT_PUBLIC_MOBILE_RELEASE_FRONTEND_GIT_SHA',
  backendGitSha: 'NEXT_PUBLIC_MOBILE_RELEASE_BACKEND_GIT_SHA',
  backendImageDigest: 'NEXT_PUBLIC_MOBILE_RELEASE_BACKEND_IMAGE_DIGEST',
  backendDeploymentId: 'NEXT_PUBLIC_MOBILE_RELEASE_BACKEND_DEPLOYMENT_ID',
  backendDeployedAtUtc: 'NEXT_PUBLIC_MOBILE_RELEASE_BACKEND_DEPLOYED_AT_UTC',
  contractVersion: 'NEXT_PUBLIC_MOBILE_RELEASE_CONTRACT_VERSION',
  contractSha256: 'NEXT_PUBLIC_MOBILE_RELEASE_CONTRACT_SHA256',
  firebaseProjectId: 'NEXT_PUBLIC_MOBILE_RELEASE_FIREBASE_PROJECT_ID',
  apiOrigin: 'NEXT_PUBLIC_API_BASE_URL_NATIVE',
  platform: 'NEXT_PUBLIC_MOBILE_RELEASE_PLATFORM',
  appVersion: 'NEXT_PUBLIC_MOBILE_RELEASE_APP_VERSION',
  buildNumber: 'NEXT_PUBLIC_MOBILE_RELEASE_BUILD_NUMBER',
  bundleId: 'NEXT_PUBLIC_MOBILE_RELEASE_BUNDLE_ID',
} as const;

export const NATIVE_API_ORIGIN_BY_PLANE = {
  beta: 'https://beta-api.zerotime.kr',
  prod: 'https://api.zerotime.kr',
} as const;

export type MobilePlatform = 'ios' | 'android';
export type MobileReleasePlane = keyof typeof NATIVE_API_ORIGIN_BY_PLANE;
export type MobileEnvironment = 'beta' | 'production';
export type PushPermissionStatus =
  | 'not_determined'
  | 'denied'
  | 'granted'
  | 'provisional'
  | 'ephemeral';

export interface MobileReleaseBuildManifest {
  readonly contract: typeof MOBILE_RELEASE_CONTRACT;
  readonly contract_sha256: typeof MOBILE_RELEASE_CONTRACT_SHA256;
  readonly plane: MobileReleasePlane;
  readonly frontend_git_sha: string;
  readonly backend_git_sha: string;
  readonly backend_image_digest: string;
  readonly backend_deployment_id: string;
  readonly backend_deployed_at_utc: string;
  readonly firebase_project_id: string;
  readonly api_origin: (typeof NATIVE_API_ORIGIN_BY_PLANE)[MobileReleasePlane];
  readonly platform: MobilePlatform;
  readonly app_version: string;
  readonly build_number: string;
  readonly bundle_id: 'kr.zerotime.app';
}

export interface CreateMobileReleaseBuildManifestInput {
  readonly plane: string | undefined;
  readonly frontendGitSha: string | undefined;
  readonly backendGitSha: string | undefined;
  readonly backendImageDigest: string | undefined;
  readonly backendDeploymentId: string | undefined;
  readonly backendDeployedAtUtc: string | undefined;
  readonly contractVersion: string | undefined;
  readonly contractSha256: string | undefined;
  readonly firebaseProjectId: string | undefined;
  readonly apiOrigin: string | undefined;
  readonly platform: string | undefined;
  readonly appVersion: string | undefined;
  readonly buildNumber: string | undefined;
  readonly bundleId: string | undefined;
}

export type MobileReleaseBuildEnvironment = Readonly<Record<string, string | undefined>>;

export function createMobileReleaseBuildManifest(
  input: CreateMobileReleaseBuildManifestInput,
): MobileReleaseBuildManifest {
  const plane = requireReleasePlane(input.plane);
  const apiOrigin = requireApiOrigin(input.apiOrigin, plane);

  return Object.freeze({
    contract: requireExact(
      input.contractVersion,
      MOBILE_RELEASE_BUILD_ENV.contractVersion,
      MOBILE_RELEASE_CONTRACT,
    ),
    contract_sha256: requireExact(
      input.contractSha256,
      MOBILE_RELEASE_BUILD_ENV.contractSha256,
      MOBILE_RELEASE_CONTRACT_SHA256,
    ),
    plane,
    frontend_git_sha: requireGitSha(input.frontendGitSha, MOBILE_RELEASE_BUILD_ENV.frontendGitSha),
    backend_git_sha: requireGitSha(input.backendGitSha, MOBILE_RELEASE_BUILD_ENV.backendGitSha),
    backend_image_digest: requireImageDigest(input.backendImageDigest),
    backend_deployment_id: requireDeploymentId(input.backendDeploymentId),
    backend_deployed_at_utc: requireUtcTimestamp(input.backendDeployedAtUtc),
    firebase_project_id: requireFirebaseProjectId(input.firebaseProjectId, plane),
    api_origin: apiOrigin,
    platform: requirePlatform(input.platform),
    app_version: requireAppVersion(input.appVersion),
    build_number: requireBuildNumber(input.buildNumber),
    bundle_id: requireExact(
      input.bundleId,
      MOBILE_RELEASE_BUILD_ENV.bundleId,
      'kr.zerotime.app',
    ),
  });
}

export function readMobileReleaseBuildManifest(): MobileReleaseBuildManifest {
  return readMobileReleaseBuildManifestFromEnvironment({
    [MOBILE_RELEASE_BUILD_ENV.artifact]: process.env.NEXT_PUBLIC_MOBILE_RELEASE_ARTIFACT,
    [MOBILE_RELEASE_BUILD_ENV.plane]: process.env.NEXT_PUBLIC_MOBILE_RELEASE_PLANE,
    [MOBILE_RELEASE_BUILD_ENV.frontendGitSha]: process.env.NEXT_PUBLIC_MOBILE_RELEASE_FRONTEND_GIT_SHA,
    [MOBILE_RELEASE_BUILD_ENV.backendGitSha]: process.env.NEXT_PUBLIC_MOBILE_RELEASE_BACKEND_GIT_SHA,
    [MOBILE_RELEASE_BUILD_ENV.backendImageDigest]:
      process.env.NEXT_PUBLIC_MOBILE_RELEASE_BACKEND_IMAGE_DIGEST,
    [MOBILE_RELEASE_BUILD_ENV.backendDeploymentId]:
      process.env.NEXT_PUBLIC_MOBILE_RELEASE_BACKEND_DEPLOYMENT_ID,
    [MOBILE_RELEASE_BUILD_ENV.backendDeployedAtUtc]:
      process.env.NEXT_PUBLIC_MOBILE_RELEASE_BACKEND_DEPLOYED_AT_UTC,
    [MOBILE_RELEASE_BUILD_ENV.contractVersion]:
      process.env.NEXT_PUBLIC_MOBILE_RELEASE_CONTRACT_VERSION,
    [MOBILE_RELEASE_BUILD_ENV.contractSha256]:
      process.env.NEXT_PUBLIC_MOBILE_RELEASE_CONTRACT_SHA256,
    [MOBILE_RELEASE_BUILD_ENV.firebaseProjectId]:
      process.env.NEXT_PUBLIC_MOBILE_RELEASE_FIREBASE_PROJECT_ID,
    [MOBILE_RELEASE_BUILD_ENV.apiOrigin]: process.env.NEXT_PUBLIC_API_BASE_URL_NATIVE,
    [MOBILE_RELEASE_BUILD_ENV.platform]: process.env.NEXT_PUBLIC_MOBILE_RELEASE_PLATFORM,
    [MOBILE_RELEASE_BUILD_ENV.appVersion]: process.env.NEXT_PUBLIC_MOBILE_RELEASE_APP_VERSION,
    [MOBILE_RELEASE_BUILD_ENV.buildNumber]: process.env.NEXT_PUBLIC_MOBILE_RELEASE_BUILD_NUMBER,
    [MOBILE_RELEASE_BUILD_ENV.bundleId]: process.env.NEXT_PUBLIC_MOBILE_RELEASE_BUNDLE_ID,
  });
}

export function readMobileReleaseBuildManifestFromEnvironment(
  environment: MobileReleaseBuildEnvironment,
): MobileReleaseBuildManifest {
  if (environment[MOBILE_RELEASE_BUILD_ENV.artifact] !== MOBILE_RELEASE_ARTIFACT) {
    throw new Error('Mobile release manifest is unavailable outside a validated native artifact.');
  }

  return createMobileReleaseBuildManifest({
    plane: environment[MOBILE_RELEASE_BUILD_ENV.plane],
    frontendGitSha: environment[MOBILE_RELEASE_BUILD_ENV.frontendGitSha],
    backendGitSha: environment[MOBILE_RELEASE_BUILD_ENV.backendGitSha],
    backendImageDigest: environment[MOBILE_RELEASE_BUILD_ENV.backendImageDigest],
    backendDeploymentId: environment[MOBILE_RELEASE_BUILD_ENV.backendDeploymentId],
    backendDeployedAtUtc: environment[MOBILE_RELEASE_BUILD_ENV.backendDeployedAtUtc],
    contractVersion: environment[MOBILE_RELEASE_BUILD_ENV.contractVersion],
    contractSha256: environment[MOBILE_RELEASE_BUILD_ENV.contractSha256],
    firebaseProjectId: environment[MOBILE_RELEASE_BUILD_ENV.firebaseProjectId],
    apiOrigin: environment[MOBILE_RELEASE_BUILD_ENV.apiOrigin],
    platform: environment[MOBILE_RELEASE_BUILD_ENV.platform],
    appVersion: environment[MOBILE_RELEASE_BUILD_ENV.appVersion],
    buildNumber: environment[MOBILE_RELEASE_BUILD_ENV.buildNumber],
    bundleId: environment[MOBILE_RELEASE_BUILD_ENV.bundleId],
  });
}

/**
 * Production installation identity is an atomic native secure-storage operation.
 * Preferences must not be used for identity or coordinator state.
 */
export interface NativeInstallationIdentity {
  getOrCreateInstallationId(): Promise<{ readonly installation_id: string }>;
}

export async function getOrCreateInstallationId(
  nativeIdentity: NativeInstallationIdentity,
): Promise<string> {
  const installationId = (await nativeIdentity.getOrCreateInstallationId()).installation_id;
  if (!isUuid(installationId)) {
    throw new Error('Native installation identity was not acknowledged.');
  }
  return installationId;
}

/**
 * Returns false only for web. A Capacitor runtime reporting iOS or Android must
 * provide a matching, fully validated release manifest; it is never demoted to
 * cookie-backed web behavior.
 */
export function isValidatedNativeReleaseRuntime(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const platform = Capacitor.getPlatform();
  const native = Capacitor.isNativePlatform();
  if (!native) {
    if (platform === 'ios' || platform === 'android') {
      throw new Error('Capacitor platform/native-runtime detection disagreed.');
    }
    return false;
  }

  readValidatedNativeReleaseManifest();
  return true;
}

export function readValidatedNativeReleaseManifest(): MobileReleaseBuildManifest {
  if (typeof window === 'undefined' || !Capacitor.isNativePlatform()) {
    throw new Error('A validated mobile release manifest is required on a native runtime.');
  }

  const manifest = readMobileReleaseBuildManifest();
  const capacitorPlatform = Capacitor.getPlatform();
  if (capacitorPlatform !== manifest.platform) {
    throw new Error('Mobile release manifest platform did not match Capacitor.');
  }
  if (manifest.api_origin !== NATIVE_API_ORIGIN_BY_PLANE[manifest.plane]) {
    throw new Error('Mobile release manifest API origin did not match its release plane.');
  }

  return manifest;
}

export interface MobileReleaseHeaders {
  readonly 'X-ZeroTime-Contract': typeof MOBILE_RELEASE_CONTRACT;
  readonly 'Idempotency-Key'?: string;
  readonly [name: string]: string | undefined;
}

export interface InstallationGenerations {
  readonly installation_id: string;
  readonly binding_generation: number;
  readonly token_generation: number;
}

export interface RegisterInstallationRequest {
  readonly platform: MobilePlatform;
  readonly environment: MobileEnvironment;
  readonly token_provider: 'fcm';
  readonly token_type: 'fcm_registration';
  readonly fcm_token: string;
  readonly permission_status: PushPermissionStatus;
  readonly expected_binding_generation?: number;
}

export interface UpdateInstallationTokenRequest {
  readonly fcm_token: string;
  readonly expected_token_generation: number;
}

export interface UpdateInstallationPermissionRequest {
  readonly permission_status: PushPermissionStatus;
  readonly expected_binding_generation: number;
}

/**
 * The authenticated transport derives the immutable subject from its in-memory
 * bearer session. It is deliberately not a field in any durable frontend state.
 */
export interface LinkInstallationRequest {
  readonly expected_binding_generation?: number;
}

export interface UnlinkInstallationRequest {
  readonly expected_binding_generation: number;
  readonly reason: 'logout' | 'account_switch' | 'deletion';
}

export interface DisplayAuthorizationRequest {
  readonly delivery_id: string;
  readonly notice_id: string;
  readonly installation_id: string;
  readonly binding_generation: number;
  readonly token_generation: number;
  readonly session_id: string;
  readonly client_display_epoch: string;
}

export interface AuthorizedDisplayAuthorization {
  readonly authorized: true;
  readonly authorization_id: string;
  readonly authorization_expires_at_utc: string;
  readonly delivery_id: string;
  readonly client_display_epoch: string;
  readonly notice: {
    readonly id: number;
    readonly public_title: string;
  };
  readonly display: {
    readonly app_name: 'ZeroTime';
  };
  readonly installation: {
    readonly binding_generation: number;
    readonly token_generation: number;
  };
}

export interface DeniedDisplayAuthorization {
  readonly authorized: false;
  readonly client_display_epoch: string;
}

export type DisplayAuthorizationResponse =
  | AuthorizedDisplayAuthorization
  | DeniedDisplayAuthorization;


/**
 * Endpoint ownership remains the backend OpenAPI. This interface intentionally
 * exposes typed operations rather than duplicating provisional URL literals.
 */
export interface MobileReleaseTransport {
  putInstallation(
    installationId: string,
    request: RegisterInstallationRequest,
    headers: MobileReleaseHeaders,
  ): Promise<InstallationGenerations>;
  patchInstallationToken(
    installationId: string,
    request: UpdateInstallationTokenRequest,
    headers: MobileReleaseHeaders,
  ): Promise<InstallationGenerations>;
  patchInstallationPermission(
    installationId: string,
    request: UpdateInstallationPermissionRequest,
    headers: MobileReleaseHeaders,
  ): Promise<InstallationGenerations>;
  linkInstallation(
    installationId: string,
    request: LinkInstallationRequest,
    headers: MobileReleaseHeaders,
  ): Promise<InstallationGenerations>;
  unlinkInstallation(
    installationId: string,
    request: UnlinkInstallationRequest,
    headers: MobileReleaseHeaders,
  ): Promise<InstallationGenerations>;
  authorizeDisplay(
    request: DisplayAuthorizationRequest,
    headers: MobileReleaseHeaders,
  ): Promise<DisplayAuthorizationResponse>;
}

export class MobileReleaseClient {
  constructor(private readonly transport: MobileReleaseTransport) {}

  async registerInstallation(
    installationId: string,
    request: RegisterInstallationRequest,
  ): Promise<InstallationGenerations> {
    return validateInstallationGenerations(
      await this.transport.putInstallation(installationId, request, this.mutationHeaders()),
      installationId,
    );
  }

  async updateInstallationToken(
    installationId: string,
    request: UpdateInstallationTokenRequest,
  ): Promise<InstallationGenerations> {
    return validateInstallationGenerations(
      await this.transport.patchInstallationToken(installationId, request, this.mutationHeaders()),
      installationId,
    );
  }

  async updateInstallationPermission(
    installationId: string,
    request: UpdateInstallationPermissionRequest,
  ): Promise<InstallationGenerations> {
    return validateInstallationGenerations(
      await this.transport.patchInstallationPermission(installationId, request, this.mutationHeaders()),
      installationId,
    );
  }

  async linkInstallation(
    installationId: string,
    request: LinkInstallationRequest,
  ): Promise<InstallationGenerations> {
    return validateInstallationGenerations(
      await this.transport.linkInstallation(installationId, request, this.mutationHeaders()),
      installationId,
    );
  }

  async unlinkInstallation(
    installationId: string,
    request: UnlinkInstallationRequest,
  ): Promise<InstallationGenerations> {
    return validateInstallationGenerations(
      await this.transport.unlinkInstallation(installationId, request, this.mutationHeaders()),
      installationId,
    );
  }

  authorizeDisplay(request: DisplayAuthorizationRequest): Promise<DisplayAuthorizationResponse> {
    return this.transport.authorizeDisplay(request, this.mutationHeaders());
  }


  private mutationHeaders(): MobileReleaseHeaders {
    return {
      'X-ZeroTime-Contract': MOBILE_RELEASE_CONTRACT,
      'Idempotency-Key': createIdempotencyKey(),
    };
  }
}



export function createIdempotencyKey(): string {
  return createUuid();
}
function validateInstallationGenerations(
  response: InstallationGenerations,
  installationId: string,
): InstallationGenerations {
  if (
    response.installation_id !== installationId ||
    !isNonNegativeInteger(response.binding_generation) ||
    !isNonNegativeInteger(response.token_generation)
  ) {
    throw new Error('Installation generation response was invalid.');
  }
  return response;
}

function requireNonEmpty(value: string | undefined, name: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    throw new Error(`${name} must be a non-empty value without surrounding whitespace.`);
  }

  return value;
}

function requireExact<T extends string>(
  value: string | undefined,
  name: string,
  expected: T,
): T {
  if (value !== expected) {
    throw new Error(`${name} must equal ${expected}.`);
  }

  return expected;
}

function requireReleasePlane(value: string | undefined): MobileReleasePlane {
  if (value !== 'beta' && value !== 'prod') {
    throw new Error(`${MOBILE_RELEASE_BUILD_ENV.plane} must be beta or prod.`);
  }

  return value;
}

function requireGitSha(value: string | undefined, name: string): string {
  const gitSha = requireNonEmpty(value, name);
  if (!/^[0-9a-f]{40}$/.test(gitSha)) {
    throw new Error(`${name} must be a 40-character lowercase hexadecimal Git SHA.`);
  }

  return gitSha;
}

function requireImageDigest(value: string | undefined): string {
  const imageDigest = requireNonEmpty(value, MOBILE_RELEASE_BUILD_ENV.backendImageDigest);
  if (!/^sha256:[0-9a-f]{64}$/.test(imageDigest)) {
    throw new Error(
      `${MOBILE_RELEASE_BUILD_ENV.backendImageDigest} must be an immutable sha256:<64 lowercase hex> digest.`,
    );
  }

  return imageDigest;
}

function requireDeploymentId(value: string | undefined): string {
  const deploymentId = requireNonEmpty(value, MOBILE_RELEASE_BUILD_ENV.backendDeploymentId);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(deploymentId)) {
    throw new Error(
      `${MOBILE_RELEASE_BUILD_ENV.backendDeploymentId} must be a 1-128 character deployment identifier.`,
    );
  }

  return deploymentId;
}

function requireUtcTimestamp(value: string | undefined): string {
  const timestamp = requireNonEmpty(value, MOBILE_RELEASE_BUILD_ENV.backendDeployedAtUtc);
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?Z$/.exec(timestamp);

  if (!match) {
    throw new Error(
      `${MOBILE_RELEASE_BUILD_ENV.backendDeployedAtUtc} must be an ISO-8601 UTC timestamp ending in Z.`,
    );
  }

  const normalizedTimestamp = `${match[1]}.${(match[2] ?? '').padEnd(3, '0')}Z`;
  const parsedTimestamp = new Date(normalizedTimestamp);
  if (
    Number.isNaN(parsedTimestamp.valueOf()) ||
    parsedTimestamp.toISOString() !== normalizedTimestamp
  ) {
    throw new Error(`${MOBILE_RELEASE_BUILD_ENV.backendDeployedAtUtc} is not a real UTC timestamp.`);
  }

  return timestamp;
}

function requireFirebaseProjectId(
  value: string | undefined,
  plane: MobileReleasePlane,
): string {
  const projectId = requireNonEmpty(value, MOBILE_RELEASE_BUILD_ENV.firebaseProjectId);
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) {
    throw new Error(`${MOBILE_RELEASE_BUILD_ENV.firebaseProjectId} is not a valid Firebase project ID.`);
  }

  const betaPlane = /(?:^|-)beta(?:-|$)/.test(projectId);
  const prodPlane = /(?:^|-)(?:prod|production)(?:-|$)/.test(projectId);
  const nonReleasePlane = /(?:^|-)(?:dev|local)(?:-|$)/.test(projectId);
  const belongsToPlane = plane === 'beta'
    ? betaPlane && !prodPlane
    : prodPlane && !betaPlane;

  if (!belongsToPlane || nonReleasePlane) {
    throw new Error(
      `${MOBILE_RELEASE_BUILD_ENV.firebaseProjectId} must identify only the ${plane} Firebase plane.`,
    );
  }

  return projectId;
}

function requireApiOrigin(
  value: string | undefined,
  plane: MobileReleasePlane,
): (typeof NATIVE_API_ORIGIN_BY_PLANE)[MobileReleasePlane] {
  const expectedOrigin = NATIVE_API_ORIGIN_BY_PLANE[plane];
  if (value !== expectedOrigin) {
    throw new Error(
      `${MOBILE_RELEASE_BUILD_ENV.apiOrigin} must equal ${expectedOrigin} for the ${plane} plane.`,
    );
  }

  return expectedOrigin;
}

function requirePlatform(value: string | undefined): MobilePlatform {
  if (value !== 'ios' && value !== 'android') {
    throw new Error(`${MOBILE_RELEASE_BUILD_ENV.platform} must be ios or android.`);
  }

  return value;
}

function requireAppVersion(value: string | undefined): string {
  const appVersion = requireNonEmpty(value, MOBILE_RELEASE_BUILD_ENV.appVersion);
  if (!/^(?:0|[1-9]\d*)(?:\.(?:0|[1-9]\d*)){1,2}(?:[-+][0-9A-Za-z.-]+)?$/.test(appVersion)) {
    throw new Error(`${MOBILE_RELEASE_BUILD_ENV.appVersion} must be a native app version.`);
  }

  return appVersion;
}

function requireBuildNumber(value: string | undefined): string {
  const buildNumber = requireNonEmpty(value, MOBILE_RELEASE_BUILD_ENV.buildNumber);
  if (!/^[1-9]\d*$/.test(buildNumber)) {
    throw new Error(`${MOBILE_RELEASE_BUILD_ENV.buildNumber} must be a positive integer.`);
  }

  return buildNumber;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function createUuid(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  if (typeof globalThis.crypto?.getRandomValues !== 'function') {
    throw new Error('Secure randomness is required for mobile release identifiers.');
  }

  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
