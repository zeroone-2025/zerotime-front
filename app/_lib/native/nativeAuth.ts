import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';


import {
  DELETION_NATIVE_REAUTH_HANDOFF_STORAGE_KEY,
  DELETION_OPERATION_AUDIT_STORAGE_KEY,
  DELETION_OPERATION_STORAGE_KEY,
  DELETION_STATUS_STORAGE_KEY,
  parseDeletionCapabilityResponse,
  parseNativeDeletionReauthHandoff,
  parseStoredDeletionOperationRecord,
  type DeletionOperation,
  type DeletionReauthTransient,
} from '@/_lib/accountDeletion';
import { authApi } from '@/_lib/api/client';
import {
  clearAccessToken,
  getAccessToken,
  hasAccessToken,
  markLogoutPending,
  setAccessToken,
} from '@/_lib/auth/tokenStore';

import {
  createIdempotencyKey,
  getOrCreateInstallationId,
  isValidatedNativeReleaseRuntime,
  readValidatedNativeReleaseManifest,
  MOBILE_RELEASE_CONTRACT,
} from './mobileRelease';
import {
  nativeNotificationCoordinatorPlugin,
  type AccountMutationReason,
  type NativeAccountMutationLineage,
  type NativeMutationReceipt,
  type NativeNotificationCoordinatorPlugin,
} from './notificationCoordinator';

export type NativeOAuthProvider = 'google' | 'apple' | 'naver' | 'kakao';
export type NativeAuthPlatform = 'ios' | 'android';

export const NATIVE_AUTH_CALLBACK_ORIGIN = 'https://zerotime.kr';
export const NATIVE_AUTH_CALLBACK_PATH = '/auth/native/callback/';

const NATIVE_AUTH_TRANSIENT_STORAGE_KEY = 'zerotime.native-auth.transient.v1';
const NATIVE_AUTH_REFRESH_STORAGE_KEY = 'zerotime.native-auth.refresh.v1';
const NATIVE_AUTH_SESSION_STORAGE_KEY = 'zerotime.native-auth.session.v1';
const NATIVE_AUTH_PRIVACY_BARRIER_FAILED_STORAGE_KEY = 'zerotime.native-auth.privacy-barrier-failed.v1';
const NATIVE_AUTH_CORRUPT_SESSION_AUDIT_STORAGE_KEY = 'zerotime.native-auth.corrupt-session-audit.v1';
const NATIVE_AUTH_SECURE_STORAGE_KEYS = new Set<string>([
  NATIVE_AUTH_TRANSIENT_STORAGE_KEY,
  NATIVE_AUTH_REFRESH_STORAGE_KEY,
  NATIVE_AUTH_SESSION_STORAGE_KEY,
  NATIVE_AUTH_PRIVACY_BARRIER_FAILED_STORAGE_KEY,
  NATIVE_AUTH_CORRUPT_SESSION_AUDIT_STORAGE_KEY,
  DELETION_STATUS_STORAGE_KEY,
  DELETION_OPERATION_STORAGE_KEY,
  DELETION_OPERATION_AUDIT_STORAGE_KEY,
  DELETION_NATIVE_REAUTH_HANDOFF_STORAGE_KEY,
]);

export interface NativeAuthSecureStorageAdapter {
  isAvailable(): Promise<boolean>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}
export type NativeAuthSecureCredentialsPlugin = Pick<
  NativeNotificationCoordinatorPlugin,
  | 'isSecureCredentialStorageAvailable'
  | 'getSecureCredential'
  | 'setSecureCredential'
  | 'deleteSecureCredential'
>;

/**
 * Credentials may cross this boundary only through the same native plugin that
 * owns the Keychain/Keystore implementation. There is no Preferences or web
 * storage fallback.
 */
export function createNativeAuthSecureStorageAdapter(
  plugin: NativeAuthSecureCredentialsPlugin = nativeNotificationCoordinatorPlugin,
): NativeAuthSecureStorageAdapter {
  return {
    async isAvailable() {
      const result = await plugin.isSecureCredentialStorageAvailable();
      return hasExactOwnKeys(result, ['available']) && result.available === true;
    },
    async get(key) {
      requireNativeAuthSecureStorageKey(key);
      const result = await plugin.getSecureCredential({ key });
      if (
        hasExactOwnKeys(result, ['value'])
        && (result.value === null || typeof result.value === 'string')
      ) {
        return result.value;
      }
      throw new NativeAuthError(
        'SECURE_STORAGE_INVALID_RESPONSE',
        'Native secure storage returned an invalid credential value.',
      );
    },
    async set(key, value) {
      requireNativeAuthSecureStorageKey(key);
      if (typeof value !== 'string') {
        throw new NativeAuthError(
          'SECURE_STORAGE_INVALID_VALUE',
          'Native secure storage requires a string credential value.',
        );
      }
      const result = await plugin.setSecureCredential({ key, value });
      if (!hasExactOwnKeys(result, ['success']) || result.success !== true) {
        throw new NativeAuthError(
          'SECURE_STORAGE_WRITE_FAILED',
          'Native secure storage did not acknowledge the credential write.',
        );
      }
    },
    async remove(key) {
      requireNativeAuthSecureStorageKey(key);
      const result = await plugin.deleteSecureCredential({ key });
      if (!hasExactOwnKeys(result, ['success']) || result.success !== true) {
        throw new NativeAuthError(
          'SECURE_STORAGE_DELETE_FAILED',
          'Native secure storage did not acknowledge the credential deletion.',
        );
      }
    },
  };
}

/**
 * The native coordinator is the only privacy barrier. Both receipts must prove
 * the same closed epoch has zero pending, delivered, banner, registry, and
 * in-flight entries.
 */
export interface NativeAuthNotificationBarrier {
  beginAccountMutation(reason: AccountMutationReason): Promise<NativeMutationReceipt>;
  finalizeAccountMutation(
    reason: AccountMutationReason,
    displayEpoch: string,
  ): Promise<NativeMutationReceipt>;
  getAccountMutationLineage(): Promise<NativeAccountMutationLineage | null>;
}
export type NativeAuthSessionBindResult = 'bound' | 'blocked' | 'failed';

export interface NativeAuthSessionBinder {
  bindSession(session: NativeAuthSession): Promise<NativeAuthSessionBindResult>;
}

export interface NativeAuthSession {
  readonly sessionId: string;
  readonly authVersion: number;
  readonly installationId: string;
  readonly bindingGeneration: number;
  readonly tokenGeneration: number;
  /** Full authorization header value; volatile and never written to storage. */
  readonly authorizationBearer: string;
}

export interface NativeAuthCallbackResult {
  readonly redirectTo: string;
  readonly session: NativeAuthSession;
}
export type NativeAuthCallbackRouteResult =
  | { readonly kind: 'login'; readonly result: NativeAuthCallbackResult }
  | {
      readonly kind: 'deletion_capability';
      readonly purpose: DeletionReauthTransient['purpose'];
      readonly requestId: string;
    }
  | {
      readonly kind: 'deletion_rejected';
      readonly purpose: DeletionReauthTransient['purpose'];
    };

interface NativeAuthTransactionResponse {
  readonly transaction_id: string;
  readonly provider: NativeOAuthProvider;
  readonly purpose: 'login' | 'request' | 'cancel';
  readonly authorization_url: string;
  readonly expires_at_utc: string;
}

interface NativeActiveSessionResponse {
  readonly access_token: string;
  readonly token_type: 'Bearer';
  readonly expires_at_utc: string;
  readonly refresh_token: string;
  readonly session_id: string;
  readonly auth_version: number;
  readonly installation: {
    readonly installation_id: string;
    readonly binding_generation: number;
    readonly token_generation: number;
    readonly binding_state: 'bound' | 'unlinked';
  };
}
interface NativeLogoutAcknowledgement {
  readonly installation_id: string;
  readonly binding_generation: number;
  readonly token_generation: number;
  readonly binding_state: 'unlinked';
  readonly acknowledged_at_utc: string;
}

interface NativeDeletionCapabilityResponse {
  readonly result_type: 'deletion_capability';
  readonly deletion_capability: string;
  readonly purpose: 'request' | 'cancel';
  readonly expires_at_utc: string;
  readonly request_id: string;
}

interface NativeAuthTransient {
  readonly version: 1;
  readonly transactionId: string;
  readonly provider: NativeOAuthProvider;
  readonly state: string;
  readonly nonce: string;
  readonly codeVerifier: string;
  readonly exchangeIdempotencyKey: string;
  readonly redirectTo: string;
}
interface NativeStoredSession {
  readonly version: 1;
  readonly sessionId: string;
  readonly authVersion: number;
  readonly installationId: string;
  readonly bindingGeneration: number;
  readonly tokenGeneration: number;
  readonly pendingMutation?: NativePendingMutation;
}
type NativePendingMutationPhase =
  | 'pre_begin'
  | 'native_begin_pending'
  | 'server_acknowledgement_pending'
  | 'refresh_recovery_pending'
  | 'server_acknowledged'
  | 'reconciliation_required';

interface NativePendingMutation {
  readonly version: 1 | 2 | 3 | 4;
  readonly reason: 'logout' | 'account_switch';
  readonly sessionId: string;
  readonly installationId: string;
  readonly bindingGeneration: number;
  readonly idempotencyKey: string;
  /**
   * Version 4 separates a durable pre-begin intent from an idempotent native
   * begin request and then persists the exact returned epoch. Older journals
   * never receive a synthetic owner.
   */
  readonly displayEpoch?: string;
  readonly phase?: NativePendingMutationPhase;
  readonly refreshRecoveryIdempotencyKey?: string;
}

interface NativeMutationOwner {
  readonly reason: AccountMutationReason;
  readonly displayEpoch: string;
}
interface NativeOwnedPrivacyBarrierFailure {
  readonly version: 2;
  readonly reason: AccountMutationReason;
  readonly display_epoch: string;
  readonly corruptSession?: true;
}
interface NativeUnownedPrivacyBarrierFailure {
  readonly version: 2;
  readonly unowned: true;
  readonly corruptSession?: true;
}
interface NativeLegacyPrivacyBarrierFailure {
  readonly version: 1;
  readonly legacy: true;
  readonly corruptSession?: true;
}
type NativePrivacyBarrierFailure =
  | NativeOwnedPrivacyBarrierFailure
  | NativeUnownedPrivacyBarrierFailure
  | NativeLegacyPrivacyBarrierFailure;
type NativeStoredSessionState =
  | { readonly kind: 'absent' }
  | { readonly kind: 'valid'; readonly session: NativeStoredSession }
  | { readonly kind: 'corrupt'; readonly value: string };
interface NativeCorruptSessionAudit {
  readonly version: 2;
  readonly sessionValue: string;
  readonly pendingMutation: NativePendingMutation | null;
  readonly reason: AccountMutationReason;
  readonly display_epoch: string;
  readonly serverAcknowledged: boolean;
}
interface NativeCorruptSessionBeginIntent {
  readonly version: 3;
  readonly sessionValue: string;
  readonly pendingMutation: NativePendingMutation | null;
  readonly reason: AccountMutationReason;
  readonly phase: 'native_begin_pending';
}

type NativeCorruptSessionRecoveryRecord =
  | NativeCorruptSessionAudit
  | NativeCorruptSessionBeginIntent;
interface StagedNativeSession {
  readonly storage: NativeAuthSecureStorageAdapter;
  readonly response: NativeActiveSessionResponse;
  readonly session: NativeAuthSession;
  readonly clearPendingTransaction: boolean;
  readonly transitionGeneration: number;
}

interface ParsedNativeCallback {
  readonly kind: 'code' | 'error';
  readonly state: string;
  readonly code?: string;
  readonly error?: string;
  readonly errorDescription?: string;
}

type NativeAuthCallbackSubscriber = {
  onSuccess: (result: NativeAuthCallbackResult) => void;
  onError?: (error: Error) => void;
};

export class NativeAuthError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'NativeAuthError';
  }
}
class NativeAuthCleanupError extends NativeAuthError {
  constructor(
    code: string,
    message: string,
    readonly cleanupErrors: readonly unknown[],
  ) {
    super(code, message);
    this.name = 'NativeAuthCleanupError';
  }
}
class NativeAuthCallbackRouteError extends NativeAuthError {
  constructor(
    code: string,
    message: string,
    readonly owner: 'login' | 'deletion' | null,
  ) {
    super(code, message);
    this.name = 'NativeAuthCallbackRouteError';
  }
}

let secureStorage: NativeAuthSecureStorageAdapter | null = null;
let notificationBarrier: NativeAuthNotificationBarrier | null = null;
let sessionBinder: NativeAuthSessionBinder | null = null;
let currentSession: NativeAuthSession | null = null;
let stagedSession: StagedNativeSession | null = null;
let sessionCommitLane: Promise<void> = Promise.resolve();
let privacyBarrierFailed = false;
let appUrlListener: { remove: () => Promise<void> } | null = null;
let appUrlListenerSetup: Promise<void> | null = null;
let callbackLane: Promise<void> = Promise.resolve();
let sessionTransitionGeneration = 0;
let sessionPublicationBlockedByMutation = false;
let nativeRefreshPromise: Promise<string | null> | null = null;
const callbackSubscribers = new Set<NativeAuthCallbackSubscriber>();

function enqueueSecureSessionCommit<T>(work: () => Promise<T>): Promise<T> {
  const task = sessionCommitLane.then(work, work);
  sessionCommitLane = task.then(
    () => undefined,
    () => undefined,
  );
  return task;
}
function enqueueNativeCallback<T>(work: () => Promise<T>): Promise<T> {
  const task = callbackLane.then(work, work);
  callbackLane = task.then(
    () => undefined,
    () => undefined,
  );
  return task;
}

/**
 * Native startup must provide a Keychain/Keystore-backed, backup-excluded adapter
 * before any native OAuth action. There is intentionally no Preferences or web
 * storage fallback.
 */
export function setNativeAuthSecureStorageAdapter(adapter: NativeAuthSecureStorageAdapter | null): void {
  secureStorage = adapter;
}

/**
 * Native startup installs the one serialized native bind transition before any
 * restore, callback, or refresh may publish a session.
 */
export function setNativeAuthNotificationBarrier(barrier: NativeAuthNotificationBarrier | null): void {
  notificationBarrier = barrier;
}

export function setNativeAuthSessionBinder(binder: NativeAuthSessionBinder | null): void {
  sessionBinder = binder;
}

export function isNativeAuthPlatform(): boolean {
  return isValidatedNativeReleaseRuntime();
}

export function getNativeAuthSession(): NativeAuthSession | null {
  return currentSession;
}

export function invalidateNativeAuthSessionPublication(): void {
  sessionTransitionGeneration += 1;
}

