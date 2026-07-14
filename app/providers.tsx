'use client';

import { Capacitor } from '@capacitor/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useRef, useState } from 'react';

import { initializeAuth } from '@/_lib/api';
import { mobileReleaseClient } from '@/_lib/api/client';
import {
  DELETION_OPERATION_STORAGE_KEY,
  DELETION_STATUS_STORAGE_KEY,
  parseStoredDeletionOperationRecord,
  parseStoredDeletionStatusRecord,
} from '@/_lib/accountDeletion';
import { clearAccessToken } from '@/_lib/auth/tokenStore';
import { useUser } from '@/_lib/hooks/useUser';
import {
  applyNativeAuthSessionGenerations,
  createNativeAuthSecureStorageAdapter,
  getNativeAuthSession,
  getNativeAuthSessionTransitionGeneration,
  invalidateNativeAuthSessionForMutation,
  isNativeAuthPlatform,
  isNativeAuthSessionCurrent,
  refreshNativeAuthSession,
  releaseNativeAuthSessionAfterDeletionCancellation,
  prepareNativeTerminalRecovery,
  setNativeAuthNotificationBarrier,
  setNativeAuthSecureStorageAdapter,
  setNativeAuthSessionBinder,
  subscribeToNativeAuthCallbacks,
  type NativeAuthNotificationBarrier,
  type NativeAuthSecureStorageAdapter,
  type NativeAuthSession,
  type NativeAuthSessionBindResult,
} from '@/_lib/native/nativeAuth';
import {
  createNativeNotificationCoordinatorAdapter,
  hasZeroNotificationCounts,
  hasZeroNativeNotificationCounts,
  type AccountMutationReason,
  type NativeAccountMutationLineage,
  type NativeAuthorizationOperation,
  type NativeNotificationCoordinatorAdapter,
  type NativeNotificationPluginListenerHandle,
  type NativeOperationAbortReason,
  type NotificationTapPayload,
} from '@/_lib/native/notificationCoordinator';
import { readValidatedNativeReleaseManifest } from '@/_lib/native/mobileRelease';

const nativeNotificationAdapter = createNativeNotificationCoordinatorAdapter();
const NATIVE_STARTUP_TIMEOUT_MS = 5000;
const FCM_TOKEN_SYNC_RETRY_DELAYS_MS = [100, 500] as const;
const NATIVE_AUTH_RECOVERY_REQUIRED_MARKER_KEY =
  'zerotime.native-auth.privacy-barrier-failed.v1';

type FcmTokenSyncResult = 'synchronized' | 'awaiting_session' | 'stale';

interface FcmTokenSyncWork {
  readonly token: string;
  readonly session: NativeAuthSession;
  readonly transitionGeneration: number;
}

interface FcmTokenSyncSuccess {
  readonly token: string;
  readonly sessionId: string;
  readonly transitionGeneration: number;
  readonly bindingGeneration: number;
}

class FcmTokenSyncTerminalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FcmTokenSyncTerminalError';
  }
}

interface NativeNotificationRuntime {
  readonly installationId: string;
  readonly native: NativeNotificationCoordinatorAdapter;
  readonly listenerHandles: readonly NativeNotificationPluginListenerHandle[];
  readonly fcmTokenSyncKeys: Set<string>;
  session: NativeAuthSession | null;
  sessionTransitionGeneration: number | null;
  retainedFcmToken: string | null;
  lastFcmTokenSync: FcmTokenSyncSuccess | null;
  fcmTokenSyncLane: Promise<void>;
  fcmTokenRetryTimer: number | null;
  fcmTokenRetryAttempt: number;
  fcmTokenRetryWorkKey: string | null;
  authorizedTapLane: Promise<void>;
  disposed: boolean;
  recoveryRequired: boolean;
}

let nativeNotificationRuntime: Promise<NativeNotificationRuntime | null> | null = null;
let activeNativeNotificationRuntime: NativeNotificationRuntime | null = null;
let terminalNativeRecoveryRequired = false;
let terminalNativeAdmissionRecovery: Promise<void> | null = null;
let firstForegroundPermissionRequested = false;
let foregroundPermissionRequest: Promise<void> | null = null;
interface NativeAccountDeletionBarrierLifecycle {
  readonly runtime: NativeNotificationRuntime;
  readonly reason: AccountMutationReason;
  readonly displayEpoch: string;
}
interface NativeTerminalRecoveryDependencies {
  readonly native: NativeNotificationCoordinatorAdapter;
  readonly storage: NativeAuthSecureStorageAdapter;
  readonly barrier: NativeAuthNotificationBarrier;
}

let terminalNativeRecoveryDependencies: NativeTerminalRecoveryDependencies | null = null;
let nativeAccountDeletionBarrier: NativeAccountDeletionBarrierLifecycle | null = null;
let nativeAccountDeletionBarrierEnsure: Promise<void> | null = null;
let nativeAccountDeletionBarrierLane: Promise<void> = Promise.resolve();

function requireNativeAccountDeletionBarrierEpoch(): string {
  const lifecycle = nativeAccountDeletionBarrier;
  if (!lifecycle) {
    throw new Error('Native notification privacy barrier receipt is unavailable.');
  }
  return lifecycle.displayEpoch;
}

function runNativeAccountDeletionBarrierTransition<T>(
  transition: () => Promise<T>,
): Promise<T> {
  const task = nativeAccountDeletionBarrierLane.then(transition, transition);
  nativeAccountDeletionBarrierLane = task.then(
    () => undefined,
    () => undefined,
  );
  return task;
}

