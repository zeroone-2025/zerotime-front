'use client';

import { Capacitor } from '@capacitor/core';
import { useEffect, useRef, useState } from 'react';
import SocialLoginButton from '@/_components/auth/SocialLoginButton';
import { api, authApi, logoutUser, resetAuthState } from '@/_lib/api';
import {
  DELETION_CAPABILITY_STORAGE_KEY,
  DELETION_NATIVE_REAUTH_HANDOFF_STORAGE_KEY,
  DELETION_OPERATION_AUDIT_STORAGE_KEY,
  DELETION_OPERATION_STORAGE_KEY,
  DELETION_REAUTH_TRANSIENT_STORAGE_KEY,
  DELETION_STATUS_STORAGE_KEY,
  advanceDeletionOperation,
  createCodeChallenge,
  createDeletionOperation,
  createDeletionReauthOperation,
  createOpaqueValue,
  formatDeletionDeadline,
  localizedDeletionState,
  acknowledgeDeletionOperation,
  parseDeletionCancellationAcknowledgement,
  parseDeletionReauthTransaction,
  parseDeletionReauthTransactionIntent,
  parseDeletionReauthTransient,
  parseDeletionRequestAcknowledgement,
  parseDeletionStatus,
  parseNativeDeletionReauthHandoff,
  parseStoredDeletionCapability,
  parseStoredDeletionOperationRecord,
  parseStoredDeletionStatusRecord,
  type DeletionOperation,
  type DeletionProvider,
  type DeletionReauthTransient,
  type DeletionReauthTransactionIntent,
  type DeletionStatus,
  type StoredDeletionCapability,
  type StoredDeletionStatus,
} from '@/_lib/accountDeletion';
import { getAccessToken } from '@/_lib/auth/tokenStore';
import { createIdempotencyKey, MOBILE_RELEASE_CONTRACT } from '@/_lib/native/mobileRelease';
import {
  clearNativeAuthSessionAfterAccountDeletionAcknowledgement,
  createNativeAuthSecureStorageAdapter,
  isNativeAuthPlatform,
  releaseNativeAuthSessionAfterDeletionCancellation,
} from '@/_lib/native/nativeAuth';
import { useUserStore } from '@/_lib/store/useUserStore';
import {
  ensureNativeAccountDeletionBarrier,
  finalizeNativeAccountDeletionBarrier,
  getQueryClient,
} from '@/providers';
import type { OAuthProvider } from '@/_lib/api';

const PROVIDERS: readonly OAuthProvider[] = ['google', 'apple', 'naver', 'kakao'];
const PROVIDER_LABELS: Record<OAuthProvider, string> = {
  google: 'Google',
  apple: 'Apple',
  naver: '네이버',
  kakao: '카카오',
};

type DeletionStorage = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
};

function requireSessionStorage(): DeletionStorage {
  try {
    const storage = window.sessionStorage;
    storage.getItem(DELETION_STATUS_STORAGE_KEY);
    return {
      async get(key) {
        return storage.getItem(key);
      },
      async set(key, value) {
        storage.setItem(key, value);
      },
      async remove(key) {
        storage.removeItem(key);
      },
    };
  } catch {
    throw new Error('SESSION_STORAGE_UNAVAILABLE');
  }
}

async function getDeletionStorage(): Promise<DeletionStorage> {
  if (!isNativeAuthPlatform()) {
    return requireSessionStorage();
  }
  const secureStorage = createNativeAuthSecureStorageAdapter();
  if (!(await secureStorage.isAvailable())) {
    throw new Error('NATIVE_DELETION_TRACKING_SECURE_STORAGE_UNAVAILABLE');
  }
  return secureStorage;
}