export function invalidateNativeAuthSessionForMutation(): void {
  sessionPublicationBlockedByMutation = true;
  invalidateNativeAuthSessionPublication();
  stagedSession = null;
  currentSession = null;
}
export function releaseNativeAuthSessionAfterDeletionCancellation(): void {
  stagedSession = null;
  sessionPublicationBlockedByMutation = false;
}
async function invalidateNativeAuthSessionForMutationOnCommitLane(): Promise<void> {
  await enqueueSecureSessionCommit(async () => {
    invalidateNativeAuthSessionForMutation();
  });
}

export function getNativeAuthSessionTransitionGeneration(): number {
  return sessionTransitionGeneration;
}

export function isNativeAuthSessionCurrent(
  sessionId: string,
  transitionGeneration: number,
): boolean {
  return (
    !sessionPublicationBlockedByMutation
    && transitionGeneration === sessionTransitionGeneration
    && currentSession?.sessionId === sessionId
  );
}
export async function completeStagedNativeAuthSession(session: NativeAuthSession): Promise<boolean> {
  return enqueueSecureSessionCommit(() => commitStagedNativeAuthSession(session));
}

export async function applyNativeAuthSessionGenerations(
  sessionId: string,
  bindingGeneration: number,
  tokenGeneration: number,
  expectedTransitionGeneration: number,
): Promise<void> {
  return enqueueSecureSessionCommit(() => applyNativeAuthSessionGenerationsOnce(
    sessionId,
    bindingGeneration,
    tokenGeneration,
    expectedTransitionGeneration,
  ));
}

async function applyNativeAuthSessionGenerationsOnce(
  sessionId: string,
  bindingGeneration: number,
  tokenGeneration: number,
  expectedTransitionGeneration: number,
): Promise<void> {
  const activeSession = currentSession;
  if (
    sessionPublicationBlockedByMutation
    || expectedTransitionGeneration !== sessionTransitionGeneration
  ) {
    throw new NativeAuthError(
      'NATIVE_GENERATION_UPDATE_STALE',
      'Native installation generations became stale before publication.',
    );
  }
  if (
    !activeSession
    || activeSession.sessionId !== sessionId
    || !isPositiveInteger(bindingGeneration)
    || !isNonNegativeInteger(tokenGeneration)
  ) {
    throw new NativeAuthError(
      'NATIVE_GENERATION_UPDATE_INVALID',
      'Native installation generations did not match the active session.',
    );
  }

  const storage = await requireSecureStorage();
  const storedSession = await requireUncorruptedStoredSession(
    storage,
    await loadStoredSession(storage),
    true,
  );
  if (
    !storedSession
    || storedSession.pendingMutation
    || !sameNativeSessionAuthority(storedSession, activeSession)
    || bindingGeneration < storedSession.bindingGeneration
    || tokenGeneration < storedSession.tokenGeneration
  ) {
    throw new NativeAuthError(
      'NATIVE_GENERATION_UPDATE_INVALID',
      'Native installation generations did not match the active session.',
    );
  }

  const updatedSession: NativeAuthSession = {
    ...activeSession,
    bindingGeneration,
    tokenGeneration,
  };
  try {
    await storage.set(NATIVE_AUTH_SESSION_STORAGE_KEY, JSON.stringify(toStoredSession(updatedSession)));
  } catch (error) {
    try {
      await purgeNativeSessionAfterGenerationPublicationFailure(storage);
    } catch (purgeError) {
      throw aggregateNativeCleanupFailure(
        'NATIVE_GENERATION_PERSIST_FAILED',
        'Native installation generations could not be persisted or safely purged.',
        [error, purgeError],
      );
    }
    throw asNativeAuthError(
      error,
      'NATIVE_GENERATION_PERSIST_FAILED',
      'Native installation generations could not be persisted.',
    );
  }

  if (
    sessionPublicationBlockedByMutation
    || currentSession?.sessionId !== sessionId
    || expectedTransitionGeneration !== sessionTransitionGeneration
  ) {
    throw new NativeAuthError(
      'NATIVE_GENERATION_UPDATE_STALE',
      'Native installation generations became stale before publication.',
    );
  }
  currentSession = updatedSession;
}

export async function startNativeOAuthLogin(
  provider: NativeOAuthProvider,
  redirectTo?: string,
): Promise<void> {
  const platform = requireNativePlatform();
  const storage = await requireSecureStorage();
  await recoverNativeAuthCorruptSession();
  await requireUncorruptedStoredSession(storage, await loadStoredSession(storage));
  await requireNoPrivacyBarrierFailure(storage);
  requireNativeSessionPublicationOpen();

  await settleExistingNativeSession(storage);

  const state = createOpaqueValue();
  const nonce = createOpaqueValue();
  const codeVerifier = createOpaqueValue();
  const codeChallenge = await createCodeChallenge(codeVerifier);
  const transactionResponse = await authApi.post<NativeAuthTransactionResponse>(
    '/v1/native-auth/transactions',
    {
      provider,
      platform,
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    },
    { headers: nativeMutationHeaders() },
  );
  const transaction = validateTransactionResponse(transactionResponse.data, provider);
  const transient: NativeAuthTransient = {
    version: 1,
    transactionId: transaction.transaction_id,
    provider,
    state,
    nonce,
    codeVerifier,
    exchangeIdempotencyKey: createIdempotencyKey(),
    redirectTo: safeRedirectTo(redirectTo),
  };

  await saveTransient(storage, transient);
  try {
    await Browser.open({
      url: transaction.authorization_url,
      presentationStyle: platform === 'ios' ? 'fullscreen' : 'popover',
    });
  } catch (error) {
    await removeTransient(storage);
    throw asNativeAuthError(error, 'BROWSER_OPEN_FAILED', 'Unable to open the provider authorization page.');
  }
}

/**
 * Registers a single Capacitor listener lazily. App startup should call this from
 * a global native-only boundary so a cold-launch universal link is not missed.
 */
export function subscribeToNativeAuthCallbacks(
  onSuccess: (result: NativeAuthCallbackResult) => void,
  onError?: (error: Error) => void,
): () => void {
  const subscriber: NativeAuthCallbackSubscriber = { onSuccess, onError };
  callbackSubscribers.add(subscriber);
  void ensureAppUrlListener().catch((error) => notifyCallbackError(asError(error)));

  return () => {
    callbackSubscribers.delete(subscriber);
    if (callbackSubscribers.size === 0 && appUrlListener) {
      const listener = appUrlListener;
      appUrlListener = null;
      void listener.remove();
    }
  };
}

export function refreshNativeAuthSession(): Promise<string | null> {
  if (!isNativeAuthPlatform()) {
    return Promise.resolve(null);
  }
  if (!nativeRefreshPromise) {
    const transitionGeneration = sessionTransitionGeneration;
    const task = refreshNativeAuthSessionOnce(transitionGeneration);
    const shared = task.finally(() => {
      if (nativeRefreshPromise === shared) {
        nativeRefreshPromise = null;
      }
    });
    nativeRefreshPromise = shared;
  }
  return nativeRefreshPromise;
}
/**
 * Recovers an exact durable corrupt-session mutation owner. A newly observed
 * corrupt session may establish that owner once; restart recovery only continues
 * matching marker, audit, and native lineage evidence.
 */
export async function recoverNativeAuthCorruptSession(): Promise<boolean> {
  const storage = await requireSecureStorage();
  return enqueueSecureSessionCommit(() => recoverNativeAuthCorruptSessionOnce(storage));
}
export type NativeTerminalRecoveryPreparation =
  | 'recovered'
  | 'journal_pending'
  | 'credential_free'
  | 'blocked';

export async function prepareNativeTerminalRecovery(): Promise<NativeTerminalRecoveryPreparation> {
  const storage = await requireSecureStorage();
  if (await recoverNativeAuthCorruptSession()) {
    return 'recovered';
  }

  const storedSession = await requireUncorruptedStoredSession(
    storage,
    await loadStoredSession(storage),
  );
  const pendingMutation = storedSession?.pendingMutation ?? null;
  if (pendingMutation) {
    try {
      await resumePendingNativeMutation(storage, pendingMutation);
      return 'recovered';
    } catch {
      return 'journal_pending';
    }
  }
  if (storedSession) {
    return 'blocked';
  }

  const privacyFailure = await loadPrivacyBarrierFailure(storage);
  const corruptAudit = await loadNativeCorruptSessionAudit(storage);
  if (privacyFailure !== null || corruptAudit !== null) {
    return 'blocked';
  }

  const refreshToken = await storage.get(NATIVE_AUTH_REFRESH_STORAGE_KEY);
  const transient = await storage.get(NATIVE_AUTH_TRANSIENT_STORAGE_KEY);
  return refreshToken === null && transient === null
    ? 'credential_free'
    : 'blocked';
}

async function refreshNativeAuthSessionOnce(
  transitionGeneration: number,
): Promise<string | null> {

  const storage = await requireSecureStorage();
  await recoverNativeAuthCorruptSession();
  const storedSession = await requireUncorruptedStoredSession(
    storage,
    await loadStoredSession(storage),
  );
  const pendingMutation = storedSession?.pendingMutation ?? null;
  if (pendingMutation) {
    await resumePendingNativeMutation(storage, pendingMutation);
    return null;
  }
  await requireNoPrivacyBarrierFailure(storage);
  if (sessionPublicationBlockedByMutation) {
    return null;
  }
  const refreshToken = await storage.get(NATIVE_AUTH_REFRESH_STORAGE_KEY);
  if (!refreshToken) {
    return null;
  }

  const installationId = await getOrCreateInstallationId(nativeNotificationCoordinatorPlugin);
  const expectedBindingGeneration = currentSession?.bindingGeneration ?? storedSession?.bindingGeneration;
  if (!expectedBindingGeneration || storedSession?.installationId !== installationId) {
    await clearInvalidNativeSession(storage);
    return null;
  }
  if (transitionGeneration !== sessionTransitionGeneration) {
    return null;
  }

  try {
    const response = await authApi.post<NativeActiveSessionResponse>(
      '/v1/native-auth/refresh',
      {
        refresh_token: refreshToken,
        installation_id: installationId,
        expected_binding_generation: expectedBindingGeneration,
      },
      { headers: nativeMutationHeaders() },
    );
    if (transitionGeneration !== sessionTransitionGeneration) {
      return null;
    }
    const session = validateActiveSession(response.data, installationId);
    await stageNativeSession(storage, response.data, session, false, transitionGeneration);
    if (!(await completeStagedNativeAuthSession(session))) {
      throw new NativeAuthError(
        'NATIVE_BIND_FAILED',
        'Native session refresh could not be bound before publication.',
      );
    }
    return response.data.access_token;
  } catch (error) {
    if (responseStatus(error) === 401) {
      await clearInvalidNativeSession(storage);
      return null;
    }
    throw asNativeAuthError(error, 'NATIVE_REFRESH_FAILED', 'Unable to refresh the native session.');
  }
}

/**
 * The caller remains in logout_pending until the pre-server and post-server
 * native mutation receipts both prove zero visible/in-flight notification state.
 */
export async function logoutNativeAuthSession(
  reason: 'logout' | 'account_switch' = 'logout',
): Promise<void> {
  const accessToken = getAccessToken();
  const storage = await requireSecureStorage();
  const barrier = requireNotificationBarrier();

  if (!accessToken) {
    throw new NativeAuthError(
      'NATIVE_SESSION_CONTEXT_UNAVAILABLE',
      'Native logout requires an active native session context.',
    );
  }

  const { pendingMutation, session } = await savePendingNativeMutation(storage, reason);
  clearAccessToken();
  markLogoutPending();

  const beginRequestedMutation = await persistPendingNativeMutationPhase(
    storage,
    pendingMutation,
    'native_begin_pending',
  );
  const beginReceipt = requireZeroMutationReceipt(await barrier.beginAccountMutation(reason));
  const owner = nativeMutationOwner(reason, beginReceipt.display_epoch);
  const begunPendingMutation = await persistPendingNativeMutationDisplayEpoch(
    storage,
    beginRequestedMutation,
    owner.displayEpoch,
  );

  try {
    await requestNativeLogout(
      session.installationId,
      session.bindingGeneration,
      `Bearer ${accessToken}`,
      begunPendingMutation.idempotencyKey,
    );
    await persistPendingNativeMutationPhase(
      storage,
      begunPendingMutation,
      'server_acknowledged',
    );
  } catch (error) {
    try {
      await requirePendingNativeMutationReconciliation(storage, begunPendingMutation);
    } catch (reconciliationError) {
      throw aggregateNativeCleanupFailure(
        'NATIVE_LOGOUT_RECONCILIATION_PERSIST_FAILED',
        'Native logout could not persist its required server reconciliation state.',
        [error, reconciliationError],
      );
    }
    throw asNativeAuthError(error, 'NATIVE_LOGOUT_FAILED', 'Native logout was not acknowledged by the server.');
  }

  await finalizeNativeMutationOwner(barrier, owner);
  await clearNativeCredentials(storage, owner);
  clearAccessToken();
}

async function requestNativeLogout(
  installationId: string,
  bindingGeneration: number,
  authorizationBearer: string,
  idempotencyKey: string,
): Promise<void> {
  const response = await authApi.post<NativeLogoutAcknowledgement>(
    '/v1/native-auth/logout',
    {
      installation_id: installationId,
      expected_binding_generation: bindingGeneration,
    },
    {
      headers: {
        ...nativeContractHeaders(),
        'Idempotency-Key': idempotencyKey,
        Authorization: authorizationBearer,
      },
    },
  );
  requireNativeLogoutAcknowledgementStatus(response.status);
  validateNativeLogoutAcknowledgement(response.data, installationId, bindingGeneration);
}

async function requestNativeLogoutReconciliation(
  pendingMutation: NativePendingMutation,
  refreshToken: string,
): Promise<void> {
  const response = await authApi.post<NativeLogoutAcknowledgement>(
    '/v1/native-auth/logout/reconcile',
    {
      refresh_token: refreshToken,
      installation_id: pendingMutation.installationId,
      expected_binding_generation: pendingMutation.bindingGeneration,
    },
    {
      headers: {
        ...nativeContractHeaders(),
        'Idempotency-Key': pendingMutation.idempotencyKey,
      },
    },
  );
  requireNativeLogoutAcknowledgementStatus(response.status);
  validateNativeLogoutAcknowledgement(
    response.data,
    pendingMutation.installationId,
    pendingMutation.bindingGeneration,
  );
}

function requireNativeLogoutAcknowledgementStatus(status: number): void {
  if (status !== 200) {
    throw new NativeAuthError(
      'INVALID_LOGOUT_ACKNOWLEDGEMENT',
      'Native logout was not acknowledged.',
    );
  }
}
function validateNativeLogoutAcknowledgement(
  acknowledgement: unknown,
  installationId: string,
  expectedBindingGeneration: number,
): void {
  if (
    !hasExactOwnKeys(acknowledgement, [
      'installation_id',
      'binding_generation',
      'token_generation',
      'binding_state',
      'acknowledged_at_utc',
    ])
    || acknowledgement.installation_id !== installationId
    || acknowledgement.binding_generation !== expectedBindingGeneration + 1
    || !isPositiveInteger(acknowledgement.token_generation)
    || acknowledgement.binding_state !== 'unlinked'
    || !isDateTime(acknowledgement.acknowledged_at_utc)
  ) {
    throw new NativeAuthError(
      'INVALID_LOGOUT_ACKNOWLEDGEMENT',
      'Native logout was not acknowledged.',
    );
  }
}