function createTerminalNativeRecoveryDependencies(
  native: NativeNotificationCoordinatorAdapter,
): NativeTerminalRecoveryDependencies {
  const existing = terminalNativeRecoveryDependencies;
  if (existing) {
    return existing;
  }

  const dependencies: NativeTerminalRecoveryDependencies = {
    native,
    storage: createNativeAuthSecureStorageAdapter(),
    barrier: {
      beginAccountMutation: (reason) => native.beginAccountMutation(reason),
      finalizeAccountMutation: (reason, displayEpoch) =>
        native.finalizeAccountMutation(reason, displayEpoch),
      getAccountMutationLineage: () => native.getAccountMutationLineage(),
    },
  };
  terminalNativeRecoveryDependencies = dependencies;
  setNativeAuthSecureStorageAdapter(dependencies.storage);
  setNativeAuthNotificationBarrier(dependencies.barrier);
  return dependencies;
}

function clearNativeAuthRuntimeDependencies(): void {
  if (terminalNativeRecoveryDependencies) {
    return;
  }
  setNativeAuthSecureStorageAdapter(null);
  setNativeAuthNotificationBarrier(null);
}

function releaseTerminalNativeRecoveryDependencies(
  dependencies: NativeTerminalRecoveryDependencies,
): void {
  if (terminalNativeRecoveryDependencies !== dependencies) {
    return;
  }
  terminalNativeRecoveryDependencies = null;
  setNativeAuthNotificationBarrier(null);
  setNativeAuthSecureStorageAdapter(null);
}

function isNativeRuntimeAdmissionOpen(runtime: NativeNotificationRuntime): boolean {
  return !terminalNativeRecoveryRequired && !runtime.disposed && !runtime.recoveryRequired;
}

async function persistNativeRecoveryRequiredMarker(
  storage: NativeAuthSecureStorageAdapter,
  lineage: NativeAccountMutationLineage,
): Promise<void> {
  const existingMarker = await storage.get(NATIVE_AUTH_RECOVERY_REQUIRED_MARKER_KEY);
  if (existingMarker !== null) {
    return;
  }
  await storage.set(
    NATIVE_AUTH_RECOVERY_REQUIRED_MARKER_KEY,
    JSON.stringify({
      version: 2,
      reason: lineage.reason,
      display_epoch: lineage.display_epoch,
    }),
  );
}

async function hasAuthoritativeDeletionRecoveryJournal(
  storage: NativeAuthSecureStorageAdapter,
): Promise<boolean> {
  const [operation, status] = await Promise.all([
    storage.get(DELETION_OPERATION_STORAGE_KEY),
    storage.get(DELETION_STATUS_STORAGE_KEY),
  ]);
  return parseStoredDeletionOperationRecord(operation).kind !== 'absent'
    || parseStoredDeletionStatusRecord(status).kind !== 'absent';
}
async function closeNativeAdmissionForTerminalRecovery(
  dependencies: NativeTerminalRecoveryDependencies,
): Promise<void> {
  const { native, storage } = dependencies;
  const finalizeCompletedLineage = async (
    candidate: NativeAccountMutationLineage,
  ): Promise<boolean> => {
    if (
      candidate.phase !== 'completed'
      || !hasZeroNativeNotificationCounts(candidate.zero_counts)
    ) {
      return false;
    }
    const finalizeReceipt = await native.finalizeAccountMutation(
      candidate.reason,
      candidate.display_epoch,
    );
    return hasZeroNotificationCounts(finalizeReceipt)
      && finalizeReceipt.display_epoch === candidate.display_epoch;
  };

  let preparation: Awaited<ReturnType<typeof prepareNativeTerminalRecovery>>;
  try {
    preparation = await prepareNativeTerminalRecovery();
  } catch {
    return;
  }

  // A durable native-auth journal is authoritative. Its recovery owns any
  // matching lineage and must finish before a credential-free fallback can begin.
  if (preparation !== 'credential_free') {
    return;
  }
  try {
    if (await hasAuthoritativeDeletionRecoveryJournal(storage)) {
      return;
    }
  } catch {
    return;
  }

  let lineage: NativeAccountMutationLineage | null;
  try {
    lineage = await native.getAccountMutationLineage();
  } catch {
    return;
  }

  if (lineage) {
    try {
      if (await finalizeCompletedLineage(lineage)) {
        return;
      }
    } catch {
      // Preserve the exact native owner below when replay finalization is unavailable.
    }
    try {
      await persistNativeRecoveryRequiredMarker(storage, lineage);
    } catch {
      // Native coordinator state remains closed when exact-owner marker persistence fails.
    }
    return;
  }

  try {
    const beginReceipt = await native.beginAccountMutation('logout');
    await persistNativeRecoveryRequiredMarker(storage, {
      phase: 'awaiting_finalize',
      reason: 'logout',
      display_epoch: beginReceipt.display_epoch,
      zero_counts: beginReceipt.zero_counts,
    });
  } catch {
    // Credential-free fallback may only persist an exact receipt returned by native.
  }
}

function ensureTerminalNativeAdmissionRecovery(
  native: NativeNotificationCoordinatorAdapter,
): Promise<void> {
  const dependencies = createTerminalNativeRecoveryDependencies(native);
  terminalNativeAdmissionRecovery ??= closeNativeAdmissionForTerminalRecovery(dependencies);
  return terminalNativeAdmissionRecovery;
}

function fenceNativeNotificationRuntime(runtime: NativeNotificationRuntime): void {
  runtime.recoveryRequired = true;
  runtime.session = null;
  runtime.sessionTransitionGeneration = null;
  runtime.retainedFcmToken = null;
  clearFcmTokenRetry(runtime);
}