function parseJson(value: string): unknown | null {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

async function readStoredStatusJournal(storage: DeletionStorage) {
  return parseStoredDeletionStatusRecord(await storage.get(DELETION_STATUS_STORAGE_KEY));
}

async function readStoredOperationJournal(storage: DeletionStorage) {
  return parseStoredDeletionOperationRecord(await storage.get(DELETION_OPERATION_STORAGE_KEY));
}

async function readStoredStatus(storage: DeletionStorage): Promise<StoredDeletionStatus | null> {
  const record = await readStoredStatusJournal(storage);
  if (record.kind === 'corrupt') {
    throw new Error('CORRUPT_DELETION_STATUS_JOURNAL');
  }
  return record.kind === 'valid' ? record.value : null;
}

async function readStoredOperation(storage: DeletionStorage): Promise<DeletionOperation | null> {
  const record = await readStoredOperationJournal(storage);
  if (record.kind === 'corrupt') {
    throw new Error('CORRUPT_DELETION_OPERATION_JOURNAL');
  }
  return record.kind === 'valid' ? record.value : null;
}

async function readStoredCapability(storage: DeletionStorage): Promise<StoredDeletionCapability | null> {
  if (isNativeAuthPlatform()) {
    const handoff = await storage.get(DELETION_NATIVE_REAUTH_HANDOFF_STORAGE_KEY);
    if (!handoff) return null;
    const parsed = parseNativeDeletionReauthHandoff(parseJson(handoff));
    if (parsed?.kind === 'capability') return parsed.capability;
    if (!parsed) await storage.remove(DELETION_NATIVE_REAUTH_HANDOFF_STORAGE_KEY);
    return null;
  }

  const value = await storage.get(DELETION_CAPABILITY_STORAGE_KEY);
  if (!value) return null;
  const capability = parseStoredDeletionCapability(parseJson(value));
  if (capability) return capability;
  await storage.remove(DELETION_CAPABILITY_STORAGE_KEY);
  return null;
}

async function clearStoredCapability(storage: DeletionStorage): Promise<void> {
  await storage.remove(
    isNativeAuthPlatform()
      ? DELETION_NATIVE_REAUTH_HANDOFF_STORAGE_KEY
      : DELETION_CAPABILITY_STORAGE_KEY,
  );
}

async function storeReauthTransient(storage: DeletionStorage, transient: DeletionReauthTransient): Promise<void> {
  const serialized = JSON.stringify(transient);
  if (isNativeAuthPlatform()) {
    await storage.set(
      DELETION_NATIVE_REAUTH_HANDOFF_STORAGE_KEY,
      JSON.stringify({ version: 1, kind: 'transient', transient }),
    );
    return;
  }
  await storage.set(DELETION_REAUTH_TRANSIENT_STORAGE_KEY, serialized);
}

async function clearReauthArtifacts(storage: DeletionStorage): Promise<void> {
  if (isNativeAuthPlatform()) {
    await storage.remove(DELETION_NATIVE_REAUTH_HANDOFF_STORAGE_KEY);
    return;
  }
  await storage.remove(DELETION_REAUTH_TRANSIENT_STORAGE_KEY);
  await storage.remove(DELETION_CAPABILITY_STORAGE_KEY);
}
type DeletionReauthTransactionArtifact =
  | { readonly kind: 'absent' }
  | { readonly kind: 'intent'; readonly value: DeletionReauthTransactionIntent }
  | { readonly kind: 'transient'; readonly value: DeletionReauthTransient }
  | { readonly kind: 'corrupt' };

async function storeReauthTransactionIntent(
  storage: DeletionStorage,
  intent: DeletionReauthTransactionIntent,
): Promise<void> {
  if (isNativeAuthPlatform()) {
    await storage.set(
      DELETION_NATIVE_REAUTH_HANDOFF_STORAGE_KEY,
      JSON.stringify({ version: 1, kind: 'transaction_pending', intent }),
    );
    return;
  }
  await storage.set(DELETION_REAUTH_TRANSIENT_STORAGE_KEY, JSON.stringify(intent));
}

async function readReauthTransactionArtifact(
  storage: DeletionStorage,
): Promise<DeletionReauthTransactionArtifact> {
  const storageKey = isNativeAuthPlatform()
    ? DELETION_NATIVE_REAUTH_HANDOFF_STORAGE_KEY
    : DELETION_REAUTH_TRANSIENT_STORAGE_KEY;
  const serialized = await storage.get(storageKey);
  if (!serialized) return { kind: 'absent' };
  const value = parseJson(serialized);

  if (isNativeAuthPlatform()) {
    const handoff = parseNativeDeletionReauthHandoff(value);
    if (handoff?.kind === 'transaction_pending') {
      return { kind: 'intent', value: handoff.intent };
    }
    if (handoff?.kind === 'transient') {
      return { kind: 'transient', value: handoff.transient };
    }
    if (value && typeof value === 'object') {
      const record = value as { readonly kind?: unknown; readonly intent?: unknown; readonly transient?: unknown };
      const expired = record.kind === 'transaction_pending'
        ? parseDeletionReauthTransactionIntent(record.intent, Date.now(), true)
        : record.kind === 'transient'
          ? parseDeletionReauthTransient(record.transient, Date.now(), true)
          : null;
      if (expired) {
        await storage.remove(storageKey);
        return { kind: 'absent' };
      }
    }
    return { kind: 'corrupt' };
  }

  const intent = parseDeletionReauthTransactionIntent(value);
  if (intent) return { kind: 'intent', value: intent };
  const transient = parseDeletionReauthTransient(value);
  if (transient) return { kind: 'transient', value: transient };
  if (
    parseDeletionReauthTransactionIntent(value, Date.now(), true)
    || parseDeletionReauthTransient(value, Date.now(), true)
  ) {
    await storage.remove(storageKey);
    return { kind: 'absent' };
  }
  return { kind: 'corrupt' };
}

function reauthArtifactMatches(
  artifact: DeletionReauthTransactionIntent | DeletionReauthTransient,
  purpose: 'request' | 'cancel',
  requestId: string,
  platform: 'web' | 'ios' | 'android',
): boolean {
  return artifact.purpose === purpose
    && artifact.requestId === requestId
    && artifact.platform === platform;
}

function createReauthTransactionIntent(
  provider: DeletionProvider,
  purpose: 'request' | 'cancel',
  requestId: string,
  platform: 'web' | 'ios' | 'android',
): DeletionReauthTransactionIntent {
  return {
    version: 1,
    provider,
    purpose,
    requestId,
    platform,
    state: createOpaqueValue(),
    nonce: createOpaqueValue(),
    codeVerifier: createOpaqueValue(),
    transactionIdempotencyKey: createIdempotencyKey(),
    exchangeIdempotencyKey: createIdempotencyKey(),
    createdAtUtc: new Date().toISOString(),
  };
}

function nativeReauthPlatform(): 'web' | 'ios' | 'android' {
  if (!isNativeAuthPlatform()) return 'web';
  const platform = Capacitor.getPlatform();
  if (platform === 'ios' || platform === 'android') return platform;
  throw new Error('UNSUPPORTED_NATIVE_REAUTH_PLATFORM');
}
function requiresDeletionJournalRecovery(
  stored: StoredDeletionStatus | null,
  operation: DeletionOperation | null,
): boolean {
  if (!stored) {
    if (!operation) return false;
    if (operation.kind === 'request') {
      return operation.phase !== 'reauth_pending'
        && operation.phase !== 'native_begin_pending'
        && operation.phase !== 'sending'
        && operation.phase !== 'outcome_unknown';
    }
    return operation.phase !== 'server_acknowledged'
      && operation.phase !== 'local_cleanup_pending'
      && operation.phase !== 'local_complete';
  }
  if (!operation || (operation.requestId !== undefined && operation.requestId !== stored.requestId)) {
    return true;
  }
  return false;
}

async function clearWebPersonalData(): Promise<void> {
  let cookieSessionError: unknown = null;
  try {
    await logoutUser();
  } catch (error) {
    cookieSessionError = error;
    resetAuthState();
  }

  try {
    window.localStorage.clear();
    const cacheNames = await window.caches?.keys();
    if (cacheNames) {
      await Promise.all(cacheNames.map((name) => window.caches.delete(name)));
    }
    getQueryClient()?.clear();
    useUserStore.getState().clearUser();
  } catch (error) {
    if (!cookieSessionError) cookieSessionError = error;
  }

  if (cookieSessionError) {
    throw new Error('WEB_LOCAL_CLEANUP_INCOMPLETE');
  }
}

function LegacyAccountDeletionPage() {
  const [storedStatus, setStoredStatus] = useState<StoredDeletionStatus | null>(null);
  const [status, setStatus] = useState<DeletionStatus | null>(null);
  const [operation, setOperation] = useState<DeletionOperation | null>(null);
  const [reauthCapability, setReauthCapability] = useState<StoredDeletionCapability | null>(null);
  const [hasActiveBearer, setHasActiveBearer] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [journalRecoveryRequired, setJournalRecoveryRequired] = useState(false);
  const cancellationInFlightRef = useRef(false);

  const persistOperation = async (storage: DeletionStorage, next: DeletionOperation) => {
    await storage.set(DELETION_OPERATION_STORAGE_KEY, JSON.stringify(next));
    setOperation(next);
  };
  const revalidateDispatchCapability = async (
    storage: DeletionStorage,
    purpose: 'request' | 'cancel',
    requestId: string,
  ): Promise<StoredDeletionCapability | null> => {
    const capability = await readStoredCapability(storage);
    if (
      !capability
      || capability.purpose !== purpose
      || capability.requestId !== requestId
      || Date.parse(capability.expiresAtUtc) <= Date.now()
    ) {
      await clearReauthArtifacts(storage);
      setReauthCapability(null);
      return null;
    }
    return capability;
  };
  const preserveCancellationRecoveryAudit = async (
    storage: DeletionStorage,
    requestId: string,
  ): Promise<void> => {
    const operationBytes = await storage.get(DELETION_OPERATION_STORAGE_KEY);
    await storage.set(
      DELETION_OPERATION_AUDIT_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        requestId,
        recoveredAtUtc: new Date().toISOString(),
        operationBytes,
      }),
    );
  };

  const loadStatus = async (stored: StoredDeletionStatus) => {
    setIsLoadingStatus(true);
    try {
      const response = await authApi.get<unknown>(
        `/v1/account-deletion/requests/${encodeURIComponent(stored.requestId)}/status`,
        {
          headers: {
            'X-ZeroTime-Contract': MOBILE_RELEASE_CONTRACT,
            'X-Deletion-Status-Handle': stored.statusHandle,
          },
        },
      );
      const validatedStatus = parseDeletionStatus(response.data, stored.requestId);
      setStatus(validatedStatus);
      setMessage(null);
      if (validatedStatus.state === 'cancelled') {
        await reconcileCancelledStatus(stored, validatedStatus);
      } else if (validatedStatus.state === 'finalized') {
        try {
          const displayEpoch = await ensureNativeAccountDeletionBarrier();
          if (displayEpoch) {
            await finalizeNativeAccountDeletionBarrier(displayEpoch);
          }
        } catch {
          setMessage('서버가 삭제 완료를 확인했지만 네이티브 알림 차단 종료를 확인하지 못했습니다.');
        }
      }
    } catch {
      setStatus(null);
      setMessage('삭제 예약 상태를 확인하지 못했습니다. 응답이 확인될 때까지 완료 상태로 표시하지 않습니다.');
    } finally {
      setIsLoadingStatus(false);
    }
  };

  const finishLocalCleanup = async (
    storage: DeletionStorage,
    acknowledgedOperation: DeletionOperation,
    stored: StoredDeletionStatus,
  ) => {
    try {
      const pending = acknowledgedOperation.phase === 'local_cleanup_pending'
        ? acknowledgedOperation
        : advanceDeletionOperation(acknowledgedOperation, 'local_cleanup_pending');
      await persistOperation(storage, pending);

      if (isNativeAuthPlatform()) {
        const displayEpoch = await ensureNativeAccountDeletionBarrier();
        if (!displayEpoch) {
          throw new Error('Native deletion barrier receipt is unavailable.');
        }
        await clearNativeAuthSessionAfterAccountDeletionAcknowledgement(displayEpoch);
        window.localStorage.clear();
        getQueryClient()?.clear();
        useUserStore.getState().clearUser();
      } else {
        await clearWebPersonalData();
      }

      const complete = advanceDeletionOperation(pending, 'local_complete');
      await persistOperation(storage, complete);
      setHasActiveBearer(false);
      setMessage('서버가 삭제 예약을 확인했고, 이 기기의 로컬 로그인·캐시 정리가 완료되었습니다.');
    } catch {
      setHasActiveBearer(false);
      setMessage(
        `서버가 삭제 예약을 확인했습니다. 이 기기의 로컬 정리가 아직 완료되지 않았습니다. 상태 핸들 ${stored.requestId}은(는) 보관되어 있으며 성공으로 표시하지 않습니다.`,
      );
    }
  };
  const finishCancellationLocalCleanup = async (
    storage: DeletionStorage,
    acknowledgedOperation: DeletionOperation,
    cancelledAtUtc?: string,
  ) => {
    try {
      let pending: DeletionOperation | null = null;
      let complete: DeletionOperation;
      if (acknowledgedOperation.phase === 'local_complete') {
        complete = acknowledgedOperation;
      } else {
        const nextPending = acknowledgedOperation.phase === 'local_cleanup_pending'
          ? acknowledgedOperation
          : advanceDeletionOperation(acknowledgedOperation, 'local_cleanup_pending');
        pending = nextPending;
        complete = advanceDeletionOperation(nextPending, 'local_complete');
        await persistOperation(storage, nextPending);
      }
      const displayEpoch = await ensureNativeAccountDeletionBarrier();
      if (displayEpoch) {
        await finalizeNativeAccountDeletionBarrier(displayEpoch);
      }
      await Promise.all([
        clearStoredCapability(storage),
        storage.remove(DELETION_STATUS_STORAGE_KEY),
      ]);
      if (pending) {
        await persistOperation(storage, complete);
      }
      releaseNativeAuthSessionAfterDeletionCancellation();
      setReauthCapability(null);
      setJournalRecoveryRequired(false);
      setStoredStatus(null);
      setStatus({
        request_id: acknowledgedOperation.requestId!,
        state: 'cancelled',
        deadline_at_utc: cancelledAtUtc ?? null,
        cancelable: false,
      });
      setMessage('서버가 삭제 예약 취소를 확인했고, 이 기기의 추적 기록 정리가 완료되었습니다.');
    } catch {
      setMessage('서버가 예약 취소를 확인했지만 이 기기의 추적 기록 정리가 아직 완료되지 않았습니다. 완료로 표시하지 않습니다.');
    }
  };
  async function reconcileCancelledStatus(
    stored: StoredDeletionStatus,
    validatedStatus: DeletionStatus,
  ): Promise<void> {
    let storage: DeletionStorage;
    let currentOperation: DeletionOperation;
    try {
      storage = await getDeletionStorage();
      const [currentStored, operationJournal] = await Promise.all([
        readStoredStatusJournal(storage),
        readStoredOperationJournal(storage),
      ]);
      if (
        currentStored.kind !== 'valid'
        || currentStored.value.requestId !== stored.requestId
      ) {
        setJournalRecoveryRequired(true);
        setMessage('삭제 상태 핸들을 안전하게 읽지 못해 취소 정리를 진행하지 않았습니다.');
        return;
      }

      const persistedOperation = operationJournal.kind === 'valid'
        ? operationJournal.value
        : null;
      if (
        !persistedOperation
        || persistedOperation.kind !== 'cancel'
        || persistedOperation.requestId !== stored.requestId
      ) {
        await preserveCancellationRecoveryAudit(storage, stored.requestId);
        currentOperation = createDeletionOperation(
          'cancel',
          createIdempotencyKey(),
          stored.requestId,
        );
      } else {
        currentOperation = persistedOperation;
      }
    } catch {
      setJournalRecoveryRequired(true);
      setMessage('취소 작업 기록을 안전하게 읽지 못해 취소 정리를 진행하지 않았습니다.');
      return;
    }

    try {
      const acknowledged = currentOperation.phase === 'local_cleanup_pending'
        || currentOperation.phase === 'local_complete'
        ? currentOperation
        : advanceDeletionOperation(currentOperation, 'server_acknowledged');
      if (acknowledged !== currentOperation) {
        await persistOperation(storage, acknowledged);
      }
      await finishCancellationLocalCleanup(
        storage,
        acknowledged,
        validatedStatus.deadline_at_utc ?? undefined,
      );
    } catch {
      setMessage('서버가 예약 취소를 확인했지만 이 기기의 추적 기록 정리를 완료하지 못했습니다. 예약이 유지된다고 표시하지 않습니다.');
    }
  }


  async function cancelDeletion(
    stored = storedStatus,
    capability = reauthCapability,
  ): Promise<void> {
    if (!stored || !capability || capability.purpose !== 'cancel' || capability.requestId !== stored.requestId) {
      setMessage('예약 취소에는 이 삭제 요청에 연결된 제공업체 재인증이 필요합니다. 예약은 취소되지 않았습니다.');
      return;
    }
    if (journalRecoveryRequired) {
      setMessage('삭제 추적 기록을 복구하기 전에는 예약 취소를 전송할 수 없습니다.');
      return;
    }

    let storage: DeletionStorage;
    try {
      storage = await getDeletionStorage();
    } catch {
      setMessage('안전한 삭제 추적 저장소를 사용할 수 없어 예약 취소를 전송하지 않았습니다.');
      return;
    }

    let existing: DeletionOperation | null;
    try {
      const [currentStored, currentOperation] = await Promise.all([
        readStoredStatus(storage),
        readStoredOperation(storage),
      ]);
      if (!currentStored
        || currentStored.requestId !== stored.requestId
        || requiresDeletionJournalRecovery(currentStored, currentOperation)) {
        setJournalRecoveryRequired(true);
        setMessage('삭제 작업 기록이 손상되었거나 서로 일치하지 않습니다. 기존 기록은 보존했으며 예약 취소를 전송하지 않았습니다.');
        return;
      }
      existing = currentOperation;
    } catch {
      setJournalRecoveryRequired(true);
      setMessage('취소 작업 기록을 안전하게 읽지 못해 예약 취소를 전송하지 않았습니다.');
      return;
    }
    let dispatchCapability: StoredDeletionCapability | null;
    try {
      dispatchCapability = await revalidateDispatchCapability(
        storage,
        'cancel',
        stored.requestId,
      );
    } catch {
      setMessage('예약 취소 재인증 권한을 안전하게 확인할 수 없어 요청을 전송하지 않았습니다.');
      cancellationInFlightRef.current = false;
      return;
    }
    if (!dispatchCapability) {
      setMessage('예약 취소 재인증 권한이 만료되었거나 범위가 일치하지 않습니다. 서버 상태를 다시 확인하세요.');
      cancellationInFlightRef.current = false;
      void loadStatus(stored);
      return;
    }

    const nextOperation = existing
      && existing.kind === 'cancel'
      && existing.requestId === stored.requestId
      && (existing.phase === 'sending' || existing.phase === 'outcome_unknown')
      ? existing
      : createDeletionOperation('cancel', createIdempotencyKey(), stored.requestId);

    try {
      if (nextOperation !== existing && existing?.kind === 'request') {
        await preserveCancellationRecoveryAudit(storage, stored.requestId);
      }
      await persistOperation(storage, nextOperation);
      dispatchCapability = await revalidateDispatchCapability(
        storage,
        'cancel',
        stored.requestId,
      );
    } catch {
      setMessage('취소 작업 식별자 또는 재인증 권한을 안전하게 확인하지 못해 예약 취소를 전송하지 않았습니다.');
      cancellationInFlightRef.current = false;
      return;
    }
    if (!dispatchCapability) {
      if (nextOperation !== existing) {
        try {
          if (existing) {
            await persistOperation(storage, existing);
          } else {
            await storage.remove(DELETION_OPERATION_STORAGE_KEY);
            setOperation(null);
          }
        } catch {
          setJournalRecoveryRequired(true);
        }
      }
      setMessage('예약 취소 재인증 권한이 만료되었거나 범위가 일치하지 않습니다. 서버 상태를 다시 확인하세요.');
      cancellationInFlightRef.current = false;
      void loadStatus(stored);
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    let cancellationAcknowledged = false;
    let cancellationRequestSent = false;
    try {
      cancellationRequestSent = true;
      const response = await authApi.post<unknown>(
        `/v1/account-deletion/requests/${encodeURIComponent(stored.requestId)}/cancel`,
        {},
        {
          headers: {
            'X-ZeroTime-Contract': MOBILE_RELEASE_CONTRACT,
            'Idempotency-Key': nextOperation.idempotencyKey,
            'X-Deletion-Capability': dispatchCapability.value,
          },
        },
      );
      const acknowledgement = parseDeletionCancellationAcknowledgement(response.data, stored.requestId);
      cancellationAcknowledged = true;
      const acknowledged = advanceDeletionOperation(nextOperation, 'server_acknowledged');
      await persistOperation(storage, acknowledged);
      await finishCancellationLocalCleanup(storage, acknowledged, acknowledgement.cancelled_at_utc);
    } catch {
      if (cancellationAcknowledged) {
        setStatus({
          request_id: stored.requestId,
          state: 'cancelled',
          deadline_at_utc: status?.deadline_at_utc ?? new Date().toISOString(),
          cancelable: false,
        });
        setMessage('서버가 예약 취소를 확인했지만 이 기기의 추적 기록 정리를 완료하지 못했습니다. 예약이 유지된다고 표시하지 않습니다.');
      } else if (!cancellationRequestSent) {
        setMessage('취소 작업 기록을 확인하지 못해 예약 취소 요청을 전송하지 않았습니다.');
      } else {
        try {
          await persistOperation(storage, advanceDeletionOperation(nextOperation, 'outcome_unknown'));
        } catch {
          // The pre-send operation record remains the only safe retry identity.
        }
        setMessage('예약 취소 결과를 서버에서 확인하지 못했습니다. 같은 작업 식별자로 다시 확인해야 하며 예약이 유지된다고 단정하지 않습니다.');
      }
    } finally {
      cancellationInFlightRef.current = false;
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    setHasActiveBearer(Boolean(getAccessToken()));
    let active = true;

    void (async () => {
      try {
        const storage = await getDeletionStorage();
        const [statusJournal, operationJournal, capability] = await Promise.all([
          readStoredStatusJournal(storage),
          readStoredOperationJournal(storage),
          readStoredCapability(storage),
        ]);
        if (!active) return;

        const stored = statusJournal.kind === 'valid' ? statusJournal.value : null;
        const existingOperation = operationJournal.kind === 'valid'
          ? operationJournal.value
          : null;
        if (statusJournal.kind === 'corrupt') {
          setJournalRecoveryRequired(true);
          setStoredStatus(null);
          setOperation(null);
          setReauthCapability(null);
          setMessage('삭제 상태 기록이 손상되어 상태 확인이나 변경을 전송하지 않았습니다.');
          return;
        }

        setStoredStatus(stored);
        setOperation(existingOperation);
        if (
          operationJournal.kind === 'corrupt'
          || requiresDeletionJournalRecovery(stored, existingOperation)
        ) {
          setJournalRecoveryRequired(true);
          setReauthCapability(null);
          setMessage(
            stored
              ? '삭제 작업 기록이 손상되었거나 서로 일치하지 않습니다. 기존 기록은 격리했으며 상태만 확인합니다.'
              : '삭제 작업 기록이 손상되었거나 서로 일치하지 않습니다. 기존 기록은 보존했으며 상태 변경을 전송하지 않았습니다.',
          );
          if (stored) void loadStatus(stored);
          return;
        }

        setJournalRecoveryRequired(false);
        setReauthCapability(capability);

        const requiresClosedNativeAdmission = capability?.purpose !== 'request'
          && existingOperation?.kind === 'request'
          && (
            existingOperation.phase === 'native_begin_pending'
            || existingOperation.phase === 'sending'
            || existingOperation.phase === 'outcome_unknown'
            || existingOperation.phase === 'server_acknowledged'
            || existingOperation.phase === 'local_cleanup_pending'
          );
        if (requiresClosedNativeAdmission) {
          try {
            await ensureNativeAccountDeletionBarrier();
          } catch {
            setMessage('네이티브 알림 표시를 안전하게 차단하지 못해 삭제 작업을 재개하지 않았습니다.');
            return;
          }
          if (!active) return;
        }

        if (stored
          && existingOperation?.kind === 'request'
          && existingOperation.requestId === undefined
          && (
            existingOperation.phase === 'sending'
            || existingOperation.phase === 'outcome_unknown'
          )) {
          try {
            const acknowledged = acknowledgeDeletionOperation(existingOperation, stored.requestId);
            await persistOperation(storage, acknowledged);
            await clearStoredCapability(storage);
            setReauthCapability(null);
            await finishLocalCleanup(storage, acknowledged, stored);
            if (active) void loadStatus(stored);
            return;
          } catch {
            setMessage('서버가 삭제 예약을 확인했지만 로컬 정리 단계를 안전하게 기록하지 못했습니다. 로컬 완료로 표시하지 않습니다.');
            return;
          }
        }

        if (stored
          && existingOperation?.kind === 'request'
          && existingOperation.requestId === stored.requestId
          && (existingOperation.phase === 'server_acknowledged'
            || existingOperation.phase === 'local_cleanup_pending')) {
          await clearStoredCapability(storage);
          setReauthCapability(null);
          await finishLocalCleanup(storage, existingOperation, stored);
          if (active) void loadStatus(stored);
          return;
        }

        if (existingOperation?.kind === 'cancel'
          && (existingOperation.phase === 'server_acknowledged'
            || existingOperation.phase === 'local_cleanup_pending'
            || existingOperation.phase === 'local_complete')) {
          await finishCancellationLocalCleanup(storage, existingOperation);
          return;
        }

        if (capability?.purpose === 'request') {
          const isRequestScopeCurrent = !stored
            && existingOperation?.kind === 'request'
            && existingOperation.requestId === undefined
            && (
              existingOperation.phase === 'reauth_pending'
              || existingOperation.phase === 'native_begin_pending'
              || existingOperation.phase === 'sending'
              || existingOperation.phase === 'outcome_unknown'
            )
            && existingOperation.idempotencyKey === capability.requestId;
          if (!isRequestScopeCurrent) {
            await clearStoredCapability(storage);
            if (!active) return;
            setReauthCapability(null);
            setMessage('재인증 결과가 현재 삭제 요청 범위와 일치하지 않습니다. 삭제 예약은 생성되지 않았습니다.');
            return;
          }
          void requestDeletion(capability);
          return;
        }
        if (capability?.purpose === 'cancel') {
          if (!stored || capability.requestId !== stored.requestId) {
            await clearStoredCapability(storage);
            if (!active) return;
            setReauthCapability(null);
            setMessage('재인증 결과가 현재 삭제 예약과 일치하지 않습니다. 예약은 취소되지 않았습니다.');
            return;
          }
          if (!cancellationInFlightRef.current) {
            cancellationInFlightRef.current = true;
            void cancelDeletion(stored, capability);
            return;
          }
        }
        if (stored) void loadStatus(stored);
      } catch (error) {
        if (!active) return;
        setJournalRecoveryRequired(true);
        setMessage(
          error instanceof Error && error.message === 'NATIVE_DELETION_TRACKING_SECURE_STORAGE_UNAVAILABLE'
            ? '네이티브 안전 저장소를 확인할 수 없어 30일 삭제 예약 상태를 안전하게 보관하거나 취소할 수 없습니다. 요청을 전송하지 않았습니다.'
            : '삭제 예약 정보를 안전하게 관리할 수 없습니다. 요청은 성공으로 처리되지 않았습니다.',
        );
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  async function requestDeletion(capability = reauthCapability): Promise<void> {
    if (journalRecoveryRequired) {
      setMessage('삭제 추적 기록을 복구하기 전에는 새 삭제 예약을 전송할 수 없습니다.');
      return;
    }
    if (!capability || capability.purpose !== 'request') {
      setMessage('삭제 예약에는 이 요청 범위에 연결된 제공업체 재인증이 필요합니다. 요청은 생성되지 않았습니다.');
      return;
    }

    let storage: DeletionStorage;
    let nextOperation: DeletionOperation;
    let dispatchCapability: StoredDeletionCapability;
    try {
      storage = await getDeletionStorage();
      const [stored, existing] = await Promise.all([
        readStoredStatus(storage),
        readStoredOperation(storage),
      ]);
      if (stored || requiresDeletionJournalRecovery(stored, existing)) {
        setJournalRecoveryRequired(true);
        setMessage('삭제 작업 기록이 손상되었거나 서로 일치하지 않습니다. 기존 기록은 보존했으며 새 요청을 전송하지 않았습니다.');
        return;
      }
      if (!existing
        || existing.kind !== 'request'
        || existing.requestId !== undefined
        || (
          existing.phase !== 'reauth_pending'
          && existing.phase !== 'native_begin_pending'
          && existing.phase !== 'sending'
          && existing.phase !== 'outcome_unknown'
        )
        || existing.idempotencyKey !== capability.requestId) {
        setMessage('재인증 결과가 안전하게 보관된 삭제 요청 범위와 일치하지 않습니다. 요청은 생성되지 않았습니다.');
        return;
      }
      const validatedCapability = await revalidateDispatchCapability(
        storage,
        'request',
        existing.idempotencyKey,
      );
      if (!validatedCapability) {
        setMessage('삭제 예약 재인증 권한이 만료되었거나 범위가 일치하지 않습니다. 제공업체 재인증부터 다시 시작하세요.');
        return;
      }
      dispatchCapability = validatedCapability;
      nextOperation = existing.phase === 'reauth_pending'
        ? advanceDeletionOperation(existing, 'native_begin_pending')
        : existing;
      if (nextOperation !== existing) {
        await persistOperation(storage, nextOperation);
      }
    } catch (error) {
      setJournalRecoveryRequired(true);
      setMessage(
        error instanceof Error && error.message === 'NATIVE_DELETION_TRACKING_SECURE_STORAGE_UNAVAILABLE'
          ? '네이티브 안전 저장소가 없어 30일 상태 핸들을 보관할 수 없습니다. 요청을 전송하지 않았습니다.'
          : '삭제 요청 작업 기록을 안전하게 읽지 못해 요청을 전송하지 않았습니다.',
      );
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    let acknowledgementStored = false;
    let requestSent = false;
    try {
      await ensureNativeAccountDeletionBarrier();
      if (nextOperation.phase === 'native_begin_pending') {
        nextOperation = advanceDeletionOperation(nextOperation, 'sending');
        await persistOperation(storage, nextOperation);
      }

      requestSent = true;
      const response = await authApi.post<unknown>(
        '/v1/account-deletion/requests',
        {},
        {
          headers: {
            'X-ZeroTime-Contract': MOBILE_RELEASE_CONTRACT,
            'Idempotency-Key': nextOperation.idempotencyKey,
            'X-Deletion-Capability': dispatchCapability.value,
          },
        },
      );
      const acknowledgement = parseDeletionRequestAcknowledgement(response.data);
      if (acknowledgement.request_id !== dispatchCapability.requestId) {
        throw new Error('DELETION_REQUEST_SCOPE_MISMATCH');
      }
      const nextStored: StoredDeletionStatus = {
        requestId: acknowledgement.request_id,
        statusHandle: acknowledgement.status_handle,
      };
      await storage.set(DELETION_STATUS_STORAGE_KEY, JSON.stringify(nextStored));
      acknowledgementStored = true;
      setStoredStatus(nextStored);
      const acknowledged = acknowledgeDeletionOperation(nextOperation, acknowledgement.request_id);
      await persistOperation(storage, acknowledged);
      await clearStoredCapability(storage);
      setReauthCapability(null);
      setMessage('서버가 삭제 예약을 확인했습니다. 이 기기의 로컬 로그인과 캐시를 정리하는 중입니다.');
      await finishLocalCleanup(storage, acknowledged, nextStored);
      void loadStatus(nextStored);
    } catch {
      if (acknowledgementStored) {
        setMessage('서버 응답은 확인되었지만 로컬 정리 단계를 안전하게 기록하지 못했습니다. 로컬 정리가 완료되었다고 표시하지 않습니다.');
      } else if (!requestSent) {
        setMessage('삭제 작업 기록 또는 네이티브 알림 표시 차단을 확인하지 못해 삭제 예약 요청을 전송하지 않았습니다.');
      } else {
        try {
          await persistOperation(storage, advanceDeletionOperation(nextOperation, 'outcome_unknown'));
        } catch {
          // The pre-send operation record remains available for an idempotent retry when possible.
        }
        setMessage('삭제 요청 결과를 서버에서 확인하지 못했습니다. 같은 작업 식별자로 다시 확인하며 성공으로 처리하지 않습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const startRequestReauth = async (provider: OAuthProvider) => {
    if (journalRecoveryRequired) {
      setMessage('삭제 추적 기록을 복구하기 전에는 제공업체 재인증을 시작할 수 없습니다.');
      return;
    }
    if (storedStatus) {
      setMessage('이 기기에는 이미 삭제 예약 상태 정보가 있습니다. 새 요청 대신 상태를 확인하세요.');
      return;
    }
    if (!getAccessToken()) {
      setHasActiveBearer(false);
      setMessage('삭제 예약을 시작하려면 현재 기기의 로그인 세션이 필요합니다. 요청은 생성되지 않았습니다.');
      return;
    }

    let storage: DeletionStorage;
    let nextOperation: DeletionOperation;
    let reauthAttempt: DeletionReauthTransactionIntent | DeletionReauthTransient;
    let platform: 'web' | 'ios' | 'android' = 'web';
    try {
      storage = await getDeletionStorage();
      const [stored, existing] = await Promise.all([
        readStoredStatus(storage),
        readStoredOperation(storage),
      ]);
      if (stored || requiresDeletionJournalRecovery(stored, existing)) {
        setJournalRecoveryRequired(true);
        setMessage('삭제 작업 기록이 손상되었거나 서로 일치하지 않습니다. 기존 기록은 보존했으며 재인증을 시작하지 않았습니다.');
        return;
      }
      nextOperation = existing
        && existing.kind === 'request'
        && existing.requestId === undefined
        && (
          existing.phase === 'reauth_pending'
          || existing.phase === 'native_begin_pending'
          || existing.phase === 'sending'
          || existing.phase === 'outcome_unknown'
        )
        ? existing
        : createDeletionReauthOperation(createIdempotencyKey());
      await persistOperation(storage, nextOperation);
      platform = nativeReauthPlatform();

      const artifact = await readReauthTransactionArtifact(storage);
      if (artifact.kind === 'corrupt') {
        setJournalRecoveryRequired(true);
        setMessage('삭제 재인증 작업 기록이 손상되어 기존 증거를 보존했습니다.');
        return;
      }
      if (artifact.kind === 'absent') {
        const intent = createReauthTransactionIntent(
          provider as DeletionProvider,
          'request',
          nextOperation.idempotencyKey,
          platform,
        );
        await storeReauthTransactionIntent(storage, intent);
        reauthAttempt = intent;
      } else {
        if (!reauthArtifactMatches(
          artifact.value,
          'request',
          nextOperation.idempotencyKey,
          platform,
        )) {
          setJournalRecoveryRequired(true);
          setMessage('삭제 재인증 작업 소유권이 현재 요청과 일치하지 않아 기존 기록을 보존했습니다.');
          return;
        }
        reauthAttempt = artifact.value;
      }
    } catch {
      setJournalRecoveryRequired(true);
      setMessage('삭제 요청 작업 식별자를 안전하게 보관하지 못해 제공업체 재인증을 시작하지 않았습니다.');
      return;
    }

    setReauthCapability(null);
    setIsSubmitting(true);
    setMessage(null);
    try {
      if ('authorizationUrl' in reauthAttempt) {
        window.location.assign(reauthAttempt.authorizationUrl);
        return;
      }
      const codeChallenge = await createCodeChallenge(reauthAttempt.codeVerifier);
      const transactionResponse = await api.post<unknown>(
        '/v1/account-deletion/reauth/transactions',
        {
          provider: reauthAttempt.provider,
          platform: reauthAttempt.platform,
          state: reauthAttempt.state,
          nonce: reauthAttempt.nonce,
          code_challenge: codeChallenge,
          code_challenge_method: 'S256',
          purpose: 'request',
        },
        {
          headers: {
            'X-ZeroTime-Contract': MOBILE_RELEASE_CONTRACT,
            'Idempotency-Key': reauthAttempt.transactionIdempotencyKey,
          },
        },
      );
      const transaction = parseDeletionReauthTransaction(
        transactionResponse.data,
        reauthAttempt.provider,
        'request',
      );
      const transient: DeletionReauthTransient = {
        version: 1,
        transactionId: transaction.transaction_id,
        provider: reauthAttempt.provider,
        purpose: 'request',
        requestId: reauthAttempt.requestId,
        platform: reauthAttempt.platform,
        state: reauthAttempt.state,
        nonce: reauthAttempt.nonce,
        codeVerifier: reauthAttempt.codeVerifier,
        exchangeIdempotencyKey: reauthAttempt.exchangeIdempotencyKey,
        expiresAtUtc: transaction.expires_at_utc,
        authorizationUrl: transaction.authorization_url,
      };
      await storeReauthTransient(storage, transient);
      window.location.assign(transient.authorizationUrl);
    } catch {
      setMessage(
        platform === 'web'
          ? '웹 제공업체 재인증을 아직 사용할 수 없습니다. 안전하게 보관한 동일 요청으로 다시 시도할 수 있으며 삭제 예약은 전송되지 않았습니다.'
          : '제공업체 재인증을 시작하거나 확인하지 못했습니다. 안전하게 보관한 동일 요청으로 다시 시도할 수 있으며 삭제 예약은 생성되지 않았습니다.',
      );
      setIsSubmitting(false);
    }
  };

  const startCancellationReauth = async (provider: OAuthProvider) => {
    if (!storedStatus || status?.state !== 'deletion_pending' || !status.cancelable) {
      setMessage('현재 삭제 예약은 제공업체 재인증으로 취소할 수 없습니다.');
      return;
    }
    if (journalRecoveryRequired) {
      setMessage('삭제 추적 기록을 복구하기 전에는 제공업체 재인증을 시작할 수 없습니다.');
      return;
    }

    let storage: DeletionStorage;
    let reauthAttempt: DeletionReauthTransactionIntent | DeletionReauthTransient;
    const platform = nativeReauthPlatform();
    try {
      storage = await getDeletionStorage();
      const [currentStored, currentOperation] = await Promise.all([
        readStoredStatus(storage),
        readStoredOperation(storage),
      ]);
      if (!currentStored
        || currentStored.requestId !== storedStatus.requestId
        || requiresDeletionJournalRecovery(currentStored, currentOperation)) {
        setJournalRecoveryRequired(true);
        setMessage('삭제 작업 기록이 손상되었거나 서로 일치하지 않습니다. 기존 기록은 보존했으며 재인증을 시작하지 않았습니다.');
        return;
      }

      const artifact = await readReauthTransactionArtifact(storage);
      if (artifact.kind === 'corrupt') {
        setJournalRecoveryRequired(true);
        setMessage('삭제 취소 재인증 작업 기록이 손상되어 기존 증거를 보존했습니다.');
        return;
      }
      if (artifact.kind === 'absent') {
        const intent = createReauthTransactionIntent(
          provider as DeletionProvider,
          'cancel',
          storedStatus.requestId,
          platform,
        );
        await storeReauthTransactionIntent(storage, intent);
        reauthAttempt = intent;
      } else {
        if (!reauthArtifactMatches(
          artifact.value,
          'cancel',
          storedStatus.requestId,
          platform,
        )) {
          setJournalRecoveryRequired(true);
          setMessage('삭제 취소 재인증 작업 소유권이 현재 예약과 일치하지 않아 기존 기록을 보존했습니다.');
          return;
        }
        reauthAttempt = artifact.value;
      }
    } catch {
      setJournalRecoveryRequired(true);
      setMessage('안전한 삭제 추적 저장소를 사용할 수 없어 제공업체 재인증을 시작하지 않았습니다.');
      return;
    }

    setReauthCapability(null);
    setIsSubmitting(true);
    setMessage(null);
    try {
      if ('authorizationUrl' in reauthAttempt) {
        window.location.assign(reauthAttempt.authorizationUrl);
        return;
      }
      const codeChallenge = await createCodeChallenge(reauthAttempt.codeVerifier);
      const transactionResponse = await authApi.post<unknown>(
        '/v1/account-deletion/reauth/transactions',
        {
          provider: reauthAttempt.provider,
          platform: reauthAttempt.platform,
          state: reauthAttempt.state,
          nonce: reauthAttempt.nonce,
          code_challenge: codeChallenge,
          code_challenge_method: 'S256',
          purpose: 'cancel',
        },
        {
          headers: {
            'X-ZeroTime-Contract': MOBILE_RELEASE_CONTRACT,
            'Idempotency-Key': reauthAttempt.transactionIdempotencyKey,
            'X-Deletion-Status-Handle': storedStatus.statusHandle,
          },
        },
      );
      const transaction = parseDeletionReauthTransaction(
        transactionResponse.data,
        reauthAttempt.provider,
        'cancel',
      );
      const transient: DeletionReauthTransient = {
        version: 1,
        transactionId: transaction.transaction_id,
        provider: reauthAttempt.provider,
        purpose: 'cancel',
        requestId: reauthAttempt.requestId,
        platform: reauthAttempt.platform,
        state: reauthAttempt.state,
        nonce: reauthAttempt.nonce,
        codeVerifier: reauthAttempt.codeVerifier,
        exchangeIdempotencyKey: reauthAttempt.exchangeIdempotencyKey,
        expiresAtUtc: transaction.expires_at_utc,
        authorizationUrl: transaction.authorization_url,
      };
      await storeReauthTransient(storage, transient);
      window.location.assign(transient.authorizationUrl);
    } catch {
      setMessage('제공업체 재인증을 시작하거나 확인하지 못했습니다. 안전하게 보관한 동일 요청으로 다시 시도할 수 있으며 예약은 취소되지 않았습니다.');
      setIsSubmitting(false);
    }
  };

  const localCleanupMessage = operation?.phase === 'local_complete'
    ? '이 기기의 로컬 로그인 정보와 캐시 정리가 완료되었습니다.'
    : operation?.phase === 'local_cleanup_pending'
      ? '서버 응답은 확인되었지만 이 기기의 로컬 정리가 아직 완료되지 않았습니다.'
      : operation?.phase === 'outcome_unknown'
        ? '마지막 작업 결과를 확인하는 중입니다. 같은 작업 식별자로만 다시 시도합니다.'
        : null;

  return (
    <main
      aria-busy={isLoadingStatus || isSubmitting}
      className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-5 py-12 text-gray-900"
    >
      <h1 className="text-2xl font-bold">계정 삭제 예약</h1>
      <p className="mt-3 text-sm leading-6 text-gray-600">
        이 페이지는 계정 삭제 예약과 예약 상태 확인을 위한 공개 정적 페이지입니다. 삭제 예약은 즉시 완료되지 않으며,
        서버가 안내한 예정일까지 처리됩니다.
      </p>

      <section className="mt-8 rounded-xl border border-gray-200 p-5" aria-labelledby="deletion-scope-heading">
        <h2 id="deletion-scope-heading" className="text-base font-semibold">처리 범위와 고지</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-gray-600">
          <li>계정 프로필과 계정에 연결된 서비스 설정이 삭제 처리 대상입니다.</li>
          <li>삭제 예정일과 예약 취소 조건은 서버 상태 응답으로만 확인합니다.</li>
          <li>
            이 공개 웹 페이지는 서버 확인 뒤 웹 로그인·캐시를 정리하지만, 네이티브 알림 조정기는 실행하지 않으므로
            기기의 알림 정리가 완료되었다고 약속하지 않습니다.
          </li>
          <li>
            보유 데이터·보존 기간과 책임자·연락처의 확정 고지는{' '}
            <a href="/privacy/" className="font-semibold text-blue-700 underline underline-offset-2">개인정보처리방침</a>의
            확인 필요 항목을 기준으로 하며, 값이 확정되기 전에는 추정하지 않습니다.{' '}
            <a href="/terms/" className="font-semibold text-blue-700 underline underline-offset-2">이용약관</a>도 함께 확인하세요.
          </li>
        </ul>
      </section>

      {!storedStatus && (
        <section className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-5" aria-labelledby="deletion-auth-heading">
          <h2 id="deletion-auth-heading" className="text-base font-semibold text-amber-950">삭제 예약 본인 확인</h2>
          {!hasActiveBearer ? (
            <>
              <p className="mt-2 text-sm leading-6 text-amber-900">
                삭제 예약을 만들려면 소셜 계정으로 로그인하세요. 로그인 뒤 이 페이지에서 제공업체 재인증을 완료해야 합니다.
              </p>
              <div className="mt-4 space-y-2">
                {PROVIDERS.map((provider) => (
                  <SocialLoginButton
                    key={provider}
                    provider={provider}
                    redirectTo="/account-deletion/"
                  />
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm leading-6 text-amber-900">
                삭제 예약에는 방금 선택한 제공업체로 다시 본인 확인해야 합니다. 일반 로그인 세션만으로는 삭제 예약을
                전송하지 않으며, 재인증으로 발급된 요청 전용 권한과 안전하게 보관된 작업 식별자가 일치할 때만 요청합니다.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {PROVIDERS.map((provider) => (
                  <button
                    key={provider}
                    type="button"
                    onClick={() => void startRequestReauth(provider)}
                    disabled={isSubmitting || journalRecoveryRequired}
                    className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {PROVIDER_LABELS[provider]}로 재인증
                  </button>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      <section className="mt-5 rounded-xl border border-gray-200 p-5" aria-labelledby="deletion-status-heading">
        <div className="flex items-center justify-between gap-3">
          <h2 id="deletion-status-heading" className="text-base font-semibold">삭제 예약 상태</h2>
          {storedStatus && (
            <button
              type="button"
              onClick={() => void loadStatus(storedStatus)}
              disabled={isLoadingStatus || isSubmitting}
              className="text-xs font-semibold text-blue-700 disabled:opacity-50"
            >
              {isLoadingStatus ? '확인 중...' : '새로고침'}
            </button>
          )}
        </div>
        {!storedStatus && (
          <p className="mt-2 text-sm leading-6 text-gray-600">
            이 기기에 확인 가능한 삭제 예약 정보가 없습니다.
          </p>
        )}
        {localCleanupMessage && (
          <p className="mt-3 text-sm leading-6 text-gray-700" role="status" aria-live="polite" aria-atomic="true">
            {localCleanupMessage}
          </p>
        )}
        {status && (
          <div className="mt-3 text-sm leading-6 text-gray-700" role="status" aria-live="polite" aria-atomic="true">
            <p>현재 상태: {localizedDeletionState(status.state)}</p>
            <p>{status.state === 'cancelled' ? '취소 확인 시각' : '예정일'}: {formatDeletionDeadline(status.deadline_at_utc)}</p>
            {status.retry_guidance && <p className="mt-2">{status.retry_guidance}</p>}
            {status.cancelable && (
              <div className="mt-4 rounded-lg border border-gray-200 p-4">
                <p className="text-sm leading-6 text-gray-700">
                  예약 취소를 위해 삭제 요청을 만들 때 사용한 제공업체로 다시 본인 확인하세요.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {PROVIDERS.map((provider) => (
                    <button
                      key={provider}
                      type="button"
                      onClick={() => void startCancellationReauth(provider)}
                      disabled={isSubmitting || journalRecoveryRequired}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-800 disabled:opacity-50"
                    >
                      {PROVIDER_LABELS[provider]}로 재인증
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {message && (
        <p className="mt-5 text-sm leading-6 text-red-700" role="alert" aria-live="assertive">
          {message}
        </p>
      )}
    </main>
  );
}

export default function AccountDeletionPage() {
  void LegacyAccountDeletionPage;
  useEffect(() => {
    window.location.replace('/profile/');
  }, []);

  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <h1 className="text-2xl font-bold">회원 탈퇴</h1>
      <p className="mt-3 text-sm leading-6 text-gray-600">
        회원 탈퇴는 로그인 후 프로필에서 요청할 수 있습니다. 프로필로 이동합니다.
      </p>
      <a href="/profile/" className="mt-5 inline-block font-semibold text-blue-600 hover:underline">
        프로필로 이동
      </a>
    </main>
  );
}