/**
 * Finalizes the deletion mutation that began before the server request, then
 * clears local credentials only after native zero proof.
 */
export async function clearNativeAuthSessionAfterAccountDeletionAcknowledgement(
  callerDisplayEpoch: string,
): Promise<void> {
  await invalidateNativeAuthSessionForMutationOnCommitLane();
  clearAccessToken();
  markLogoutPending();

  const storage = await requireSecureStorage();
  const barrier = requireNotificationBarrier();
  if (!isCanonicalUint64String(callerDisplayEpoch)) {
    throw new NativeAuthError(
      'NOTIFICATION_BARRIER_FAILED',
      'Native deletion cleanup requires the matching begin receipt epoch.',
    );
  }
  const owner = nativeMutationOwner('deletion', callerDisplayEpoch);
  await finalizeNativeMutationOwner(barrier, owner);
  await clearNativeCredentials(storage, owner, { allowCorruptSessionReconciliation: true });
}

async function ensureAppUrlListener(): Promise<void> {
  if (!isNativeAuthPlatform()) {
    return;
  }
  if (appUrlListener) {
    return;
  }
  if (appUrlListenerSetup) {
    return appUrlListenerSetup;
  }

  appUrlListenerSetup = (async () => {
    try {
      appUrlListener = await App.addListener('appUrlOpen', (event) => {
        void dispatchNativeAuthCallback(event.url);
      });
      const launchUrl = await App.getLaunchUrl();
      if (launchUrl?.url) {
        await dispatchNativeAuthCallback(launchUrl.url);
      }
    } catch (error) {
      const listener = appUrlListener;
      appUrlListener = null;
      if (listener) {
        await listener.remove();
      }
      throw error;
    }
  })();

  try {
    await appUrlListenerSetup;
  } finally {
    appUrlListenerSetup = null;
  }
}

async function dispatchNativeAuthCallback(url: string): Promise<void> {
  try {
    const routed = await routeNativeAuthCallback(url);
    if (!routed) {
      return;
    }

    await Browser.close().catch(() => undefined);
    if (routed.kind === 'login') {
      if (!(await completeStagedNativeAuthSession(routed.result.session))) {
        throw new NativeAuthCallbackRouteError(
          'NATIVE_BIND_FAILED',
          'Native OAuth callback could not bind the exchanged session.',
          'login',
        );
      }
      callbackSubscribers.forEach((subscriber) => subscriber.onSuccess(routed.result));
    }
  } catch (error) {
    if (error instanceof NativeAuthCallbackRouteError && error.owner !== null) {
      await Browser.close().catch(() => undefined);
    }
    if (error instanceof NativeAuthCallbackRouteError && error.owner === 'login') {
      notifyCallbackError(error);
    }
  }
}

/**
 * All native callback entrypoints use this lane. A callback is accepted only when
 * exactly one durable owner has the callback state; owner-specific consumption is
 * persisted before any exchange can be retried.
 */
export function routeNativeAuthCallback(url: string): Promise<NativeAuthCallbackRouteResult | null> {
  return enqueueNativeCallback(() => routeNativeAuthCallbackOnce(url));
}

/**
 * The callback page may resume only a deletion exchange that was durably accepted
 * by the same callback router. It never parses or exchanges a second callback.
 */
export function resumeNativeDeletionAuthCallback(
  url: string,
): Promise<Extract<NativeAuthCallbackRouteResult, { readonly kind: 'deletion_capability' | 'deletion_rejected' }> | null> {
  return enqueueNativeCallback(async () => {
    const storage = await requireSecureStorage();
    const handoff = await loadNativeDeletionReauthHandoff(storage);
    if (!handoff) {
      return null;
    }
    if (handoff.kind === 'capability') {
      return {
        kind: 'deletion_capability',
        purpose: handoff.capability.purpose,
        requestId: handoff.capability.requestId,
      };
    }
    if (handoff.kind === 'exchange_pending') {
      return exchangeNativeDeletionCallback(storage, handoff.transient, handoff.exchangeCode);
    }

    const routed = await routeNativeAuthCallbackOnce(url, storage);
    return routed?.kind === 'login' ? null : routed;
  });
}

async function routeNativeAuthCallbackOnce(
  url: string,
  storage?: NativeAuthSecureStorageAdapter,
): Promise<NativeAuthCallbackRouteResult | null> {
  storage ??= await requireSecureStorage();
  let callback: ParsedNativeCallback | null;
  try {
    callback = parseNativeAuthCallback(url);
  } catch (error) {
    throw new NativeAuthCallbackRouteError(
      'INVALID_NATIVE_CALLBACK',
      asError(error).message,
      null,
    );
  }
  if (!callback) {
    return null;
  }

  const [loginTransient, deletionHandoff] = await Promise.all([
    loadTransient(storage),
    loadNativeDeletionReauthHandoff(storage),
  ]);
  const deletionTransient = deletionHandoff?.kind === 'transient'
    ? deletionHandoff.transient
    : null;
  const loginOwnsCallback = loginTransient?.state === callback.state;
  const deletionOwnsCallback = deletionTransient?.state === callback.state;

  if (Number(loginOwnsCallback) + Number(deletionOwnsCallback) !== 1) {
    throw new NativeAuthCallbackRouteError(
      'NATIVE_CALLBACK_OWNER_INVALID',
      'The native authorization callback did not have exactly one pending owner.',
      null,
    );
  }

  if (loginOwnsCallback && loginTransient) {
    await recoverNativeAuthCorruptSession();
    await requireUncorruptedStoredSession(storage, await loadStoredSession(storage));
    await requireNoPrivacyBarrierFailure(storage);
    if (callback.kind === 'error') {
      await removeTransient(storage);
      throw new NativeAuthCallbackRouteError(
        'PROVIDER_DENIED',
        callback.errorDescription || callback.error || 'The provider denied authorization.',
        'login',
      );
    }
    return {
      kind: 'login',
      result: await exchangeNativeLoginCallback(storage, loginTransient, callback),
    };
  }

  if (!deletionTransient) {
    throw new NativeAuthCallbackRouteError(
      'NATIVE_CALLBACK_OWNER_INVALID',
      'The native deletion callback did not have a pending reauthentication handoff.',
      null,
    );
  }
  if (callback.kind === 'error') {
    await storage.remove(DELETION_NATIVE_REAUTH_HANDOFF_STORAGE_KEY);
    return { kind: 'deletion_rejected', purpose: deletionTransient.purpose };
  }
  if (!callback.code) {
    throw new NativeAuthCallbackRouteError(
      'INVALID_CALLBACK_PAYLOAD',
      'The native deletion callback did not contain an exchange code.',
      'deletion',
    );
  }

  await storage.set(
    DELETION_NATIVE_REAUTH_HANDOFF_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      kind: 'exchange_pending',
      transient: deletionTransient,
      exchangeCode: callback.code,
    }),
  );
  return exchangeNativeDeletionCallback(storage, deletionTransient, callback.code);
}

async function exchangeNativeLoginCallback(
  storage: NativeAuthSecureStorageAdapter,
  transient: NativeAuthTransient,
  callback: ParsedNativeCallback,
): Promise<NativeAuthCallbackResult> {
  if (callback.kind !== 'code' || !callback.code) {
    throw new NativeAuthCallbackRouteError(
      'INVALID_CALLBACK_PAYLOAD',
      'The native authorization callback did not contain an exchange code.',
      'login',
    );
  }

  const installationId = await getOrCreateInstallationId(nativeNotificationCoordinatorPlugin);
  try {
    const response = await authApi.post<NativeActiveSessionResponse | NativeDeletionCapabilityResponse>(
      '/v1/native-auth/exchange',
      {
        exchange_code: callback.code,
        state: transient.state,
        code_verifier: transient.codeVerifier,
        installation_id: installationId,
      },
      {
        headers: {
          ...nativeMutationHeaders(),
          'Idempotency-Key': transient.exchangeIdempotencyKey,
        },
      },
    );

    if (isDeletionCapabilityResponse(response.data)) {
      await removeTransient(storage);
      throw new NativeAuthCallbackRouteError(
        'DELETION_CAPABILITY_RECEIVED',
        'This account cannot create an active native session.',
        'login',
      );
    }

    const session = validateActiveSession(response.data, installationId);
    await stageNativeSession(storage, response.data, session, true);
    return { redirectTo: transient.redirectTo, session };
  } catch (error) {
    if (isPermanentExchangeFailure(error)) {
      await removeTransient(storage);
    }
    if (error instanceof NativeAuthCallbackRouteError) {
      throw error;
    }
    throw new NativeAuthCallbackRouteError(
      'NATIVE_EXCHANGE_FAILED',
      asError(error).message,
      'login',
    );
  }
}

async function exchangeNativeDeletionCallback(
  storage: NativeAuthSecureStorageAdapter,
  transient: DeletionReauthTransient,
  exchangeCode: string,
): Promise<Extract<NativeAuthCallbackRouteResult, { readonly kind: 'deletion_capability' }>> {
  try {
    const response = await authApi.post<unknown>(
      '/v1/native-auth/exchange',
      {
        exchange_code: exchangeCode,
        state: transient.state,
        code_verifier: transient.codeVerifier,
        installation_id: await getOrCreateInstallationId(nativeNotificationCoordinatorPlugin),
      },
      {
        headers: {
          ...nativeContractHeaders(),
          'Idempotency-Key': transient.exchangeIdempotencyKey,
        },
      },
    );
    const capability = parseDeletionCapabilityResponse(
      response.data,
      transient,
      Date.now(),
      await expectedDeletionOperationForTransient(storage, transient),
    );
    await storage.set(
      DELETION_NATIVE_REAUTH_HANDOFF_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        kind: 'capability',
        capability: {
          version: 1,
          requestId: capability.request_id,
          purpose: capability.purpose,
          value: capability.deletion_capability,
          expiresAtUtc: capability.expires_at_utc,
        },
      }),
    );
    return {
      kind: 'deletion_capability',
      purpose: capability.purpose,
      requestId: capability.request_id,
    };
  } catch (error) {
    throw new NativeAuthCallbackRouteError(
      'NATIVE_DELETION_EXCHANGE_FAILED',
      asError(error).message,
      'deletion',
    );
  }
}

async function expectedDeletionOperationForTransient(
  storage: NativeAuthSecureStorageAdapter,
  transient: DeletionReauthTransient,
): Promise<DeletionOperation | undefined> {
  if (transient.purpose !== 'request') {
    return undefined;
  }
  const record = parseStoredDeletionOperationRecord(
    await storage.get(DELETION_OPERATION_STORAGE_KEY),
  );
  if (record.kind !== 'valid') {
    throw new NativeAuthCallbackRouteError(
      'INVALID_DELETION_REQUEST_SCOPE',
      'The native deletion callback did not match a durable request scope.',
      'deletion',
    );
  }
  return record.value;
}

async function loadNativeDeletionReauthHandoff(
  storage: NativeAuthSecureStorageAdapter,
) {
  const value = await storage.get(DELETION_NATIVE_REAUTH_HANDOFF_STORAGE_KEY);
  if (value === null) {
    return null;
  }
  try {
    const handoff = parseNativeDeletionReauthHandoff(JSON.parse(value) as unknown);
    if (handoff) {
      return handoff;
    }
  } catch {
    // The malformed journal remains durable evidence and keeps callback routing closed.
  }
  throw new NativeAuthCallbackRouteError(
    'INVALID_DELETION_REAUTH_HANDOFF',
    'The native deletion reauthentication handoff was invalid.',
    'deletion',
  );
}

async function settleExistingNativeSession(storage: NativeAuthSecureStorageAdapter): Promise<void> {
  let storedSession = await requireUncorruptedStoredSession(
    storage,
    await loadStoredSession(storage),
  );
  const pendingMutation = storedSession?.pendingMutation ?? null;
  if (pendingMutation) {
    await resumePendingNativeMutation(storage, pendingMutation);
  }

  let storedRefreshToken = await storage.get(NATIVE_AUTH_REFRESH_STORAGE_KEY);
  if (storedRefreshToken) {
    const recoveredAccessToken = await refreshNativeAuthSession();
    storedRefreshToken = await storage.get(NATIVE_AUTH_REFRESH_STORAGE_KEY);
    storedSession = await requireUncorruptedStoredSession(
      storage,
      await loadStoredSession(storage),
    );
    if (storedRefreshToken && (!recoveredAccessToken || !currentSession)) {
      throw new NativeAuthError(
        'NATIVE_ACCOUNT_RECOVERY_REQUIRED',
        'Existing native account recovery must complete before another OAuth login can start.',
      );
    }
  }

  if (!storedRefreshToken && (currentSession || storedSession) && (!currentSession || !hasAccessToken())) {
    await clearInvalidNativeSession(storage);
  }

  if (!hasAccessToken()) {
    return;
  }
  if (!currentSession) {
    throw new NativeAuthError(
      'NATIVE_SESSION_CONTEXT_UNAVAILABLE',
      'A native account switch requires a verified native session context.',
    );
  }

  await logoutNativeAuthSession('account_switch');
}

async function requireSecureStorage(): Promise<NativeAuthSecureStorageAdapter> {
  if (!secureStorage || !(await secureStorage.isAvailable())) {
    throw new NativeAuthError(
      'SECURE_STORAGE_UNAVAILABLE',
      'Native OAuth requires a Keychain/Keystore secure storage adapter.',
    );
  }
  return secureStorage;
}

function requireNativePlatform(): NativeAuthPlatform {
  const platform = readValidatedNativeReleaseManifest().platform;
  if (platform !== 'ios' && platform !== 'android') {
    throw new NativeAuthError('NATIVE_PLATFORM_REQUIRED', 'Native OAuth is not available on this platform.');
  }
  return platform;
}

function nativeContractHeaders(): Record<string, string> {
  return {
    'X-ZeroTime-Contract': MOBILE_RELEASE_CONTRACT,
  };
}

function nativeMutationHeaders(): Record<string, string> {
  return {
    ...nativeContractHeaders(),
    'Idempotency-Key': createIdempotencyKey(),
  };
}

function validateTransactionResponse(
  response: NativeAuthTransactionResponse,
  provider: NativeOAuthProvider,
): NativeAuthTransactionResponse {
  if (
    !isUuid(response.transaction_id) ||
    response.provider !== provider ||
    response.purpose !== 'login' ||
    !isHttpsUrl(response.authorization_url) ||
    !isDateTime(response.expires_at_utc)
  ) {
    throw new NativeAuthError('INVALID_TRANSACTION_RESPONSE', 'The native authorization transaction was invalid.');
  }
  return response;
}