function enterTerminalNativeRecovery(runtime?: NativeNotificationRuntime | null): void {
  const shouldNotify = !terminalNativeRecoveryRequired;
  terminalNativeRecoveryRequired = true;
  invalidateNativeAuthSessionForMutation();
  clearAccessToken();
  setNativeAuthSessionBinder(null);

  const runtimeToRecover = runtime ?? activeNativeNotificationRuntime;
  const recoveryDependencies = createTerminalNativeRecoveryDependencies(
    runtimeToRecover?.native ?? nativeNotificationAdapter,
  );
  if (runtimeToRecover) {
    fenceNativeNotificationRuntime(runtimeToRecover);
  }

  void (async () => {
    try {
      if (runtimeToRecover) {
        await ensureTerminalNativeAdmissionRecovery(runtimeToRecover.native);
        await disposeNativeNotificationRuntime(runtimeToRecover);
      } else {
        await ensureTerminalNativeAdmissionRecovery(nativeNotificationAdapter);
      }
    } finally {
      releaseTerminalNativeRecoveryDependencies(recoveryDependencies);
      if (shouldNotify) {
        window.dispatchEvent(new Event('zerotime:native-session-recovery-required'));
      }
    }
  })().catch(() => {
    // JS authentication stays invalidated and native content remains fenced on recovery failure.
  });
}