function validateActiveSession(
  response: NativeActiveSessionResponse,
  installationId: string,
): NativeAuthSession {
  const installation = response.installation;
  if (
    !isNonEmptyString(response.access_token) ||
    !isNonEmptyString(response.refresh_token) ||
    response.token_type !== 'Bearer' ||
    !isUuid(response.session_id) ||
    !isPositiveInteger(response.auth_version) ||
    !installation ||
    installation.installation_id !== installationId ||
    installation.binding_state !== 'bound' ||
    !isPositiveInteger(installation.binding_generation) ||
    !isNonNegativeInteger(installation.token_generation)
  ) {
    throw new NativeAuthError('INVALID_NATIVE_SESSION', 'The native session response was invalid.');
  }

  return {
    sessionId: response.session_id,
    authVersion: response.auth_version,
    installationId: installation.installation_id,
    bindingGeneration: installation.binding_generation,
    tokenGeneration: installation.token_generation,
    authorizationBearer: `Bearer ${response.access_token}`,
  };
}

function isDeletionCapabilityResponse(
  response: NativeActiveSessionResponse | NativeDeletionCapabilityResponse,
): response is NativeDeletionCapabilityResponse {
  return 'result_type' in response && response.result_type === 'deletion_capability';
}

function parseNativeAuthCallback(urlString: string): ParsedNativeCallback | null {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return null;
  }

  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'zerotime.kr' ||
    url.port ||
    url.pathname !== NATIVE_AUTH_CALLBACK_PATH ||
    url.username ||
    url.password ||
    url.hash
  ) {
    return null;
  }

  const allowedParameters = new Set(['code', 'state', 'error', 'error_description']);
  for (const key of url.searchParams.keys()) {
    if (!allowedParameters.has(key)) {
      throw new NativeAuthError('INVALID_CALLBACK_PARAMETERS', 'The native callback included an unsupported parameter.');
    }
  }

  const states = url.searchParams.getAll('state');
  const codes = url.searchParams.getAll('code');
  const errors = url.searchParams.getAll('error');
  const descriptions = url.searchParams.getAll('error_description');
  if (states.length !== 1 || !isOpaqueValue(states[0]) || descriptions.length > 1) {
    throw new NativeAuthError('INVALID_CALLBACK_STATE', 'The native callback state was invalid.');
  }
  if (codes.length === 1 && errors.length === 0 && isExchangeCode(codes[0])) {
    return { kind: 'code', state: states[0], code: codes[0] };
  }
  if (errors.length === 1 && codes.length === 0 && isNonEmptyString(errors[0])) {
    return {
      kind: 'error',
      state: states[0],
      error: errors[0],
      errorDescription: descriptions[0],
    };
  }

  throw new NativeAuthError('INVALID_CALLBACK_PAYLOAD', 'The native callback did not contain a valid result.');
}

async function stageNativeSession(
  storage: NativeAuthSecureStorageAdapter,
  response: NativeActiveSessionResponse,
  session: NativeAuthSession,
  clearPendingTransaction = false,
  transitionGeneration = sessionTransitionGeneration,
): Promise<void> {
  if (stagedSession) {
    throw new NativeAuthError(
      'NATIVE_SESSION_BIND_IN_PROGRESS',
      'A native session is already waiting for binding.',
    );
  }

  stagedSession = {
    storage,
    response,
    session,
    clearPendingTransaction,
    transitionGeneration,
  };
}

function requireCurrentStagedNativeSession(staged: StagedNativeSession): void {
  if (
    stagedSession !== staged
    || sessionPublicationBlockedByMutation
    || staged.transitionGeneration !== sessionTransitionGeneration
  ) {
    throw new NativeAuthError(
      'NATIVE_BIND_STALE',
      'Native session publication became stale before credentials were stored.',
    );
  }
}

async function commitStagedNativeAuthSession(session: NativeAuthSession): Promise<boolean> {
  const staged = stagedSession;
  if (!staged || !sameNativeSession(staged.session, session)) {
    throw new NativeAuthError(
      'NATIVE_STAGED_SESSION_MISSING',
      'No matching native session is staged for binding.',
    );
  }
  if (
    sessionPublicationBlockedByMutation
    || staged.transitionGeneration !== sessionTransitionGeneration
  ) {
    stagedSession = null;
    return false;
  }
  const storedSession = await requireUncorruptedStoredSession(
    staged.storage,
    await loadStoredSession(staged.storage),
    true,
  );
  if (!canPublishStagedNativeSession(storedSession, staged.session)) {
    stagedSession = null;
    return false;
  }

  const binder = sessionBinder;
  if (!binder) {
    await failStagedNativeSession(staged);
    throw new NativeAuthError(
      'NATIVE_BINDER_UNAVAILABLE',
      'Native session publication is blocked until the coordinator binder is ready.',
    );
  }

  let bindResult: NativeAuthSessionBindResult = 'failed';
  try {
    bindResult = await binder.bindSession(staged.session);
  } catch {
    bindResult = 'failed';
  }
  if (
    staged.transitionGeneration !== sessionTransitionGeneration
    || bindResult !== 'bound'
  ) {
    if (bindResult === 'blocked') {
      stagedSession = null;
      return false;
    }
    await failStagedNativeSession(staged, true);
    return false;
  }
  const currentStoredSession = await requireUncorruptedStoredSession(
    staged.storage,
    await loadStoredSession(staged.storage),
    true,
  );
  if (!canPublishStagedNativeSession(currentStoredSession, staged.session)) {
    stagedSession = null;
    return false;
  }
  try {
    requireCurrentStagedNativeSession(staged);
    await staged.storage.set(NATIVE_AUTH_REFRESH_STORAGE_KEY, staged.response.refresh_token);
    requireCurrentStagedNativeSession(staged);
    await staged.storage.set(NATIVE_AUTH_SESSION_STORAGE_KEY, JSON.stringify(toStoredSession(staged.session)));
    requireCurrentStagedNativeSession(staged);
    if (staged.clearPendingTransaction) {
      await removeTransient(staged.storage);
      requireCurrentStagedNativeSession(staged);
    }
    currentSession = staged.session;
    setAccessToken(staged.response.access_token, { persistSessionHint: false });
    stagedSession = null;
    return true;
  } catch (error) {
    try {
      await failStagedNativeSession(staged, true);
    } catch (purgeError) {
      throw aggregateNativeCleanupFailure(
        'NATIVE_POST_BIND_PURGE_FAILED',
        'Native session publication failed and the possible native bind could not be safely quarantined.',
        [error, purgeError],
      );
    }
    throw error;
  }
}

async function purgeNativeSessionAfterGenerationPublicationFailure(
  storage: NativeAuthSecureStorageAdapter,
): Promise<void> {
  invalidateNativeAuthSessionForMutation();
  clearAccessToken();
  await quarantinePossiblyBoundNativeSession(
    storage,
    'NATIVE_GENERATION_PURGE_FAILED',
    'Native notification purge could not prove zero state after generation publication failed.',
  );
}

async function failStagedNativeSession(
  staged: StagedNativeSession,
  possiblyBoundNativeSession = false,
): Promise<void> {
  if (possiblyBoundNativeSession) {
    invalidateNativeAuthSessionForMutation();
    clearAccessToken();
    await quarantinePossiblyBoundNativeSession(
      staged.storage,
      'NATIVE_POST_BIND_PURGE_FAILED',
      'Native notification purge could not prove zero state after a native bind was attempted.',
    );
    return;
  }

  stagedSession = null;
  currentSession = null;
  clearAccessToken();
  await quarantineUnboundStagedCredentials(staged.storage);
}

async function quarantinePossiblyBoundNativeSession(
  storage: NativeAuthSecureStorageAdapter,
  code: string,
  message: string,
): Promise<void> {
  const cleanupErrors: unknown[] = [];
  let owner: NativeMutationOwner | null = null;

  try {
    const barrier = requireNotificationBarrier();
    const beginReceipt = requireZeroMutationReceipt(
      await barrier.beginAccountMutation('account_switch'),
    );
    owner = nativeMutationOwner('account_switch', beginReceipt.display_epoch);
  } catch (error) {
    cleanupErrors.push(error);
  }

  try {
    await markPrivacyBarrierFailure(storage, owner);
  } catch (error) {
    cleanupErrors.push(error);
  }

  throw aggregateNativeCleanupFailure(code, message, cleanupErrors);
}

async function quarantineUnboundStagedCredentials(
  storage: NativeAuthSecureStorageAdapter,
): Promise<void> {
  try {
    await markPrivacyBarrierFailure(storage, null);
  } catch (error) {
    throw aggregateNativeCleanupFailure(
      'NATIVE_STAGED_CREDENTIAL_CLEANUP_FAILED',
      'Native staged credential cleanup could not persist durable privacy recovery.',
      [error],
    );
  }

  const cleanupErrors = await removeNativeSessionCredentials(storage, [
    NATIVE_AUTH_REFRESH_STORAGE_KEY,
    NATIVE_AUTH_SESSION_STORAGE_KEY,
  ], { preservePendingMutation: true });
  if (cleanupErrors.length > 0) {
    throw aggregateNativeCleanupFailure(
      'NATIVE_STAGED_CREDENTIAL_CLEANUP_FAILED',
      'Native staged credentials could not be cleared.',
      cleanupErrors,
    );
  }
}

async function clearNativeCredentials(
  storage: NativeAuthSecureStorageAdapter,
  owner: NativeMutationOwner,
  options: {
    readonly allowCorruptSessionReconciliation?: boolean;
    readonly corruptSessionRecovery?: boolean;
  } = {},
): Promise<void> {
  return enqueueSecureSessionCommit(() => clearNativeCredentialsOnce(storage, owner, options));
}

async function clearNativeCredentialsOnce(
  storage: NativeAuthSecureStorageAdapter,
  owner: NativeMutationOwner,
  options: {
    readonly allowCorruptSessionReconciliation?: boolean;
    readonly corruptSessionRecovery?: boolean;
  },
): Promise<void> {
  if (!options.allowCorruptSessionReconciliation) {
    const storedSessionState = await loadStoredSession(storage);
    if (storedSessionState.kind === 'corrupt') {
      await closeNativeAuthForCorruptStoredSession(storage, storedSessionState.value, true);
      throw new NativeAuthError(
        'NATIVE_SECURE_SESSION_CORRUPT',
        'Native secure session state is corrupt and requires server installation reconciliation.',
      );
    }
  }

  await markPrivacyBarrierFailure(
    storage,
    owner,
    options.corruptSessionRecovery ? { corruptSession: true } : {},
  );
  const cleanupKeys = [
    NATIVE_AUTH_REFRESH_STORAGE_KEY,
    NATIVE_AUTH_SESSION_STORAGE_KEY,
    NATIVE_AUTH_TRANSIENT_STORAGE_KEY,
    ...(options.corruptSessionRecovery
      ? []
      : [NATIVE_AUTH_CORRUPT_SESSION_AUDIT_STORAGE_KEY]),
  ];
  const cleanupErrors = await removeNativeSessionCredentials(
    storage,
    cleanupKeys,
    options,
  );
  if (cleanupErrors.length > 0) {
    throw aggregateNativeCleanupFailure(
      'NATIVE_CREDENTIAL_CLEANUP_FAILED',
      'Native credentials could not be fully cleared.',
      cleanupErrors,
    );
  }

  try {
    await storage.remove(NATIVE_AUTH_PRIVACY_BARRIER_FAILED_STORAGE_KEY);
  } catch (error) {
    privacyBarrierFailed = true;
    throw aggregateNativeCleanupFailure(
      'NATIVE_CREDENTIAL_CLEANUP_FAILED',
      'Native credentials were cleared but durable privacy recovery could not be finalized.',
      [error],
    );
  }
  if (options.corruptSessionRecovery) {
    try {
      await storage.remove(NATIVE_AUTH_CORRUPT_SESSION_AUDIT_STORAGE_KEY);
    } catch (error) {
      privacyBarrierFailed = true;
      throw aggregateNativeCleanupFailure(
        'NATIVE_CREDENTIAL_CLEANUP_FAILED',
        'Native privacy marker was cleared but corrupt-session audit cleanup remains pending.',
        [error],
      );
    }
  }

  stagedSession = null;
  currentSession = null;
  privacyBarrierFailed = false;
  sessionPublicationBlockedByMutation = false;
}

async function removeNativeSessionCredentials(
  storage: NativeAuthSecureStorageAdapter,
  keys: readonly string[],
  options: {
    readonly allowCorruptSessionReconciliation?: boolean;
    readonly preservePendingMutation?: boolean;
  } = {},
): Promise<unknown[]> {
  if (!options.allowCorruptSessionReconciliation) {
    const storedSessionState = await loadStoredSession(storage);
    if (storedSessionState.kind === 'corrupt') {
      return [new NativeAuthError(
        'NATIVE_SECURE_SESSION_CORRUPT',
        'Native secure session state is corrupt and requires server installation reconciliation.',
      )];
    }
    if (
      options.preservePendingMutation
      && storedSessionState.kind === 'valid'
      && storedSessionState.session.pendingMutation
    ) {
      return [];
    }
  }


  const cleanupErrors: unknown[] = [];
  for (const key of keys) {
    try {
      await storage.remove(key);
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  return cleanupErrors;
}

async function clearInvalidNativeSession(storage: NativeAuthSecureStorageAdapter): Promise<void> {
  await requireUncorruptedStoredSession(storage, await loadStoredSession(storage));
  await invalidateNativeAuthSessionForMutationOnCommitLane();
  clearAccessToken();
  const barrier = notificationBarrier;
  if (!barrier) {
    try {
      await markPrivacyBarrierFailure(storage, null);
    } catch (markerError) {
      throw aggregateNativeCleanupFailure(
        'NOTIFICATION_BARRIER_UNAVAILABLE',
        'Invalid native-session cleanup could not persist durable privacy recovery.',
        [markerError],
      );
    }
    throw new NativeAuthError(
      'NOTIFICATION_BARRIER_UNAVAILABLE',
      'Invalid native-session cleanup is blocked until the notification barrier is available.',
    );
  }

  let owner: NativeMutationOwner | null = null;
  try {
    const beginReceipt = requireZeroMutationReceipt(
      await barrier.beginAccountMutation('logout'),
    );
    owner = nativeMutationOwner('logout', beginReceipt.display_epoch);
  } catch (error) {
    try {
      await markPrivacyBarrierFailure(storage, owner);
    } catch (markerError) {
      throw aggregateNativeCleanupFailure(
        'NOTIFICATION_BARRIER_FAILED',
        'Invalid native-session cleanup could not prove zero state or persist durable privacy recovery.',
        [error, markerError],
      );
    }
    throw asNativeAuthError(
      error,
      'NOTIFICATION_BARRIER_FAILED',
      'Invalid native-session cleanup could not prove local notification zero state.',
    );
  }

  await markPrivacyBarrierFailure(storage, owner);
  throw new NativeAuthError(
    'NATIVE_SESSION_SERVER_RECONCILIATION_REQUIRED',
    'Invalid native-session cleanup closed local admission until server reconciliation is durable.',
  );
}
async function resumePendingNativeMutation(
  storage: NativeAuthSecureStorageAdapter,
  pendingMutation: NativePendingMutation,
): Promise<void> {
  await invalidateNativeAuthSessionForMutationOnCommitLane();
  clearAccessToken();
  markLogoutPending();

  try {
    const barrier = requireNotificationBarrier();
    const storedSession = await requireUncorruptedStoredSession(
      storage,
      await loadStoredSession(storage),
    );
    if (
      !storedSession
      || !storedSession.pendingMutation
      || !samePendingNativeMutation(storedSession.pendingMutation, pendingMutation)
      || storedSession.sessionId !== pendingMutation.sessionId
      || storedSession.installationId !== pendingMutation.installationId
      || storedSession.bindingGeneration !== pendingMutation.bindingGeneration
    ) {
      throw new NativeAuthError(
        'NATIVE_PENDING_MUTATION_CONTEXT_UNAVAILABLE',
        'Native logout recovery requires the original secure session context.',
      );
    }

    const recovered = await recoverPendingNativeMutationOwner(
      storage,
      barrier,
      storedSession.pendingMutation,
    );
    let acknowledgedMutation = recovered.pendingMutation;
    if (nativePendingMutationPhase(acknowledgedMutation) === 'server_acknowledged') {
      await finalizeNativeMutationOwner(barrier, recovered.owner);
      await clearNativeCredentials(storage, recovered.owner);
      clearAccessToken();
      return;
    }
    if (recovered.lineage.phase !== 'awaiting_finalize') {
      throw new NativeAuthError(
        'NATIVE_PENDING_MUTATION_LINEAGE_MISMATCH',
        'Native logout recovery cannot reconcile a completed mutation before server acknowledgement.',
      );
    }

    try {
      const refreshToken = await storage.get(NATIVE_AUTH_REFRESH_STORAGE_KEY);
      if (!refreshToken) {
        throw new NativeAuthError(
          'NATIVE_PENDING_MUTATION_CONTEXT_UNAVAILABLE',
          'Native logout recovery requires the original secure session context.',
        );
      }

      let refreshReplayRequired =
        nativePendingMutationPhase(acknowledgedMutation) === 'refresh_recovery_pending';
      if (!refreshReplayRequired) {
        try {
          await requestNativeLogoutReconciliation(acknowledgedMutation, refreshToken);
        } catch (error) {
          if (!isDefinitiveLogoutNotAcknowledged(error)) {
            throw error;
          }
          const refreshRecoveryIdempotencyKey =
            acknowledgedMutation.refreshRecoveryIdempotencyKey ?? createIdempotencyKey();
          if (!isUuid(refreshRecoveryIdempotencyKey)) {
            throw new NativeAuthError(
              'NATIVE_REFRESH_RECOVERY_IDEMPOTENCY_INVALID',
              'Native logout recovery could not create a stable refresh recovery identity.',
            );
          }
          acknowledgedMutation = await persistRefreshRecoveryIdempotencyKey(
            storage,
            acknowledgedMutation,
            refreshRecoveryIdempotencyKey,
          );
          refreshReplayRequired = true;
        }
      }

      if (refreshReplayRequired) {
        const session = await replayNativeRefreshRecovery(
          acknowledgedMutation,
          refreshToken,
        );
        await persistRotatedPendingMutationRefresh(
          storage,
          acknowledgedMutation,
          session,
        );
        await requestNativeLogout(
          session.installationId,
          session.bindingGeneration,
          session.authorizationBearer,
          acknowledgedMutation.idempotencyKey,
        );
      }
      acknowledgedMutation = await persistPendingNativeMutationPhase(
        storage,
        acknowledgedMutation,
        'server_acknowledged',
      );
    } catch (error) {
      try {
        await requirePendingNativeMutationReconciliation(storage, acknowledgedMutation);
      } catch (reconciliationError) {
        throw aggregateNativeCleanupFailure(
          'NATIVE_PENDING_MUTATION_RECONCILIATION_PERSIST_FAILED',
          'Native logout recovery could not persist its required server reconciliation state.',
          [error, reconciliationError],
        );
      }
      throw error;
    }

    await finalizeNativeMutationOwner(barrier, recovered.owner);
    await clearNativeCredentials(storage, recovered.owner);
    clearAccessToken();
  } catch (error) {
    throw asNativeAuthError(
      error,
      'NATIVE_PENDING_MUTATION_RECOVERY_FAILED',
      'Native logout recovery remains pending until the original account can be reconciled.',
    );
  }
}
async function replayNativeRefreshRecovery(
  pendingMutation: NativePendingMutation,
  refreshToken: string,
): Promise<NativeAuthSession> {
  const refreshRecoveryIdempotencyKey = pendingMutation.refreshRecoveryIdempotencyKey;
  if (
    pendingMutation.version !== 4
    || nativePendingMutationPhase(pendingMutation) !== 'refresh_recovery_pending'
    || !isCanonicalUint64String(pendingMutation.displayEpoch)
    || !isUuid(refreshRecoveryIdempotencyKey)
  ) {
    throw new NativeAuthError(
      'NATIVE_REFRESH_RECOVERY_CONTEXT_INVALID',
      'Native logout recovery could not replay its exact refresh recovery context.',
    );
  }

  const response = await authApi.post<NativeActiveSessionResponse>(
    '/v1/native-auth/refresh',
    {
      refresh_token: refreshToken,
      installation_id: pendingMutation.installationId,
      expected_binding_generation: pendingMutation.bindingGeneration,
    },
    {
      headers: {
        ...nativeContractHeaders(),
        'Idempotency-Key': refreshRecoveryIdempotencyKey,
      },
    },
  );
  const session = validateActiveSession(response.data, pendingMutation.installationId);
  if (
    session.sessionId !== pendingMutation.sessionId
    || session.bindingGeneration !== pendingMutation.bindingGeneration
  ) {
    throw new NativeAuthError(
      'NATIVE_REFRESH_RECOVERY_CONTEXT_INVALID',
      'Native logout recovery did not restore its exact refresh recovery session.',
    );
  }
  return session;
}

async function recoverPendingNativeMutationOwner(
  storage: NativeAuthSecureStorageAdapter,
  barrier: NativeAuthNotificationBarrier,
  pendingMutation: NativePendingMutation,
): Promise<{
  readonly owner: NativeMutationOwner;
  readonly lineage: NativeAccountMutationLineage;
  readonly pendingMutation: NativePendingMutation;
}> {
  if (pendingMutation.version !== 4) {
    throw new NativeAuthError(
      'NATIVE_PENDING_MUTATION_EPOCH_UNAVAILABLE',
      'Native logout recovery requires the exact persisted native mutation epoch.',
    );
  }

  let recoveryMutation = pendingMutation;
  let phase = nativePendingMutationPhase(recoveryMutation);
  let lineage = await barrier.getAccountMutationLineage();
  if (recoveryMutation.displayEpoch !== undefined) {
    const owner = nativeMutationOwner(recoveryMutation.reason, recoveryMutation.displayEpoch);
    const exactLineage = await requireExactNativeMutationLineage(lineage, owner);
    return { owner, lineage: exactLineage, pendingMutation: recoveryMutation };
  }

  if (phase === 'pre_begin') {
    if (lineage !== null) {
      throw new NativeAuthError(
        'NATIVE_PENDING_MUTATION_LINEAGE_MISMATCH',
        'Native logout recovery found lineage before its durable begin request.',
      );
    }
    recoveryMutation = await persistPendingNativeMutationPhase(
      storage,
      recoveryMutation,
      'native_begin_pending',
    );
    phase = 'native_begin_pending';
  }

  if (phase === 'native_begin_pending') {
    if (lineage === null) {
      const receipt = requireZeroMutationReceipt(
        await barrier.beginAccountMutation(recoveryMutation.reason),
      );
      lineage = {
        phase: 'awaiting_finalize',
        reason: recoveryMutation.reason,
        display_epoch: receipt.display_epoch,
        zero_counts: receipt.zero_counts,
      };
    } else if (
      lineage.phase !== 'awaiting_finalize'
      || lineage.reason !== recoveryMutation.reason
      || !hasExactZeroCounts(lineage.zero_counts)
    ) {
      throw new NativeAuthError(
        'NATIVE_PENDING_MUTATION_LINEAGE_MISMATCH',
        'Native logout recovery could not replay its durable begin request.',
      );
    }
  } else if (
    phase !== 'server_acknowledgement_pending'
    || !lineage
    || lineage.phase !== 'awaiting_finalize'
    || lineage.reason !== recoveryMutation.reason
    || !hasExactZeroCounts(lineage.zero_counts)
  ) {
    throw new NativeAuthError(
      'NATIVE_PENDING_MUTATION_LINEAGE_MISMATCH',
      'Native logout recovery could not bind its missing mutation epoch to native lineage.',
    );
  }

  const owner = nativeMutationOwner(lineage.reason, lineage.display_epoch);
  const persistedMutation = await persistPendingNativeMutationDisplayEpoch(
    storage,
    recoveryMutation,
    owner.displayEpoch,
  );
  return { owner, lineage, pendingMutation: persistedMutation };
}

async function recoverPrivacyBarrierFailure(
  storage: NativeAuthSecureStorageAdapter,
  failure: NativePrivacyBarrierFailure,
): Promise<void> {
  await invalidateNativeAuthSessionForMutationOnCommitLane();
  clearAccessToken();

  const owner = privacyBarrierFailureOwner(failure);
  if (!owner) {
    privacyBarrierFailed = true;
    throw new NativeAuthError(
      'LOCAL_PRIVACY_BARRIER_RECOVERY_UNOWNED',
      'Native authentication is blocked because privacy recovery has no exact native mutation owner.',
    );
  }

  try {
    const barrier = requireNotificationBarrier();
    const lineage = await requireExactNativeMutationLineage(
      await barrier.getAccountMutationLineage(),
      owner,
    );
    if (lineage.phase !== 'completed') {
      throw new NativeAuthError(
        'NATIVE_MUTATION_LINEAGE_MISMATCH',
        'Native privacy recovery cannot finalize an awaiting mutation without server acknowledgement.',
      );
    }
    await finalizeNativeMutationOwner(barrier, owner);
    await clearNativeCredentials(storage, owner);
    clearAccessToken();
  } catch (error) {
    privacyBarrierFailed = true;
    throw asNativeAuthError(
      error,
      'LOCAL_PRIVACY_BARRIER_RECOVERY_FAILED',
      'Native authentication is blocked until local privacy recovery proves zero state.',
    );
  }
}

function requireNativeSessionPublicationOpen(): void {
  if (sessionPublicationBlockedByMutation) {
    throw new NativeAuthError(
      'NATIVE_SESSION_MUTATION_IN_PROGRESS',
      'Native session publication is blocked until the account mutation is finalized.',
    );
  }
}

function requireNotificationBarrier(): NativeAuthNotificationBarrier {
  if (!notificationBarrier) {
    throw new NativeAuthError(
      'NOTIFICATION_BARRIER_UNAVAILABLE',
      'Native session changes are blocked until the notification barrier is available.',
    );
  }
  return notificationBarrier;
}

async function requireNoPrivacyBarrierFailure(storage: NativeAuthSecureStorageAdapter): Promise<void> {
  let failure: NativePrivacyBarrierFailure | null;
  try {
    failure = await loadPrivacyBarrierFailure(storage);
  } catch (error) {
    privacyBarrierFailed = true;
    invalidateNativeAuthSessionForMutation();
    clearAccessToken();
    throw asNativeAuthError(
      error,
      'LOCAL_PRIVACY_BARRIER_FAILED',
      'Native authentication is blocked until local privacy recovery completes.',
    );
  }

  if (failure?.corruptSession) {
    await recoverNativeAuthCorruptSession();
    return;
  }
  if (privacyBarrierFailed) {
    throw new NativeAuthError(
      'LOCAL_PRIVACY_BARRIER_FAILED',
      'Native authentication is blocked until local privacy recovery completes.',
    );
  }
  if (failure) {
    await recoverPrivacyBarrierFailure(storage, failure);
  }
}

async function closeNativeAuthForCorruptStoredSession(
  storage: NativeAuthSecureStorageAdapter,
  corruptSessionValue: string,
  onSecureSessionCommitLane = false,
): Promise<void> {
  if (onSecureSessionCommitLane) {
    await closeNativeAuthForCorruptStoredSessionOnce(storage, corruptSessionValue);
    return;
  }
  await enqueueSecureSessionCommit(() =>
    closeNativeAuthForCorruptStoredSessionOnce(storage, corruptSessionValue),
  );
}

async function closeNativeAuthForCorruptStoredSessionOnce(
  storage: NativeAuthSecureStorageAdapter,
  corruptSessionValue: string,
): Promise<void> {
  await establishNativeCorruptSessionRecovery(storage, corruptSessionValue);
}

async function establishNativeCorruptSessionRecovery(
  storage: NativeAuthSecureStorageAdapter,
  corruptSessionValue: string,
): Promise<{ readonly owner: NativeMutationOwner; readonly audit: NativeCorruptSessionAudit }> {
  const pendingMutation = extractCorruptPendingMutation(corruptSessionValue);
  const reason = pendingMutation?.reason ?? 'account_switch';
  invalidateNativeAuthSessionForMutation();
  clearAccessToken();

  const barrier = requireNotificationBarrier();
  const lineage = await barrier.getAccountMutationLineage();
  let owner: NativeMutationOwner;
  let auditedPendingMutation: NativePendingMutation | null = null;

  if (pendingMutation?.version === 4) {
    const phase = nativePendingMutationPhase(pendingMutation);
    if (pendingMutation.displayEpoch !== undefined) {
      owner = nativeMutationOwner(reason, pendingMutation.displayEpoch);
      await requireExactNativeMutationLineage(lineage, owner);
    } else if (
      lineage
      && lineage.phase === 'awaiting_finalize'
      && lineage.reason === reason
      && hasExactZeroCounts(lineage.zero_counts)
      && (
        phase === 'native_begin_pending'
        || phase === 'server_acknowledgement_pending'
      )
    ) {
      owner = nativeMutationOwner(reason, lineage.display_epoch);
    } else if (
      lineage === null
      && (phase === 'pre_begin' || phase === 'native_begin_pending')
    ) {
      const intent: NativeCorruptSessionBeginIntent = {
        version: 3,
        sessionValue: corruptSessionValue,
        pendingMutation: {
          ...pendingMutation,
          phase: 'native_begin_pending',
        },
        reason,
        phase: 'native_begin_pending',
      };
      await saveNativeCorruptSessionAudit(storage, intent);
      return completeNativeCorruptSessionBeginIntent(storage, intent);
    } else {
      throw new NativeAuthError(
        'NATIVE_CORRUPT_SESSION_OWNER_UNRECOVERABLE',
        'Corrupt native session recovery could not bind its exact pending mutation owner.',
      );
    }
    auditedPendingMutation = {
      ...pendingMutation,
      displayEpoch: owner.displayEpoch,
      phase: phase === 'server_acknowledged'
        ? 'server_acknowledged'
        : phase === 'reconciliation_required'
          ? 'reconciliation_required'
          : phase === 'refresh_recovery_pending'
            ? 'refresh_recovery_pending'
            : 'server_acknowledgement_pending',
    };
  } else {
    if (lineage !== null) {
      throw new NativeAuthError(
        'NATIVE_CORRUPT_SESSION_OWNER_UNRECOVERABLE',
        'Corrupt native session recovery found an owner without matching durable recovery evidence.',
      );
    }
    const intent: NativeCorruptSessionBeginIntent = {
      version: 3,
      sessionValue: corruptSessionValue,
      pendingMutation: null,
      reason,
      phase: 'native_begin_pending',
    };
    await saveNativeCorruptSessionAudit(storage, intent);
    return completeNativeCorruptSessionBeginIntent(storage, intent);
  }

  const audit: NativeCorruptSessionAudit = {
    version: 2,
    sessionValue: corruptSessionValue,
    pendingMutation: auditedPendingMutation,
    reason,
    display_epoch: owner.displayEpoch,
    serverAcknowledged: auditedPendingMutation !== null
      && nativePendingMutationPhase(auditedPendingMutation) === 'server_acknowledged',
  };
  await saveNativeCorruptSessionAudit(storage, audit);
  await markPrivacyBarrierFailure(storage, owner, { corruptSession: true });
  return { owner, audit };
}

async function completeNativeCorruptSessionBeginIntent(
  storage: NativeAuthSecureStorageAdapter,
  intent: NativeCorruptSessionBeginIntent,
): Promise<{ readonly owner: NativeMutationOwner; readonly audit: NativeCorruptSessionAudit }> {
  const barrier = requireNotificationBarrier();
  const lineage = await barrier.getAccountMutationLineage();
  let owner: NativeMutationOwner;
  if (lineage === null) {
    const receipt = requireZeroMutationReceipt(
      await barrier.beginAccountMutation(intent.reason),
    );
    owner = nativeMutationOwner(intent.reason, receipt.display_epoch);
  } else if (
    lineage.phase === 'awaiting_finalize'
    && lineage.reason === intent.reason
    && hasExactZeroCounts(lineage.zero_counts)
  ) {
    owner = nativeMutationOwner(intent.reason, lineage.display_epoch);
  } else {
    throw new NativeAuthError(
      'NATIVE_CORRUPT_SESSION_OWNER_UNRECOVERABLE',
      'Corrupt native session begin intent did not match native lineage.',
    );
  }

  const auditedPendingMutation = intent.pendingMutation?.version === 4
    ? {
        ...intent.pendingMutation,
        displayEpoch: owner.displayEpoch,
        phase: 'server_acknowledgement_pending' as const,
      }
    : null;
  const audit: NativeCorruptSessionAudit = {
    version: 2,
    sessionValue: intent.sessionValue,
    pendingMutation: auditedPendingMutation,
    reason: intent.reason,
    display_epoch: owner.displayEpoch,
    serverAcknowledged: false,
  };
  await saveNativeCorruptSessionAudit(storage, audit);
  await markPrivacyBarrierFailure(storage, owner, { corruptSession: true });
  return { owner, audit };
}

async function recoverNativeAuthCorruptSessionOnce(
  storage: NativeAuthSecureStorageAdapter,
): Promise<boolean> {
  let failure: NativePrivacyBarrierFailure | null;
  let recoveryRecord: NativeCorruptSessionRecoveryRecord | null;
  try {
    failure = await loadPrivacyBarrierFailure(storage);
    recoveryRecord = await loadNativeCorruptSessionAudit(storage);
  } catch (error) {
    privacyBarrierFailed = true;
    invalidateNativeAuthSessionForMutation();
    clearAccessToken();
    throw error;
  }

  if (recoveryRecord?.version === 3) {
    if (failure !== null) {
      privacyBarrierFailed = true;
      invalidateNativeAuthSessionForMutation();
      clearAccessToken();
      throw new NativeAuthError(
        'NATIVE_CORRUPT_SESSION_RECOVERY_EVIDENCE_MISMATCH',
        'Corrupt native session begin intent cannot coexist with an owner marker.',
      );
    }
    const established = await completeNativeCorruptSessionBeginIntent(
      storage,
      recoveryRecord,
    );
    return recoverExactNativeCorruptSession(
      storage,
      {
        version: 2,
        reason: established.owner.reason,
        display_epoch: established.owner.displayEpoch,
        corruptSession: true,
      },
      established.audit,
    );
  }
  const audit = recoveryRecord;
  if (audit !== null && failure === null) {
    return recoverExactNativeCorruptSession(
      storage,
      {
        version: 2,
        reason: audit.reason,
        display_epoch: audit.display_epoch,
        corruptSession: true,
      },
      audit,
    );
  }
  if (failure !== null || audit !== null) {
    if (failure && !failure.corruptSession && audit === null) {
      return false;
    }
    if (!failure?.corruptSession || !audit) {
      privacyBarrierFailed = true;
      invalidateNativeAuthSessionForMutation();
      clearAccessToken();
      throw new NativeAuthError(
        'NATIVE_CORRUPT_SESSION_RECOVERY_EVIDENCE_MISMATCH',
        'Corrupt native session recovery requires matching marker and audit evidence.',
      );
    }
    return recoverExactNativeCorruptSession(storage, failure, audit);
  }

  const storedSession = await loadStoredSession(storage);
  if (storedSession.kind !== 'corrupt') {
    return false;
  }

  const established = await establishNativeCorruptSessionRecovery(storage, storedSession.value);
  return recoverExactNativeCorruptSession(
    storage,
    {
      version: 2,
      reason: established.owner.reason,
      display_epoch: established.owner.displayEpoch,
      corruptSession: true,
    },
    established.audit,
  );
}

async function recoverExactNativeCorruptSession(
  storage: NativeAuthSecureStorageAdapter,
  failure: NativePrivacyBarrierFailure,
  audit: NativeCorruptSessionAudit,
): Promise<boolean> {
  const owner = privacyBarrierFailureOwner(failure);
  if (
    !owner
    || !failure.corruptSession
    || audit.reason !== owner.reason
    || audit.display_epoch !== owner.displayEpoch
    || (
      audit.pendingMutation?.version === 4
      && audit.pendingMutation.displayEpoch !== owner.displayEpoch
    )
  ) {
    privacyBarrierFailed = true;
    invalidateNativeAuthSessionForMutation();
    clearAccessToken();
    throw new NativeAuthError(
      'NATIVE_CORRUPT_SESSION_REASON_MISMATCH',
      'Corrupt native session recovery evidence did not match its durable mutation owner.',
    );
  }

  invalidateNativeAuthSessionForMutation();
  clearAccessToken();

  const barrier = requireNotificationBarrier();
  const lineage = await requireExactNativeMutationLineage(
    await barrier.getAccountMutationLineage(),
    owner,
  );
  if (!audit.serverAcknowledged && lineage.phase !== 'awaiting_finalize') {
    throw new NativeAuthError(
      'NATIVE_CORRUPT_SESSION_RECONCILIATION_PHASE_MISMATCH',
      'Corrupt native session recovery cannot reconcile a completed mutation.',
    );
  }

  let acknowledgedAudit = audit;
  if (!acknowledgedAudit.serverAcknowledged) {
    const pendingMutation = acknowledgedAudit.pendingMutation;
    if (!pendingMutation || pendingMutation.reason !== owner.reason) {
      throw new NativeAuthError(
        'NATIVE_SECURE_SESSION_RECONCILIATION_REQUIRED',
        'Corrupt native session recovery requires an existing logout receipt proof.',
      );
    }

    const refreshToken = await storage.get(NATIVE_AUTH_REFRESH_STORAGE_KEY);
    if (!refreshToken) {
      throw new NativeAuthError(
        'NATIVE_SECURE_SESSION_RECONCILIATION_REQUIRED',
        'Corrupt native session recovery requires an existing logout receipt proof.',
      );
    }

    if (nativePendingMutationPhase(pendingMutation) === 'refresh_recovery_pending') {
      const session = await replayNativeRefreshRecovery(pendingMutation, refreshToken);
      await requestNativeLogout(
        session.installationId,
        session.bindingGeneration,
        session.authorizationBearer,
        pendingMutation.idempotencyKey,
      );
      acknowledgedAudit = {
        ...acknowledgedAudit,
        pendingMutation: {
          ...pendingMutation,
          phase: 'server_acknowledged',
        },
        serverAcknowledged: true,
      };
    } else {
      await requestNativeLogoutReconciliation(pendingMutation, refreshToken);
      acknowledgedAudit = {
        ...acknowledgedAudit,
        serverAcknowledged: true,
      };
    }
    await saveNativeCorruptSessionAudit(storage, acknowledgedAudit);
  }

  await finalizeNativeMutationOwner(barrier, owner);
  await clearNativeCredentialsOnce(storage, owner, {
    allowCorruptSessionReconciliation: true,
    corruptSessionRecovery: true,
  });
  clearAccessToken();
  return true;
}

async function saveNativeCorruptSessionAudit(
  storage: NativeAuthSecureStorageAdapter,
  audit: NativeCorruptSessionRecoveryRecord,
): Promise<void> {
  await storage.set(
    NATIVE_AUTH_CORRUPT_SESSION_AUDIT_STORAGE_KEY,
    JSON.stringify(audit),
  );
}

async function loadNativeCorruptSessionAudit(
  storage: NativeAuthSecureStorageAdapter,
): Promise<NativeCorruptSessionRecoveryRecord | null> {
  const value = await storage.get(NATIVE_AUTH_CORRUPT_SESSION_AUDIT_STORAGE_KEY);
  if (value === null) {
    return null;
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    if (isNativeCorruptSessionAudit(parsed) || isNativeCorruptSessionBeginIntent(parsed)) {
      return parsed;
    }
  } catch {
    // A malformed audit record cannot be used as a reconciliation proof.
  }
  throw new NativeAuthError(
    'INVALID_CORRUPT_SESSION_AUDIT',
    'Corrupt native session audit evidence was invalid.',
  );
}

async function markPrivacyBarrierFailure(
  storage: NativeAuthSecureStorageAdapter,
  owner: NativeMutationOwner | null,
  options: { readonly corruptSession?: boolean } = {},
): Promise<void> {
  privacyBarrierFailed = true;
  try {
    const existingFailure = await loadPrivacyBarrierFailure(storage);
    if (existingFailure) {
      const existingOwner = privacyBarrierFailureOwner(existingFailure);
      if (
        existingOwner
        && owner
        && sameNativeMutationOwner(existingOwner, owner)
        && existingFailure.corruptSession === options.corruptSession
      ) {
        if (options.corruptSession) {
          sessionPublicationBlockedByMutation = true;
        }
        return;
      }
      throw new NativeAuthError(
        'LOCAL_PRIVACY_BARRIER_MARKER_MISMATCH',
        'Native privacy recovery evidence did not match the active mutation owner.',
      );
    }

    await storage.set(
      NATIVE_AUTH_PRIVACY_BARRIER_FAILED_STORAGE_KEY,
      JSON.stringify(
        owner
          ? {
              version: 2,
              reason: owner.reason,
              display_epoch: owner.displayEpoch,
              ...(options.corruptSession ? { corruptSession: true } : {}),
            } satisfies NativeOwnedPrivacyBarrierFailure
          : {
              version: 2,
              unowned: true,
              ...(options.corruptSession ? { corruptSession: true } : {}),
            } satisfies NativeUnownedPrivacyBarrierFailure,
      ),
    );
    if (options.corruptSession) {
      sessionPublicationBlockedByMutation = true;
    }
  } catch (error) {
    throw new NativeAuthCleanupError(
      'LOCAL_PRIVACY_BARRIER_MARKER_PERSIST_FAILED',
      'Native admission remains closed, but secure privacy recovery could not be persisted.',
      [error],
    );
  }
}

function aggregateNativeCleanupFailure(
  code: string,
  message: string,
  cleanupErrors: readonly unknown[],
): NativeAuthCleanupError {
  const markerPersistenceFailed = cleanupErrors.some(
    (error) => (
      error instanceof NativeAuthError
      && error.code === 'LOCAL_PRIVACY_BARRIER_MARKER_PERSIST_FAILED'
    ),
  );
  if (markerPersistenceFailed) {
    return new NativeAuthCleanupError(
      'LOCAL_PRIVACY_BARRIER_MARKER_PERSIST_FAILED',
      'Native admission remains closed, but secure privacy recovery could not be persisted.',
      cleanupErrors,
    );
  }
  return new NativeAuthCleanupError(code, message, cleanupErrors);
}

function requireZeroMutationReceipt(receipt: NativeMutationReceipt): NativeMutationReceipt {
  if (
    !isOwnRecord(receipt)
    || !hasOwnKey(receipt, 'success')
    || receipt.success !== true
    || !hasOwnKey(receipt, 'display_epoch')
    || !isCanonicalUint64String(receipt.display_epoch)
    || !hasOwnKey(receipt, 'zero_counts')
    || !hasExactOwnKeys(receipt.zero_counts, [
      'pending_count',
      'delivered_count',
      'foreground_banner_count',
      'registry_count',
      'inflight_count',
    ])
    || receipt.zero_counts.pending_count !== 0
    || receipt.zero_counts.delivered_count !== 0
    || receipt.zero_counts.foreground_banner_count !== 0
    || receipt.zero_counts.registry_count !== 0
    || receipt.zero_counts.inflight_count !== 0
  ) {
    throw new NativeAuthError(
      'NOTIFICATION_BARRIER_FAILED',
      'Native notification cleanup did not acknowledge zero state.',
    );
  }
  return receipt;
}
function nativeMutationOwner(
  reason: AccountMutationReason,
  displayEpoch: string,
): NativeMutationOwner {
  if (!isAccountMutationReason(reason) || !isCanonicalUint64String(displayEpoch)) {
    throw new NativeAuthError(
      'NOTIFICATION_BARRIER_FAILED',
      'Native notification cleanup did not establish a valid mutation owner.',
    );
  }
  return { reason, displayEpoch };
}

function sameNativeMutationOwner(
  left: NativeMutationOwner,
  right: NativeMutationOwner,
): boolean {
  return left.reason === right.reason && left.displayEpoch === right.displayEpoch;
}

async function finalizeNativeMutationOwner(
  barrier: NativeAuthNotificationBarrier,
  owner: NativeMutationOwner,
): Promise<NativeMutationReceipt> {
  const receipt = requireZeroMutationReceipt(
    await barrier.finalizeAccountMutation(owner.reason, owner.displayEpoch),
  );
  if (receipt.display_epoch !== owner.displayEpoch) {
    throw new NativeAuthError(
      'NATIVE_MUTATION_LINEAGE_MISMATCH',
      'Native mutation finalization did not match its durable owner.',
    );
  }
  return receipt;
}

async function requireExactNativeMutationLineage(
  lineage: NativeAccountMutationLineage | null,
  owner: NativeMutationOwner,
): Promise<NativeAccountMutationLineage> {
  if (
    !lineage
    || !hasExactOwnKeys(lineage, ['phase', 'reason', 'display_epoch', 'zero_counts'])
    || (lineage.phase !== 'awaiting_finalize' && lineage.phase !== 'completed')
    || lineage.reason !== owner.reason
    || lineage.display_epoch !== owner.displayEpoch
    || !hasExactZeroCounts(lineage.zero_counts)
  ) {
    throw new NativeAuthError(
      'NATIVE_MUTATION_LINEAGE_MISMATCH',
      'Native mutation lineage did not match the durable privacy recovery owner.',
    );
  }
  return lineage;
}

function hasExactZeroCounts(value: unknown): boolean {
  if (!hasExactOwnKeys(value, [
    'pending_count',
    'delivered_count',
    'foreground_banner_count',
    'registry_count',
    'inflight_count',
  ])) {
    return false;
  }
  return (
    value.pending_count === 0
    && value.delivered_count === 0
    && value.foreground_banner_count === 0
    && value.registry_count === 0
    && value.inflight_count === 0
  );
}

function sameNativeSession(left: NativeAuthSession, right: NativeAuthSession): boolean {
  return (
    left.sessionId === right.sessionId &&
    left.authVersion === right.authVersion &&
    left.installationId === right.installationId &&
    left.bindingGeneration === right.bindingGeneration &&
    left.tokenGeneration === right.tokenGeneration &&
    left.authorizationBearer === right.authorizationBearer
  );
}

function sameNativeSessionAuthority(
  storedSession: NativeStoredSession,
  session: NativeAuthSession,
): boolean {
  return (
    storedSession.sessionId === session.sessionId
    && storedSession.authVersion === session.authVersion
    && storedSession.installationId === session.installationId
  );
}

function canPublishStagedNativeSession(
  storedSession: NativeStoredSession | null,
  session: NativeAuthSession,
): boolean {
  return (
    !storedSession
    || (
      !storedSession.pendingMutation
      && sameNativeSessionAuthority(storedSession, session)
      && session.bindingGeneration >= storedSession.bindingGeneration
      && session.tokenGeneration >= storedSession.tokenGeneration
    )
  );
}

async function saveTransient(
  storage: NativeAuthSecureStorageAdapter,
  transient: NativeAuthTransient,
): Promise<void> {
  await storage.set(NATIVE_AUTH_TRANSIENT_STORAGE_KEY, JSON.stringify(transient));
}

async function loadTransient(storage: NativeAuthSecureStorageAdapter): Promise<NativeAuthTransient | null> {
  const value = await storage.get(NATIVE_AUTH_TRANSIENT_STORAGE_KEY);
  if (!value) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (isNativeAuthTransient(parsed)) {
      return parsed;
    }
  } catch {
    // Invalid secure transient state is discarded below.
  }

  await removeTransient(storage);
  throw new NativeAuthError('INVALID_TRANSIENT_STATE', 'The pending native authorization transaction was invalid.');
}

async function removeTransient(storage: NativeAuthSecureStorageAdapter): Promise<void> {
  await storage.remove(NATIVE_AUTH_TRANSIENT_STORAGE_KEY);
}
async function loadStoredSession(
  storage: NativeAuthSecureStorageAdapter,
): Promise<NativeStoredSessionState> {
  const value = await storage.get(NATIVE_AUTH_SESSION_STORAGE_KEY);
  if (value === null) {
    return { kind: 'absent' };
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (isNativeStoredSession(parsed)) {
      return { kind: 'valid', session: parsed };
    }
  } catch {
    // Corrupt secure session bytes remain authoritative until server reconciliation.
  }
  return { kind: 'corrupt', value };
}

async function requireUncorruptedStoredSession(
  storage: NativeAuthSecureStorageAdapter,
  storedSessionState: NativeStoredSessionState,
  onSecureSessionCommitLane = false,
): Promise<NativeStoredSession | null> {
  if (storedSessionState.kind === 'corrupt') {
    await closeNativeAuthForCorruptStoredSession(
      storage,
      storedSessionState.value,
      onSecureSessionCommitLane,
    );
    throw new NativeAuthError(
      'NATIVE_SECURE_SESSION_CORRUPT',
      'Native secure session state is corrupt and requires server installation reconciliation.',
    );
  }
  return storedSessionState.kind === 'valid' ? storedSessionState.session : null;
}
async function savePendingNativeMutation(
  storage: NativeAuthSecureStorageAdapter,
  reason: 'logout' | 'account_switch',
): Promise<{ readonly pendingMutation: NativePendingMutation; readonly session: NativeAuthSession }> {
  return enqueueSecureSessionCommit(() => savePendingNativeMutationOnce(storage, reason));
}

async function savePendingNativeMutationOnce(
  storage: NativeAuthSecureStorageAdapter,
  reason: 'logout' | 'account_switch',
): Promise<{ readonly pendingMutation: NativePendingMutation; readonly session: NativeAuthSession }> {
  const session = currentSession;
  if (!session) {
    throw new NativeAuthError(
      'NATIVE_SESSION_CONTEXT_UNAVAILABLE',
      'Native logout requires an active native session context.',
    );
  }

  const storedSession = await requireUncorruptedStoredSession(
    storage,
    await loadStoredSession(storage),
    true,
  );
  if (
    !storedSession
    || storedSession.pendingMutation
    || !sameNativeSessionAuthority(storedSession, session)
    || storedSession.bindingGeneration !== session.bindingGeneration
    || storedSession.tokenGeneration !== session.tokenGeneration
  ) {
    throw new NativeAuthError(
      'NATIVE_SESSION_CONTEXT_UNAVAILABLE',
      'Native logout requires persisted secure session metadata.',
    );
  }

  const idempotencyKey = createIdempotencyKey();
  if (!isUuid(idempotencyKey)) {
    throw new NativeAuthError(
      'NATIVE_LOGOUT_IDEMPOTENCY_INVALID',
      'Native logout could not create a stable idempotency identity.',
    );
  }
  const pendingMutation: NativePendingMutation = {
    version: 4,
    reason,
    sessionId: session.sessionId,
    installationId: session.installationId,
    bindingGeneration: session.bindingGeneration,
    idempotencyKey,
    phase: 'pre_begin',
  };
  await storage.set(
    NATIVE_AUTH_SESSION_STORAGE_KEY,
    JSON.stringify({ ...storedSession, pendingMutation }),
  );
  invalidateNativeAuthSessionForMutation();
  return { pendingMutation, session };
}
async function persistPendingNativeMutationDisplayEpoch(
  storage: NativeAuthSecureStorageAdapter,
  pendingMutation: NativePendingMutation,
  displayEpoch: string,
): Promise<NativePendingMutation> {
  return enqueueSecureSessionCommit(async () => {
    const storedSession = await requireUncorruptedStoredSession(
      storage,
      await loadStoredSession(storage),
      true,
    );
    const storedMutation = storedSession?.pendingMutation;
    const storedPhase = storedMutation ? nativePendingMutationPhase(storedMutation) : null;
    if (
      !storedSession
      || !storedMutation
      || !samePendingNativeMutation(storedMutation, pendingMutation)
      || storedMutation.version !== 4
      || (
        storedPhase !== 'native_begin_pending'
        && storedPhase !== 'server_acknowledgement_pending'
      )
      || !isCanonicalUint64String(displayEpoch)
    ) {
      throw new NativeAuthError(
        'NATIVE_PENDING_MUTATION_CONTEXT_UNAVAILABLE',
        'Native logout could not persist its exact native mutation owner.',
      );
    }
    if (storedMutation.displayEpoch !== undefined) {
      if (storedMutation.displayEpoch !== displayEpoch) {
        throw new NativeAuthError(
          'NATIVE_PENDING_MUTATION_EPOCH_MISMATCH',
          'Native logout recovery owner did not match its persisted mutation epoch.',
        );
      }
      return storedMutation;
    }

    const nextMutation: NativePendingMutation = {
      ...storedMutation,
      displayEpoch,
      phase: 'server_acknowledgement_pending',
    };
    await storage.set(
      NATIVE_AUTH_SESSION_STORAGE_KEY,
      JSON.stringify({ ...storedSession, pendingMutation: nextMutation }),
    );
    return nextMutation;
  });
}


async function persistPendingNativeMutationPhase(
  storage: NativeAuthSecureStorageAdapter,
  pendingMutation: NativePendingMutation,
  phase: NativePendingMutationPhase,
): Promise<NativePendingMutation> {
  return enqueueSecureSessionCommit(() => persistPendingNativeMutationPhaseOnce(
    storage,
    pendingMutation,
    phase,
  ));
}

async function persistPendingNativeMutationPhaseOnce(
  storage: NativeAuthSecureStorageAdapter,
  pendingMutation: NativePendingMutation,
  phase: NativePendingMutationPhase,
): Promise<NativePendingMutation> {
  const storedSession = await requireUncorruptedStoredSession(
    storage,
    await loadStoredSession(storage),
    true,
  );
  const storedMutation = storedSession?.pendingMutation;
  const currentPhase = storedMutation ? nativePendingMutationPhase(storedMutation) : null;
  const epochRequirementSatisfied = storedMutation
    ? (
        isCanonicalUint64String(storedMutation.displayEpoch)
        || (
          storedMutation.displayEpoch === undefined
          && phase === 'native_begin_pending'
          && (currentPhase === 'pre_begin' || currentPhase === 'native_begin_pending')
        )
      )
    : false;
  if (
    !storedSession
    || !storedMutation
    || !samePendingNativeMutation(storedMutation, pendingMutation)
    || storedMutation.version !== 4
    || !epochRequirementSatisfied
    || !currentPhase
    || !canPersistPendingNativeMutationPhase(currentPhase, phase)
  ) {
    throw new NativeAuthError(
      'NATIVE_PENDING_MUTATION_CONTEXT_UNAVAILABLE',
      'Native logout recovery could not persist its original account context.',
    );
  }

  const nextMutation: NativePendingMutation = {
    ...storedMutation,
    version: 4,
    phase,
  };
  await storage.set(
    NATIVE_AUTH_SESSION_STORAGE_KEY,
    JSON.stringify({ ...storedSession, pendingMutation: nextMutation }),
  );
  return nextMutation;
}
async function persistRefreshRecoveryIdempotencyKey(
  storage: NativeAuthSecureStorageAdapter,
  pendingMutation: NativePendingMutation,
  refreshRecoveryIdempotencyKey: string,
): Promise<NativePendingMutation> {
  return enqueueSecureSessionCommit(async () => {
    const storedSession = await requireUncorruptedStoredSession(
      storage,
      await loadStoredSession(storage),
      true,
    );
    const storedMutation = storedSession?.pendingMutation;
    if (
      !storedSession
      || !storedMutation
      || !samePendingNativeMutation(storedMutation, pendingMutation)
      || storedMutation.version !== 4
      || !isCanonicalUint64String(storedMutation.displayEpoch)
      || !isUuid(refreshRecoveryIdempotencyKey)
      || (
        storedMutation.refreshRecoveryIdempotencyKey !== undefined
        && storedMutation.refreshRecoveryIdempotencyKey !== refreshRecoveryIdempotencyKey
      )
    ) {
      throw new NativeAuthError(
        'NATIVE_PENDING_MUTATION_CONTEXT_UNAVAILABLE',
        'Native logout recovery could not persist its refresh recovery identity.',
      );
    }
    const currentPhase = nativePendingMutationPhase(storedMutation);
    if (
      currentPhase !== 'server_acknowledgement_pending'
      && currentPhase !== 'reconciliation_required'
      && currentPhase !== 'refresh_recovery_pending'
    ) {
      throw new NativeAuthError(
        'NATIVE_PENDING_MUTATION_CONTEXT_UNAVAILABLE',
        'Native logout recovery phase could not enter refresh replay.',
      );
    }
    const nextMutation: NativePendingMutation = {
      ...storedMutation,
      version: 4,
      phase: 'refresh_recovery_pending',
      refreshRecoveryIdempotencyKey,
    };
    await storage.set(
      NATIVE_AUTH_SESSION_STORAGE_KEY,
      JSON.stringify({ ...storedSession, pendingMutation: nextMutation }),
    );
    return nextMutation;
  });
}

async function persistRotatedPendingMutationRefresh(
  storage: NativeAuthSecureStorageAdapter,
  pendingMutation: NativePendingMutation,
  session: NativeAuthSession,
): Promise<void> {
  return enqueueSecureSessionCommit(async () => {
    const storedSession = await requireUncorruptedStoredSession(
      storage,
      await loadStoredSession(storage),
      true,
    );
    const storedMutation = storedSession?.pendingMutation;
    if (
      !storedSession
      || !storedMutation
      || !samePendingNativeMutation(storedMutation, pendingMutation)
      || storedMutation.version !== 4
      || !isCanonicalUint64String(storedMutation.displayEpoch)
      || session.sessionId !== pendingMutation.sessionId
      || session.installationId !== pendingMutation.installationId
      || session.bindingGeneration !== pendingMutation.bindingGeneration
    ) {
      throw new NativeAuthError(
        'NATIVE_PENDING_MUTATION_CONTEXT_MISMATCH',
        'Native logout recovery did not restore the original account context.',
      );
    }

    await storage.set(
      NATIVE_AUTH_SESSION_STORAGE_KEY,
      JSON.stringify({
        ...storedSession,
        authVersion: session.authVersion,
        bindingGeneration: session.bindingGeneration,
        tokenGeneration: session.tokenGeneration,
        pendingMutation: storedMutation,
      }),
    );
  });
}

async function requirePendingNativeMutationReconciliation(
  storage: NativeAuthSecureStorageAdapter,
  pendingMutation: NativePendingMutation,
): Promise<void> {
  const storedSession = await requireUncorruptedStoredSession(
    storage,
    await loadStoredSession(storage),
  );
  const storedMutation = storedSession?.pendingMutation;
  if (
    !storedMutation
    || !samePendingNativeMutation(storedMutation, pendingMutation)
    || storedMutation.version !== 4
    || !isCanonicalUint64String(storedMutation.displayEpoch)
  ) {
    throw new NativeAuthError(
      'NATIVE_PENDING_MUTATION_CONTEXT_UNAVAILABLE',
      'Native logout recovery could not preserve its original account context.',
    );
  }
  const storedPhase = nativePendingMutationPhase(storedMutation);
  if (
    storedPhase !== 'server_acknowledged'
    && storedPhase !== 'refresh_recovery_pending'
  ) {
    await persistPendingNativeMutationPhase(
      storage,
      storedMutation,
      'reconciliation_required',
    );
  }
}

async function loadPrivacyBarrierFailure(
  storage: NativeAuthSecureStorageAdapter,
): Promise<NativePrivacyBarrierFailure | null> {
  const value = await storage.get(NATIVE_AUTH_PRIVACY_BARRIER_FAILED_STORAGE_KEY);
  if (value === null) {
    return null;
  }
  if (value === '1') {
    return { version: 1, legacy: true };
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (isNativePrivacyBarrierFailure(parsed)) {
      return parsed;
    }
    if (isLegacyPrivacyBarrierFailure(parsed)) {
      return { version: 1, legacy: true };
    }
  } catch {
    // Invalid secure privacy recovery state remains persisted and fail closed below.
  }
  throw new NativeAuthError(
    'INVALID_PRIVACY_BARRIER_FAILURE_STATE',
    'Native privacy recovery state was invalid.',
  );
}

function toStoredSession(session: NativeAuthSession): NativeStoredSession {
  return {
    version: 1,
    sessionId: session.sessionId,
    authVersion: session.authVersion,
    installationId: session.installationId,
    bindingGeneration: session.bindingGeneration,
    tokenGeneration: session.tokenGeneration,
  };
}

function isNativeStoredSession(value: unknown): value is NativeStoredSession {
  if (
    !hasExactOwnKeys(value, [
      'version',
      'sessionId',
      'authVersion',
      'installationId',
      'bindingGeneration',
      'tokenGeneration',
    ])
    && !hasExactOwnKeys(value, [
      'version',
      'sessionId',
      'authVersion',
      'installationId',
      'bindingGeneration',
      'tokenGeneration',
      'pendingMutation',
    ])
  ) {
    return false;
  }
  return (
    value.version === 1 &&
    isUuid(value.sessionId) &&
    isPositiveInteger(value.authVersion) &&
    isUuid(value.installationId) &&
    isPositiveInteger(value.bindingGeneration) &&
    isNonNegativeInteger(value.tokenGeneration) &&
    (!hasOwnKey(value, 'pendingMutation') || isNativePendingMutation(value.pendingMutation))
  );
}

function isNativePendingMutation(value: unknown): value is NativePendingMutation {
  if (!isOwnRecord(value)) {
    return false;
  }
  const isLegacyPendingMutation = hasExactOwnKeys(value, [
    'version',
    'reason',
    'sessionId',
    'installationId',
    'bindingGeneration',
    'idempotencyKey',
  ]) && value.version === 1;
  const isPhasedPendingMutation = hasExactOwnKeys(value, [
    'version',
    'reason',
    'sessionId',
    'installationId',
    'bindingGeneration',
    'idempotencyKey',
    'phase',
  ]) && value.version === 2 && isServerPendingMutationPhase(value.phase);
  const isRefreshRecoveryPendingMutation = hasExactOwnKeys(value, [
    'version',
    'reason',
    'sessionId',
    'installationId',
    'bindingGeneration',
    'idempotencyKey',
    'phase',
    'refreshRecoveryIdempotencyKey',
  ])
    && value.version === 3
    && isServerPendingMutationPhase(value.phase)
    && isUuid(value.refreshRecoveryIdempotencyKey);
  const isNarrowEpochPendingMutation = hasExactOwnKeys(value, [
    'version',
    'reason',
    'sessionId',
    'installationId',
    'bindingGeneration',
    'idempotencyKey',
    'phase',
  ])
    && value.version === 4
    && (
      value.phase === 'pre_begin'
      || value.phase === 'native_begin_pending'
      || value.phase === 'server_acknowledgement_pending'
    );
  const isEpochPendingMutation = hasExactOwnKeys(value, [
    'version',
    'reason',
    'sessionId',
    'installationId',
    'bindingGeneration',
    'idempotencyKey',
    'displayEpoch',
    'phase',
  ])
    && value.version === 4
    && isCanonicalUint64String(value.displayEpoch)
    && isServerPendingMutationPhase(value.phase);
  const isEpochRefreshRecoveryPendingMutation = hasExactOwnKeys(value, [
    'version',
    'reason',
    'sessionId',
    'installationId',
    'bindingGeneration',
    'idempotencyKey',
    'displayEpoch',
    'phase',
    'refreshRecoveryIdempotencyKey',
  ])
    && value.version === 4
    && isCanonicalUint64String(value.displayEpoch)
    && (
      value.phase === 'refresh_recovery_pending'
      || isServerPendingMutationPhase(value.phase)
    )
    && isUuid(value.refreshRecoveryIdempotencyKey);

  return (
    (
      isLegacyPendingMutation
      || isPhasedPendingMutation
      || isRefreshRecoveryPendingMutation
      || isNarrowEpochPendingMutation
      || isEpochPendingMutation
      || isEpochRefreshRecoveryPendingMutation
    )
    && isNativeLogoutMutationReason(value.reason)
    && isUuid(value.sessionId)
    && isUuid(value.installationId)
    && isPositiveInteger(value.bindingGeneration)
    && isUuid(value.idempotencyKey)
  );
}
function extractCorruptPendingMutation(sessionValue: string): NativePendingMutation | null {
  try {
    const parsed = JSON.parse(sessionValue) as unknown;
    if (
      isOwnRecord(parsed)
      && hasOwnKey(parsed, 'pendingMutation')
      && isNativePendingMutation(parsed.pendingMutation)
    ) {
      return parsed.pendingMutation;
    }
    if (
      isOwnRecord(parsed)
      && hasOwnKey(parsed, 'pendingMutation')
      && isOwnRecord(parsed.pendingMutation)
      && parsed.pendingMutation.version === 4
      && parsed.pendingMutation.phase === 'refresh_recovery_pending'
    ) {
      throw new NativeAuthError(
        'NATIVE_CORRUPT_SESSION_REFRESH_RECOVERY_CONTEXT_INVALID',
        'Corrupt native session recovery requires an exact refresh recovery context.',
      );
    }
  } catch (error) {
    if (error instanceof NativeAuthError) {
      throw error;
    }
    // A syntactically corrupt secure session cannot provide a receipt proof.
  }
  return null;
}

function isNativeCorruptSessionAudit(value: unknown): value is NativeCorruptSessionAudit {
  return (
    hasExactOwnKeys(value, [
      'version',
      'sessionValue',
      'pendingMutation',
      'reason',
      'display_epoch',
      'serverAcknowledged',
    ])
    && value.version === 2
    && typeof value.sessionValue === 'string'
    && (value.pendingMutation === null || isNativePendingMutation(value.pendingMutation))
    && isAccountMutationReason(value.reason)
    && isCanonicalUint64String(value.display_epoch)
    && typeof value.serverAcknowledged === 'boolean'
  );
}
function isNativeCorruptSessionBeginIntent(
  value: unknown,
): value is NativeCorruptSessionBeginIntent {
  return (
    hasExactOwnKeys(value, [
      'version',
      'sessionValue',
      'pendingMutation',
      'reason',
      'phase',
    ])
    && value.version === 3
    && typeof value.sessionValue === 'string'
    && (
      value.pendingMutation === null
      || (
        isNativePendingMutation(value.pendingMutation)
        && value.pendingMutation.version === 4
        && value.pendingMutation.displayEpoch === undefined
        && nativePendingMutationPhase(value.pendingMutation) === 'native_begin_pending'
      )
    )
    && isAccountMutationReason(value.reason)
    && value.phase === 'native_begin_pending'
  );
}

function nativePendingMutationPhase(
  pendingMutation: NativePendingMutation,
): NativePendingMutationPhase {
  return pendingMutation.phase ?? 'server_acknowledgement_pending';
}

function canPersistPendingNativeMutationPhase(
  current: NativePendingMutationPhase,
  next: NativePendingMutationPhase,
): boolean {
  if (current === next) {
    return true;
  }
  if (current === 'pre_begin') {
    return next === 'native_begin_pending';
  }
  if (current === 'native_begin_pending') {
    return false;
  }
  if (current === 'server_acknowledgement_pending') {
    return next === 'server_acknowledged' || next === 'reconciliation_required';
  }
  if (current === 'reconciliation_required') {
    return next === 'server_acknowledged';
  }
  if (current === 'refresh_recovery_pending') {
    return next === 'server_acknowledged';
  }
  return false;
}

function samePendingNativeMutation(
  left: NativePendingMutation,
  right: NativePendingMutation,
): boolean {
  return (
    left.reason === right.reason &&
    left.sessionId === right.sessionId &&
    left.installationId === right.installationId &&
    left.bindingGeneration === right.bindingGeneration &&
    left.idempotencyKey === right.idempotencyKey
  );
}

function privacyBarrierFailureOwner(
  failure: NativePrivacyBarrierFailure,
): NativeMutationOwner | null {
  return failure.version === 2 && 'reason' in failure
    ? nativeMutationOwner(failure.reason, failure.display_epoch)
    : null;
}

function isNativePrivacyBarrierFailure(value: unknown): value is NativePrivacyBarrierFailure {
  if (!isOwnRecord(value)) {
    return false;
  }
  const isOwnedFailure = (
    hasExactOwnKeys(value, ['version', 'reason', 'display_epoch'])
    || hasExactOwnKeys(value, ['version', 'reason', 'display_epoch', 'corruptSession'])
  )
    && value.version === 2
    && isAccountMutationReason(value.reason)
    && isCanonicalUint64String(value.display_epoch)
    && (!hasOwnKey(value, 'corruptSession') || value.corruptSession === true);
  const isUnownedFailure = (
    hasExactOwnKeys(value, ['version', 'unowned'])
    || hasExactOwnKeys(value, ['version', 'unowned', 'corruptSession'])
  )
    && value.version === 2
    && value.unowned === true
    && (!hasOwnKey(value, 'corruptSession') || value.corruptSession === true);
  return isOwnedFailure || isUnownedFailure;
}

function isLegacyPrivacyBarrierFailure(value: unknown): boolean {
  return (
    isOwnRecord(value)
    && value.version === 1
    && (
      hasExactOwnKeys(value, ['version', 'reason'])
      || hasExactOwnKeys(value, ['version', 'reason', 'legacy'])
      || hasExactOwnKeys(value, ['version', 'reason', 'corruptSession'])
    )
  );
}
function isNativeAuthTransient(value: unknown): value is NativeAuthTransient {
  if (!hasExactOwnKeys(value, [
    'version',
    'transactionId',
    'provider',
    'state',
    'nonce',
    'codeVerifier',
    'exchangeIdempotencyKey',
    'redirectTo',
  ])) {
    return false;
  }
  return (
    value.version === 1 &&
    isUuid(value.transactionId) &&
    isNativeOAuthProvider(value.provider) &&
    isOpaqueValue(value.state) &&
    isOpaqueValue(value.nonce) &&
    isOpaqueValue(value.codeVerifier) &&
    isUuid(value.exchangeIdempotencyKey) &&
    typeof value.redirectTo === 'string' &&
    safeRedirectTo(value.redirectTo) === value.redirectTo
  );
}

function createOpaqueValue(): string {
  if (typeof globalThis.crypto?.getRandomValues !== 'function') {
    throw new NativeAuthError('SECURE_RANDOMNESS_UNAVAILABLE', 'Native OAuth requires secure randomness.');
  }
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(32));
  return base64Url(bytes);
}