function awaitNativeStartup<T>(
  startup: Promise<T>,
  onTimeout: () => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      onTimeout();
      reject(new Error('Native startup reconciliation timed out.'));
    }, NATIVE_STARTUP_TIMEOUT_MS);

    void startup.then(
      (value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

function toSafeNoticeId(value: string): number | null {
  const noticeId = Number(value);
  return Number.isSafeInteger(noticeId) && noticeId >= 1 ? noticeId : null;
}

function isRuntimeSessionCurrent(
  runtime: NativeNotificationRuntime,
  session: NativeAuthSession,
  transitionGeneration: number,
): boolean {
  return (
    isNativeRuntimeAdmissionOpen(runtime)
    && runtime.session === session
    && runtime.sessionTransitionGeneration === transitionGeneration
    && isNativeAuthSessionCurrent(session.sessionId, transitionGeneration)
  );
}

async function consumeAuthorizedNotificationTap(
  runtime: NativeNotificationRuntime,
  data: NotificationTapPayload,
): Promise<void> {
  const session = runtime.session;
  const transitionGeneration = runtime.sessionTransitionGeneration;
  const noticeId = toSafeNoticeId(data.notice_id);
  if (
    !session
    || transitionGeneration === null
    || noticeId === null
    || !isRuntimeSessionCurrent(runtime, session, transitionGeneration)
  ) {
    return;
  }

  const task = runtime.authorizedTapLane.then(() => {
    if (!isRuntimeSessionCurrent(runtime, session, transitionGeneration)) {
      return;
    }
    window.location.assign(`/notifications/?notice_id=${encodeURIComponent(String(noticeId))}`);
  });
  runtime.authorizedTapLane = task.then(
    () => undefined,
    () => undefined,
  );
  return task;
}

async function abortDisplayOperation(
  runtime: NativeNotificationRuntime,
  operationId: string,
  reason: NativeOperationAbortReason,
): Promise<void> {
  try {
    await runtime.native.abortDisplayAuthorization(operationId, reason);
  } catch {
    // Native records the operation as unresolved/closed for next-launch recovery.
  }
}

async function handleDataOnlyPush(
  runtime: NativeNotificationRuntime,
  data: { readonly delivery_id: string; readonly notice_id: string },
): Promise<void> {
  if (!isNativeRuntimeAdmissionOpen(runtime)) {
    return;
  }

  let operation: NativeAuthorizationOperation | null = null;
  try {
    operation = await runtime.native.beginDisplayAuthorization(data);
    if (!operation) {
      return;
    }
    if (!isNativeRuntimeAdmissionOpen(runtime)) {
      await abortDisplayOperation(runtime, operation.operationId, 'stale_operation');
      return;
    }

    if (!(await runtime.native.scheduleAuthorizedNotification(operation.operationId))) {
      await abortDisplayOperation(runtime, operation.operationId, 'native_failed');
    }
  } catch {
    if (operation) {
      await abortDisplayOperation(runtime, operation.operationId, 'transport_failed');
    }
  }
}

async function handleNotificationTap(
  runtime: NativeNotificationRuntime,
  data: NotificationTapPayload,
): Promise<void> {
  if (!isNativeRuntimeAdmissionOpen(runtime)) {
    return;
  }

  let operation: NativeAuthorizationOperation | null = null;
  try {
    operation = await runtime.native.beginTapAuthorization(data);
    if (!operation) {
      return;
    }
    if (!isNativeRuntimeAdmissionOpen(runtime)) {
      await runtime.native.abortTapAuthorization(operation.operationId, 'stale_operation');
      return;
    }

    if (!(await runtime.native.completeTapAuthorization(operation.operationId))) {
      await runtime.native.abortTapAuthorization(operation.operationId, 'native_failed');
      return;
    }

    await consumeAuthorizedNotificationTap(runtime, data);
  } catch {
    if (operation) {
      try {
        await runtime.native.abortTapAuthorization(operation.operationId, 'transport_failed');
      } catch {
        // Native retains bounded operation evidence and performs recovery cleanup.
      }
    }
  }
}

function getFcmTokenSyncWorkKey(work: FcmTokenSyncWork): string {
  return `${work.session.sessionId}:${work.transitionGeneration}:${work.session.bindingGeneration}:${work.token}`;
}

function isFcmTokenSyncWorkBound(
  runtime: NativeNotificationRuntime,
  work: FcmTokenSyncWork,
): boolean {
  return (
    isNativeRuntimeAdmissionOpen(runtime)
    && runtime.session === work.session
    && runtime.sessionTransitionGeneration === work.transitionGeneration
  );
}

function clearFcmTokenRetry(runtime: NativeNotificationRuntime): void {
  if (runtime.fcmTokenRetryTimer !== null) {
    window.clearTimeout(runtime.fcmTokenRetryTimer);
    runtime.fcmTokenRetryTimer = null;
  }
  runtime.fcmTokenRetryAttempt = 0;
  runtime.fcmTokenRetryWorkKey = null;
}

function failNativeNotificationRuntime(runtime: NativeNotificationRuntime): void {
  if (terminalNativeRecoveryRequired) {
    return;
  }

  enterTerminalNativeRecovery(runtime);
}

function scheduleFcmTokenSyncRetry(
  runtime: NativeNotificationRuntime,
  work: FcmTokenSyncWork,
): void {
  if (!isNativeRuntimeAdmissionOpen(runtime)) {
    return;
  }
  if (
    runtime.retainedFcmToken !== work.token
    || !isFcmTokenSyncWorkBound(runtime, work)
  ) {
    clearFcmTokenRetry(runtime);
    enqueueRetainedFcmTokenSync(runtime);
    return;
  }

  const workKey = getFcmTokenSyncWorkKey(work);
  if (runtime.fcmTokenRetryWorkKey !== workKey) {
    clearFcmTokenRetry(runtime);
    runtime.fcmTokenRetryWorkKey = workKey;
  }

  const delay = FCM_TOKEN_SYNC_RETRY_DELAYS_MS[runtime.fcmTokenRetryAttempt];
  if (delay === undefined) {
    failNativeNotificationRuntime(runtime);
    return;
  }

  runtime.fcmTokenRetryAttempt += 1;
  runtime.fcmTokenRetryTimer = window.setTimeout(() => {
    runtime.fcmTokenRetryTimer = null;
    if (
      !isNativeRuntimeAdmissionOpen(runtime)
      || runtime.fcmTokenRetryWorkKey !== workKey
    ) {
      return;
    }
    enqueueRetainedFcmTokenSync(runtime);
  }, delay);
}

function hasSynchronizedFcmToken(
  runtime: NativeNotificationRuntime,
  work: FcmTokenSyncWork,
): boolean {
  const lastSync = runtime.lastFcmTokenSync;
  return (
    lastSync?.token === work.token
    && lastSync.sessionId === work.session.sessionId
    && lastSync.transitionGeneration === work.transitionGeneration
    && lastSync.bindingGeneration === work.session.bindingGeneration
  );
}

function enqueueRetainedFcmTokenSync(runtime: NativeNotificationRuntime): void {
  const token = runtime.retainedFcmToken;
  const session = runtime.session;
  const transitionGeneration = runtime.sessionTransitionGeneration;
  if (
    !isNativeRuntimeAdmissionOpen(runtime)
    || !token
    || !session
    || transitionGeneration === null
  ) {
    return;
  }

  const work: FcmTokenSyncWork = { token, session, transitionGeneration };
  if (hasSynchronizedFcmToken(runtime, work)) {
    clearFcmTokenRetry(runtime);
    return;
  }

  const workKey = getFcmTokenSyncWorkKey(work);
  if (
    runtime.fcmTokenRetryTimer !== null
    && runtime.fcmTokenRetryWorkKey === workKey
  ) {
    return;
  }
  if (runtime.fcmTokenSyncKeys.has(workKey)) {
    return;
  }

  runtime.fcmTokenSyncKeys.add(workKey);
  const task = runtime.fcmTokenSyncLane.then(
    () => syncFcmToken(runtime, work),
    () => syncFcmToken(runtime, work),
  );
  runtime.fcmTokenSyncLane = task.then(
    () => undefined,
    () => undefined,
  );
  void task.then(
    (result) => {
      runtime.fcmTokenSyncKeys.delete(workKey);
      if (!isNativeRuntimeAdmissionOpen(runtime)) {
        return;
      }
      if (result === 'awaiting_session') {
        scheduleFcmTokenSyncRetry(runtime, work);
        return;
      }
      if (result === 'synchronized') {
        clearFcmTokenRetry(runtime);
      }
      enqueueRetainedFcmTokenSync(runtime);
    },
    (error: unknown) => {
      runtime.fcmTokenSyncKeys.delete(workKey);
      if (!isNativeRuntimeAdmissionOpen(runtime)) {
        return;
      }
      if (error instanceof FcmTokenSyncTerminalError) {
        failNativeNotificationRuntime(runtime);
        return;
      }
      scheduleFcmTokenSyncRetry(runtime, work);
    },
  );
}

function retainNativeFcmToken(runtime: NativeNotificationRuntime, value: string): void {
  const token = value.trim();
  if (!token || !isNativeRuntimeAdmissionOpen(runtime)) {
    return;
  }
  if (runtime.retainedFcmToken !== token) {
    runtime.retainedFcmToken = token;
    clearFcmTokenRetry(runtime);
  }
  enqueueRetainedFcmTokenSync(runtime);
}

async function syncFcmToken(
  runtime: NativeNotificationRuntime,
  work: FcmTokenSyncWork,
): Promise<FcmTokenSyncResult> {
  // Binding publishes the session after the coordinator acknowledges its native transition.
  await Promise.resolve();
  if (!isFcmTokenSyncWorkBound(runtime, work)) {
    return 'stale';
  }
  if (!isRuntimeSessionCurrent(runtime, work.session, work.transitionGeneration)) {
    return 'awaiting_session';
  }

  const manifest = readValidatedNativeReleaseManifest();
  const permission = await runtime.native.getDisplayPermission();
  if (!isFcmTokenSyncWorkBound(runtime, work)) {
    return 'stale';
  }
  if (!isRuntimeSessionCurrent(runtime, work.session, work.transitionGeneration)) {
    return 'awaiting_session';
  }

  const generations = await mobileReleaseClient.registerInstallation(runtime.installationId, {
    platform: manifest.platform,
    environment: manifest.plane === 'prod' ? 'production' : 'beta',
    token_provider: 'fcm',
    token_type: 'fcm_registration',
    fcm_token: work.token,
    permission_status: permission,
    expected_binding_generation: work.session.bindingGeneration,
  });
  if (
    !isFcmTokenSyncWorkBound(runtime, work)
    || !isRuntimeSessionCurrent(runtime, work.session, work.transitionGeneration)
  ) {
    return 'stale';
  }

  try {
    if (!(await runtime.native.updateSessionGenerations({
      sessionId: work.session.sessionId,
      bindingGeneration: generations.binding_generation,
      tokenGeneration: generations.token_generation,
    }))) {
      throw new FcmTokenSyncTerminalError(
        'Native FCM generation update was not acknowledged.',
      );
    }
  } catch (error) {
    if (error instanceof FcmTokenSyncTerminalError) {
      throw error;
    }
    throw new FcmTokenSyncTerminalError(
      'Native FCM generation update could not be completed.',
    );
  }
  if (
    !isFcmTokenSyncWorkBound(runtime, work)
    || !isRuntimeSessionCurrent(runtime, work.session, work.transitionGeneration)
  ) {
    return 'stale';
  }

  try {
    await applyNativeAuthSessionGenerations(
      work.session.sessionId,
      generations.binding_generation,
      generations.token_generation,
      work.transitionGeneration,
    );
  } catch {
    throw new FcmTokenSyncTerminalError(
      'Native FCM generations could not be published to secure storage.',
    );
  }
  if (!isRuntimeSessionCurrent(runtime, work.session, work.transitionGeneration)) {
    return 'stale';
  }

  runtime.session = {
    ...work.session,
    bindingGeneration: generations.binding_generation,
    tokenGeneration: generations.token_generation,
  };
  runtime.lastFcmTokenSync = {
    token: work.token,
    sessionId: work.session.sessionId,
    transitionGeneration: work.transitionGeneration,
    bindingGeneration: generations.binding_generation,
  };
  return 'synchronized';
}

async function removeListenerHandles(
  listenerHandles: readonly NativeNotificationPluginListenerHandle[],
): Promise<void> {
  await Promise.allSettled(listenerHandles.map((handle) => handle.remove()));
}
async function disposeNativeNotificationRuntime(
  runtime: NativeNotificationRuntime,
): Promise<void> {
  if (runtime.disposed) {
    return;
  }

  runtime.disposed = true;
  runtime.session = null;
  runtime.sessionTransitionGeneration = null;
  runtime.retainedFcmToken = null;
  runtime.fcmTokenSyncKeys.clear();
  clearFcmTokenRetry(runtime);
  await removeListenerHandles(runtime.listenerHandles);
  if (nativeAccountDeletionBarrier?.runtime === runtime) {
    nativeAccountDeletionBarrier = null;
    nativeAccountDeletionBarrierEnsure = null;
  }


  if (activeNativeNotificationRuntime === runtime) {
    activeNativeNotificationRuntime = null;
    nativeNotificationRuntime = null;
    setNativeAuthSessionBinder(null);
    clearNativeAuthRuntimeDependencies();
  }
}

async function initializeNativeNotificationRuntime(): Promise<NativeNotificationRuntime | null> {
  if (!isNativeAuthPlatform() || terminalNativeRecoveryRequired) {
    return null;
  }
  if (nativeNotificationRuntime) {
    return nativeNotificationRuntime;
  }

  setNativeAuthSecureStorageAdapter(createNativeAuthSecureStorageAdapter());
  nativeNotificationRuntime = (async () => {
    let nativeInitialized = false;
    try {
      const manifest = readValidatedNativeReleaseManifest();
      if (!(await nativeNotificationAdapter.initialize(manifest))) {
        throw new Error('Native notification coordinator initialization was not acknowledged.');
      }
      nativeInitialized = true;
      if (terminalNativeRecoveryRequired) {
        await ensureTerminalNativeAdmissionRecovery(nativeNotificationAdapter);
        return null;
      }

      const installationId = await nativeNotificationAdapter.getOrCreateInstallationId();
      if (terminalNativeRecoveryRequired) {
        await ensureTerminalNativeAdmissionRecovery(nativeNotificationAdapter);
        return null;
      }

      const listenerHandles: NativeNotificationPluginListenerHandle[] = [];
      const runtime: NativeNotificationRuntime = {
        installationId,
        native: nativeNotificationAdapter,
        listenerHandles,
        fcmTokenSyncKeys: new Set(),
        session: null,
        sessionTransitionGeneration: null,
        retainedFcmToken: null,
        lastFcmTokenSync: null,
        fcmTokenSyncLane: Promise.resolve(),
        fcmTokenRetryTimer: null,
        fcmTokenRetryAttempt: 0,
        fcmTokenRetryWorkKey: null,
        authorizedTapLane: Promise.resolve(),
        disposed: false,
        recoveryRequired: false,
      };

      setNativeAuthNotificationBarrier({
        beginAccountMutation: async (reason) => {
          const receipt = await runtime.native.beginAccountMutation(reason);
          runtime.session = null;
          runtime.sessionTransitionGeneration = null;
          clearFcmTokenRetry(runtime);
          return receipt;
        },
        finalizeAccountMutation: async (reason, displayEpoch) => {
          const receipt = await runtime.native.finalizeAccountMutation(reason, displayEpoch);
          const lifecycle = nativeAccountDeletionBarrier;
          if (
            reason === 'deletion'
            && lifecycle?.runtime === runtime
            && lifecycle.reason === reason
            && lifecycle.displayEpoch === receipt.display_epoch
            && hasZeroNotificationCounts(receipt)
          ) {
            nativeAccountDeletionBarrier = null;
            nativeAccountDeletionBarrierEnsure = null;
          }
          return receipt;
        },
        getAccountMutationLineage: () => runtime.native.getAccountMutationLineage(),
      });
      setNativeAuthSessionBinder({
        bindSession: (session) => bindNativeNotificationSession(session),
      });

      try {
        listenerHandles.push(await runtime.native.addDataOnlyPushListener((data) => {
          void handleDataOnlyPush(runtime, data);
        }));
        listenerHandles.push(await runtime.native.addNotificationTapListener((data) => {
          void handleNotificationTap(runtime, data);
        }));
        listenerHandles.push(await runtime.native.addFcmTokenListener((data) => {
          retainNativeFcmToken(runtime, data.token);
        }));

        if (!isNativeRuntimeAdmissionOpen(runtime)) {
          fenceNativeNotificationRuntime(runtime);
          await ensureTerminalNativeAdmissionRecovery(runtime.native);
          await removeListenerHandles(listenerHandles);
          return null;
        }

        activeNativeNotificationRuntime = runtime;
        return runtime;
      } catch (error) {
        fenceNativeNotificationRuntime(runtime);
        enterTerminalNativeRecovery(runtime);
        throw error;
      }
    } catch (error) {
      if (nativeInitialized) {
        enterTerminalNativeRecovery();
        void ensureTerminalNativeAdmissionRecovery(nativeNotificationAdapter);
      }
      throw error;
    }
  })().catch(() => {
    setNativeAuthSessionBinder(null);
    clearNativeAuthRuntimeDependencies();
    console.error('Native notification coordinator is unavailable.');
    return null;
  });

  return nativeNotificationRuntime;
}

async function requestFirstForegroundDisplayPermission(
  runtime: NativeNotificationRuntime,
): Promise<void> {
  if (
    firstForegroundPermissionRequested
    || !isNativeRuntimeAdmissionOpen(runtime)
  ) {
    return;
  }
  if (foregroundPermissionRequest) {
    return foregroundPermissionRequest;
  }

  const request = (async () => {
    const permission = await runtime.native.getDisplayPermission();
    if (
      !isNativeRuntimeAdmissionOpen(runtime)
      || firstForegroundPermissionRequested
    ) {
      return;
    }
    if (permission === 'not_determined') {
      firstForegroundPermissionRequested = true;
      await runtime.native.requestDisplayPermission();
      return;
    }

    firstForegroundPermissionRequested = true;
  })();
  foregroundPermissionRequest = request;
  void request.then(
    () => {
      if (foregroundPermissionRequest === request) {
        foregroundPermissionRequest = null;
      }
    },
    () => {
      if (foregroundPermissionRequest === request) {
        foregroundPermissionRequest = null;
      }
    },
  );
  return request;
}

async function recoverNativeAccountDeletionBeforeSessionBind(
  runtime: NativeNotificationRuntime,
): Promise<boolean> {
  return runNativeAccountDeletionBarrierTransition(async () => {
    const storage = createNativeAuthSecureStorageAdapter();
    const operationJournal = parseStoredDeletionOperationRecord(
      await storage.get(DELETION_OPERATION_STORAGE_KEY),
    );
    if (operationJournal.kind === 'corrupt') {
      throw new Error('Native account deletion operation journal was malformed.');
    }

    const operation = operationJournal.kind === 'valid' ? operationJournal.value : null;
    const isReauthPendingDeletionJournal = operation?.kind === 'request'
      && operation.phase === 'reauth_pending';
    const isNativeBeginPendingDeletionJournal = operation?.kind === 'request'
      && operation.phase === 'native_begin_pending';
    const isPreAcknowledgementDeletionJournal =
      (operation?.kind === 'request' || operation?.kind === 'cancel')
      && (operation.phase === 'sending' || operation.phase === 'outcome_unknown');
    const isAcknowledgedDeletionJournal =
      (operation?.kind === 'request' || operation?.kind === 'cancel')
      && (
        operation.phase === 'server_acknowledged'
        || operation.phase === 'local_cleanup_pending'
      );
    const isRequestLocalComplete = operation?.kind === 'request'
      && operation.phase === 'local_complete';
    const isResolvedCancellation = operation?.kind === 'cancel'
      && operation.phase === 'local_complete';
    const requiresDeletionLifecycle = isNativeBeginPendingDeletionJournal
      || isPreAcknowledgementDeletionJournal
      || isAcknowledgedDeletionJournal
      || isRequestLocalComplete;

    let lineage = await runtime.native.getAccountMutationLineage();
    if (!lineage && isNativeBeginPendingDeletionJournal) {
      const receipt = await runtime.native.beginAccountMutation('deletion');
      if (!hasZeroNotificationCounts(receipt)) {
        throw new Error('Native account deletion recovery could not establish a zero-state owner.');
      }
      lineage = {
        phase: 'awaiting_finalize',
        reason: 'deletion',
        display_epoch: receipt.display_epoch,
        zero_counts: receipt.zero_counts,
      };
    }
    if (!lineage) {
      if (requiresDeletionLifecycle) {
        throw new Error('Native account deletion operation lost its exact native lineage.');
      }
      return false;
    }
    if (lineage.reason !== 'deletion') {
      if (requiresDeletionLifecycle || isResolvedCancellation) {
        throw new Error('Native account deletion operation did not match its native lineage.');
      }
      return false;
    }

    const preAcknowledgementLineageValid = lineage.phase === 'awaiting_finalize'
      || (operation?.kind === 'cancel' && lineage.phase === 'completed');
    const lineageIsValid = hasZeroNativeNotificationCounts(lineage.zero_counts)
      && (
        (isNativeBeginPendingDeletionJournal && lineage.phase === 'awaiting_finalize')
        || (isPreAcknowledgementDeletionJournal && preAcknowledgementLineageValid)
        || (
          isAcknowledgedDeletionJournal
          && (lineage.phase === 'awaiting_finalize' || lineage.phase === 'completed')
        )
        || (isRequestLocalComplete && lineage.phase === 'completed')
        || (isResolvedCancellation && lineage.phase === 'completed')
      );
    if (!lineageIsValid) {
      throw new Error('Native account deletion recovery could not prove its exact owner.');
    }
    if (isResolvedCancellation) {
      releaseNativeAuthSessionAfterDeletionCancellation();
      return false;
    }
    if (isReauthPendingDeletionJournal) {
      throw new Error('Native account deletion reauthentication intent unexpectedly owned native lineage.');
    }

    invalidateNativeAuthSessionForMutation();
    clearAccessToken();
    const recoveredLifecycle: NativeAccountDeletionBarrierLifecycle = {
      runtime,
      reason: 'deletion',
      displayEpoch: lineage.display_epoch,
    };
    const existingLifecycle = nativeAccountDeletionBarrier;
    if (
      existingLifecycle
      && (
        existingLifecycle.runtime !== runtime
        || existingLifecycle.reason !== recoveredLifecycle.reason
        || existingLifecycle.displayEpoch !== recoveredLifecycle.displayEpoch
      )
    ) {
      throw new Error('Native account deletion recovery conflicted with an active owner.');
    }

    nativeAccountDeletionBarrier = recoveredLifecycle;
    nativeAccountDeletionBarrierEnsure = null;
    runtime.session = null;
    runtime.sessionTransitionGeneration = null;
    return true;
  });
}

async function bindNativeNotificationSession(
  session: NativeAuthSession,
): Promise<NativeAuthSessionBindResult> {
  const runtime = await initializeNativeNotificationRuntime();
  if (!runtime || !isNativeRuntimeAdmissionOpen(runtime)) {
    return 'blocked';
  }
  try {
    if (await recoverNativeAccountDeletionBeforeSessionBind(runtime)) {
      return 'blocked';
    }
  } catch {
    return 'blocked';
  }
  const bound = await runtime.native.bindSession({
    sessionId: session.sessionId,
    authVersion: String(session.authVersion),
    bindingGeneration: session.bindingGeneration,
    tokenGeneration: session.tokenGeneration,
    authorizationBearer: session.authorizationBearer,
  });
  if (!bound || !isNativeRuntimeAdmissionOpen(runtime)) {
    return 'failed';
  }

  runtime.session = session;
  runtime.sessionTransitionGeneration = getNativeAuthSessionTransitionGeneration();
  enqueueRetainedFcmTokenSync(runtime);
  return 'bound';
}

async function beginNativeAccountMutation(
  runtime: NativeNotificationRuntime,
  reason: AccountMutationReason,
): Promise<string> {
  const receipt = await runtime.native.beginAccountMutation(reason);
  if (!hasZeroNotificationCounts(receipt)) {
    throw new Error('Native notification privacy barrier did not acknowledge zero state.');
  }
  return receipt.display_epoch;
}

/**
 * Native owns the durable deletion admission state. This runtime record only
 * serializes same-process callers and binds the native receipt epoch to its
 * eventual finalization.
 */
export async function ensureNativeAccountDeletionBarrier(): Promise<string | null> {
  if (!isNativeAuthPlatform()) {
    return null;
  }

  if (nativeAccountDeletionBarrier) {
    return nativeAccountDeletionBarrier.displayEpoch;
  }
  if (nativeAccountDeletionBarrierEnsure) {
    await nativeAccountDeletionBarrierEnsure;
    return requireNativeAccountDeletionBarrierEpoch();
  }

  const ensure = runNativeAccountDeletionBarrierTransition(async () => {
    if (nativeAccountDeletionBarrier) {
      return;
    }

    invalidateNativeAuthSessionForMutation();
    const runtime = await initializeNativeNotificationRuntime();
    if (!runtime) {
      throw new Error('Native notification privacy barrier is unavailable.');
    }

    runtime.session = null;
    runtime.sessionTransitionGeneration = null;
    const displayEpoch = await beginNativeAccountMutation(runtime, 'deletion');
    nativeAccountDeletionBarrier = {
      runtime,
      reason: 'deletion',
      displayEpoch,
    };
  });
  nativeAccountDeletionBarrierEnsure = ensure;
  void ensure.then(
    () => {
      if (nativeAccountDeletionBarrierEnsure === ensure) {
        nativeAccountDeletionBarrierEnsure = null;
      }
    },
    () => {
      if (nativeAccountDeletionBarrierEnsure === ensure) {
        nativeAccountDeletionBarrierEnsure = null;
      }
    },
  );
  await ensure;
  return requireNativeAccountDeletionBarrierEpoch();
}

/**
 * A server-authoritative terminal or cancelled deletion outcome must close the
 * matching native mutation exactly once. Native retains the terminal state
 * across component remounts and process restarts.
 */
export async function finalizeNativeAccountDeletionBarrier(
  callerDisplayEpoch: string,
): Promise<void> {
  if (!isNativeAuthPlatform()) {
    return;
  }

  return runNativeAccountDeletionBarrierTransition(async () => {
    const lifecycle = nativeAccountDeletionBarrier;
    if (!lifecycle) {
      throw new Error('Native deletion barrier must be established before finalization.');
    }
    if (
      lifecycle.reason !== 'deletion'
      || lifecycle.displayEpoch !== callerDisplayEpoch
    ) {
      throw new Error('Native deletion barrier owner did not match finalization.');
    }

    const runtime = lifecycle.runtime;
    const receipt = await runtime.native.finalizeAccountMutation(
      'deletion',
      callerDisplayEpoch,
    );
    if (
      !hasZeroNotificationCounts(receipt)
      || receipt.display_epoch !== callerDisplayEpoch
    ) {
      throw new Error('Native notification privacy barrier finalization was not acknowledged.');
    }

    if (nativeAccountDeletionBarrier === lifecycle) {
      nativeAccountDeletionBarrier = null;
      nativeAccountDeletionBarrierEnsure = null;
    }
  });
}

/** @deprecated Use ensureNativeAccountDeletionBarrier for durable lifecycle ownership. */
export async function beginNativeAccountDeletionBarrier(): Promise<void> {
  await ensureNativeAccountDeletionBarrier();
}

// QueryClient 인스턴스를 외부에서 접근할 수 있도록 export
let globalQueryClient: QueryClient | null = null;

export function getQueryClient() {
  return globalQueryClient;
}

const AuthInitContext = createContext<boolean>(false);

export function useAuthInitialized() {
  return useContext(AuthInitContext);
}

function NativeRuntimeInitializer() {
  useEffect(() => {
    try {
      if (!isNativeAuthPlatform()) {
        return;
      }
    } catch {
      // AuthInitializer renders the fail-closed startup recovery surface.
      return;
    }

    let unsubscribe: (() => void) | undefined;
    let disposed = false;
    let runtime: NativeNotificationRuntime | null = null;
    void initializeNativeNotificationRuntime().then((resolvedRuntime) => {
      if (!resolvedRuntime) {
        return;
      }
      runtime = resolvedRuntime;
      if (disposed) {
        void disposeNativeNotificationRuntime(resolvedRuntime);
        return;
      }
      if (!isNativeRuntimeAdmissionOpen(resolvedRuntime)) {
        enterTerminalNativeRecovery(resolvedRuntime);
        return;
      }

      unsubscribe = subscribeToNativeAuthCallbacks(
        (result) => {
          if (
            !disposed
            && isNativeRuntimeAdmissionOpen(resolvedRuntime)
          ) {
            window.location.assign(result.redirectTo);
          }
        },
        () => {
          console.error('Native OAuth callback was rejected.');
          enterTerminalNativeRecovery(resolvedRuntime);
        },
      );
    }).catch(() => {
      console.error('Native runtime initialization failed.');
      enterTerminalNativeRecovery(runtime);
    });

    return () => {
      disposed = true;
      unsubscribe?.();
      if (runtime) {
        void disposeNativeNotificationRuntime(runtime);
      }
    };
  }, []);

  return null;
}

function NativeForegroundPermissionRequester({
  runtime,
}: {
  runtime: NativeNotificationRuntime | null;
}) {
  useEffect(() => {
    if (!runtime) {
      return;
    }

    let active = true;
    void requestFirstForegroundDisplayPermission(runtime).catch(() => {
      if (active) {
        console.error('Native display permission request failed.');
      }
    });
    return () => {
      active = false;
    };
  }, [runtime]);

  return null;
}

function NativeStartupRecovery() {
  return (
    <main role="alert" aria-live="assertive">
      <h1>Secure startup could not be completed</h1>
      <p>Reload the app to retry native session recovery.</p>
      <button type="button" onClick={() => window.location.reload()}>
        Reload app
      </button>
    </main>
  );
}

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const [startupStatus, setStartupStatus] = useState<'pending' | 'ready' | 'recovery'>('pending');
  const startupRef = useRef<Promise<void> | null>(null);
  const nativeRuntimeRef = useRef<NativeNotificationRuntime | null>(null);

  useEffect(() => {
    let active = true;

    const hideSplash = async () => {
      if (!Capacitor.isNativePlatform()) {
        return;
      }

      try {
        const { SplashScreen } = await import('@capacitor/splash-screen');
        await SplashScreen.hide();
      } catch {
        // The recovery state must remain visible even when the splash plugin is unavailable.
      }
    };
    const enterRecovery = () => {
      if (active) {
        setStartupStatus('recovery');
        void hideSplash();
      }
    };
    const enterStartupRecovery = () => {
      try {
        if (isNativeAuthPlatform()) {
          enterTerminalNativeRecovery(nativeRuntimeRef.current);
        }
      } catch {
        // The visible recovery surface remains the safe state when native runtime detection fails.
      }
      enterRecovery();
    };
    window.addEventListener('zerotime:native-session-recovery-required', enterRecovery);

    const reconcileStartup = async () => {
      if (!isNativeAuthPlatform()) {
        await initializeAuth();
        return;
      }

      const reconcileNativeStartup = async () => {
        const runtime = await initializeNativeNotificationRuntime();
        if (!runtime || !isNativeRuntimeAdmissionOpen(runtime)) {
          throw new Error('Native notification coordinator is unavailable.');
        }
        nativeRuntimeRef.current = runtime;
        const nativeAuthPreparation = await prepareNativeTerminalRecovery();
        if (nativeAuthPreparation === 'journal_pending') {
          throw new Error('Native authentication mutation journal recovery remains pending.');
        }
        if (await recoverNativeAccountDeletionBeforeSessionBind(runtime)) {
          return;
        }

        const restored = Boolean(await refreshNativeAuthSession());
        if (!isNativeRuntimeAdmissionOpen(runtime)) {
          throw new Error('Native session recovery became stale before publication.');
        }

        const session = getNativeAuthSession();
        if (restored && !session) {
          throw new Error('Native session restore was not bound before publication.');
        }
        if (!restored && session) {
          throw new Error('Native session recovery returned an inconsistent session state.');
        }
      };
      await awaitNativeStartup(
        reconcileNativeStartup(),
        () => enterTerminalNativeRecovery(nativeRuntimeRef.current),
      );
    };

    startupRef.current ??= reconcileStartup();
    void startupRef.current.then(
      () => {
        if (active && !terminalNativeRecoveryRequired) {
          setStartupStatus('ready');
          void hideSplash();
          return;
        }
        enterRecovery();
      },
      () => {
        console.error('Session recovery failed.');
        enterStartupRecovery();
      },
    );

    return () => {
      window.removeEventListener('zerotime:native-session-recovery-required', enterRecovery);
      active = false;
    };
  }, []);

  return (
    <AuthInitContext.Provider value={startupStatus === 'ready'}>
      {startupStatus === 'ready'
        ? (
            <>
              {children}
              <NativeForegroundPermissionRequester runtime={nativeRuntimeRef.current} />
            </>
          )
        : startupStatus === 'recovery'
          ? <NativeStartupRecovery />
          : null}
    </AuthInitContext.Provider>
  );
}

function UserHydrator() {
  useUser();
  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 1000 * 60,
          gcTime: 1000 * 60 * 5,
          refetchOnWindowFocus: false,
          retry: 1,
        },
      },
    });
    globalQueryClient = client;
    return client;
  });

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development' || !('serviceWorker' in navigator)) {
      return;
    }
    void navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        void registration.unregister();
      });
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <NativeRuntimeInitializer />
      <AuthInitializer>
        <UserHydrator />
        {children}
      </AuthInitializer>
    </QueryClientProvider>
  );
}