async function createCodeChallenge(verifier: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new NativeAuthError('CRYPTOGRAPHY_UNAVAILABLE', 'Native OAuth requires SHA-256 support.');
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function safeRedirectTo(redirectTo?: string): string {
  if (!redirectTo || !redirectTo.startsWith('/') || redirectTo.startsWith('//')) {
    return '/';
  }
  try {
    const parsed = new URL(redirectTo, NATIVE_AUTH_CALLBACK_ORIGIN);
    if (parsed.origin !== NATIVE_AUTH_CALLBACK_ORIGIN) {
      return '/';
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return '/';
  }
}

function isPermanentExchangeFailure(error: unknown): boolean {
  const status = responseStatus(error);
  return status === 400 || status === 401 || status === 409 || status === 410 || status === 422;
}

function responseStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object' || !('response' in error)) {
    return null;
  }
  const response = (error as { response?: unknown }).response;
  if (!response || typeof response !== 'object' || !('status' in response)) {
    return null;
  }
  const status = (response as { status?: unknown }).status;
  return typeof status === 'number' ? status : null;
}
function isDefinitiveLogoutNotAcknowledged(error: unknown): boolean {
  if (
    responseStatus(error) !== 409
    || !error
    || typeof error !== 'object'
    || !('response' in error)
  ) {
    return false;
  }
  const response = (error as { readonly response?: unknown }).response;
  return isOwnRecord(response)
    && hasOwnKey(response, 'data')
    && isOwnRecord(response.data)
    && response.data.code === 'LOGOUT_NOT_ACKNOWLEDGED';
}

function asNativeAuthError(error: unknown, code: string, message: string): NativeAuthError {
  return error instanceof NativeAuthError ? error : new NativeAuthError(code, message);
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error('Native authorization failed.');
}

function notifyCallbackError(error: Error): void {
  callbackSubscribers.forEach((subscriber) => subscriber.onError?.(error));
}

function isNativeOAuthProvider(value: unknown): value is NativeOAuthProvider {
  return value === 'google' || value === 'apple' || value === 'naver' || value === 'kakao';
}
function isNativeLogoutMutationReason(value: unknown): value is 'logout' | 'account_switch' {
  return value === 'logout' || value === 'account_switch';
}
function isServerPendingMutationPhase(
  value: unknown,
): value is Exclude<
  NativePendingMutationPhase,
  'pre_begin' | 'native_begin_pending' | 'refresh_recovery_pending'
> {
  return (
    value === 'server_acknowledgement_pending'
    || value === 'server_acknowledged'
    || value === 'reconciliation_required'
  );
}

function isAccountMutationReason(value: unknown): value is AccountMutationReason {
  return isNativeLogoutMutationReason(value) || value === 'deletion';
}
function requireNativeAuthSecureStorageKey(key: string): void {
  if (!NATIVE_AUTH_SECURE_STORAGE_KEYS.has(key)) {
    throw new NativeAuthError(
      'SECURE_STORAGE_KEY_INVALID',
      'Native secure storage key was not allowlisted.',
    );
  }
}

function isOwnRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOwnKey(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function hasExactOwnKeys(
  value: unknown,
  expectedKeys: readonly string[],
): value is Record<string, unknown> {
  return (
    isOwnRecord(value)
    && Object.keys(value).length === expectedKeys.length
    && expectedKeys.every((key) => hasOwnKey(value, key))
  );
}

function isExchangeCode(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 32 && value.length <= 512;
}

function isOpaqueValue(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43,128}$/.test(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
function isCanonicalUint64String(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^(0|[1-9][0-9]{0,19})$/.test(value) &&
    BigInt(value) <= BigInt('18446744073709551615')
  );
}

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function isDateTime(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}
