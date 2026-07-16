export const DELETION_STATUS_STORAGE_KEY = 'zerotime.account-deletion.status.v1';
export const DELETION_OPERATION_STORAGE_KEY = 'zerotime.account-deletion.operation.v1';
export const DELETION_OPERATION_AUDIT_STORAGE_KEY = 'zerotime.account-deletion.operation.audit.v1';
export const DELETION_REAUTH_TRANSIENT_STORAGE_KEY = 'zerotime.account-deletion.reauth.transient.v1';
export const DELETION_CAPABILITY_STORAGE_KEY = 'zerotime.account-deletion.capability.v1';
export const DELETION_NATIVE_REAUTH_HANDOFF_STORAGE_KEY = 'zerotime.account-deletion.native-reauth-handoff.v1';

export const DELETION_REAUTH_MAX_AGE_MS = 5 * 60 * 1000;
export const DELETION_CAPABILITY_MAX_AGE_MS = 10 * 60 * 1000;
const DELETION_DEADLINE_MAX_AGE_MS = 31 * 24 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 5 * 60 * 1000;

export const DELETION_STATES = [
  'deletion_pending',
  'finalizing',
  'deletion_retry',
  'deletion_failed',
  'finalized',
  'cancelled',
] as const;
export type DeletionState = (typeof DELETION_STATES)[number];

export const DELETION_OPERATION_PHASES = [
  'reauth_pending',
  'native_begin_pending',
  'sending',
  'outcome_unknown',
  'server_acknowledged',
  'local_cleanup_pending',
  'local_complete',
] as const;
export type DeletionOperationPhase = (typeof DELETION_OPERATION_PHASES)[number];
export type DeletionOperationKind = 'request' | 'cancel';
export type DeletionProvider = 'google' | 'apple' | 'naver' | 'kakao';
export type DeletionReauthPurpose = 'request' | 'cancel';
export type DeletionReauthPlatform = 'web' | 'ios' | 'android';

export interface StoredDeletionStatus {
  readonly requestId: string;
  readonly statusHandle: string;
}
export type StoredDeletionJournal<T> =
  | { readonly kind: 'absent' }
  | { readonly kind: 'valid'; readonly value: T }
  | { readonly kind: 'corrupt' };

export interface DeletionOperation {
  readonly version: 1;
  readonly kind: DeletionOperationKind;
  readonly phase: DeletionOperationPhase;
  readonly idempotencyKey: string;
  readonly requestId?: string;
  readonly updatedAtUtc: string;
}

export interface DeletionStatus {
  readonly request_id: string;
  readonly state: DeletionState;
  readonly deadline_at_utc: string | null;
  readonly cancelable: boolean;
  readonly retry_guidance?: string | null;
}

export interface DeletionRequestAcknowledgement {
  readonly request_id: string;
  readonly state: 'deletion_pending';
  readonly requested_at_utc: string;
  readonly deadline_at_utc: string;
  readonly status_handle: string;
}

export interface DeletionCancellationAcknowledgement {
  readonly request_id: string;
  readonly request_state: 'cancelled';
  readonly account_state: 'active' | 'suspended';
  readonly cancelled_at_utc: string;
  readonly reauthentication_required: true;
}

export interface DeletionReauthTransaction {
  readonly transaction_id: string;
  readonly provider: DeletionProvider;
  readonly purpose: DeletionReauthPurpose;
  readonly authorization_url: string;
  readonly expires_at_utc: string;
}

export interface DeletionReauthTransactionIntent {
  readonly version: 1;
  readonly provider: DeletionProvider;
  readonly purpose: DeletionReauthPurpose;
  readonly requestId: string;
  readonly platform: DeletionReauthPlatform;
  readonly state: string;
  readonly nonce: string;
  readonly codeVerifier: string;
  readonly transactionIdempotencyKey: string;
  readonly exchangeIdempotencyKey: string;
  readonly createdAtUtc: string;
}

export interface DeletionReauthTransient {
  readonly version: 1;
  readonly transactionId: string;
  readonly provider: DeletionProvider;
  readonly purpose: DeletionReauthPurpose;
  readonly requestId: string;
  readonly platform: DeletionReauthPlatform;
  readonly state: string;
  readonly nonce: string;
  readonly codeVerifier: string;
  readonly exchangeIdempotencyKey: string;
  readonly expiresAtUtc: string;
  readonly authorizationUrl: string;
}

export interface StoredDeletionCapability {
  readonly version: 1;
  readonly requestId: string;
  readonly purpose: DeletionReauthPurpose;
  readonly value: string;
  readonly expiresAtUtc: string;
}

export interface DeletionCapabilityResponse {
  readonly result_type: 'deletion_capability';
  readonly deletion_capability: string;
  readonly purpose: DeletionReauthPurpose;
  readonly expires_at_utc: string;
  readonly request_id: string;
}

export type NativeDeletionReauthHandoff =
  | {
      readonly version: 1;
      readonly kind: 'transaction_pending';
      readonly intent: DeletionReauthTransactionIntent;
    }
  | {
      readonly version: 1;
      readonly kind: 'transient';
      readonly transient: DeletionReauthTransient;
    }
  | {
      readonly version: 1;
      readonly kind: 'exchange_pending';
      readonly transient: DeletionReauthTransient;
      readonly exchangeCode: string;
    }
  | {
      readonly version: 1;
      readonly kind: 'capability';
      readonly capability: StoredDeletionCapability;
    };

export interface ParsedNativeDeletionCallback {
  readonly kind: 'code' | 'error';
  readonly state: string;
  readonly code?: string;
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function isDeletionProvider(value: unknown): value is DeletionProvider {
  return value === 'google' || value === 'apple' || value === 'naver' || value === 'kakao';
}
export function isDeletionReauthPurpose(value: unknown): value is DeletionReauthPurpose {
  return value === 'request' || value === 'cancel';
}


export function isOpaqueValue(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43,128}$/.test(value);
}

export function isStatusHandle(value: unknown, requestId?: string): value is string {
  if (typeof value !== 'string' || !/^[0-9a-f-]{36}\.[0-9a-f]{64}$/i.test(value)) {
    return false;
  }
  const [handleRequestId] = value.split('.', 1);
  return isUuid(handleRequestId) && (!requestId || handleRequestId.toLowerCase() === requestId.toLowerCase());
}

export function isDeletionCapability(value: unknown): value is string {
  return typeof value === 'string'
    && /^[A-Za-z0-9_-]{16,2048}\.[A-Za-z0-9_-]{16,2048}\.[A-Za-z0-9_-]{16,2048}$/.test(value)
    && value.length <= 4096;
}

export function isRfc3339DateTime(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|([+-])(\d{2}):(\d{2}))$/,
  );
  if (!match) return false;
  const [, year, month, day, hour, minute, second, , offsetHour, offsetMinute] = match;
  const calendarDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return calendarDate.getUTCFullYear() === Number(year)
    && calendarDate.getUTCMonth() === Number(month) - 1
    && calendarDate.getUTCDate() === Number(day)
    && Number(hour) <= 23
    && Number(minute) <= 59
    && Number(second) <= 59
    && (offsetHour === undefined || (Number(offsetHour) <= 23 && Number(offsetMinute) <= 59))
    && Number.isFinite(Date.parse(value));
}

export function formatDeletionDeadline(value: string | null): string {
  return value ? new Date(value).toLocaleString('ko-KR') : '없음';
}

export function localizedDeletionState(state: DeletionState): string {
  const labels: Record<DeletionState, string> = {
    deletion_pending: '삭제 예약 접수됨',
    finalizing: '삭제 처리 중',
    deletion_retry: '삭제 처리 재시도 대기',
    deletion_failed: '삭제 처리 확인 필요',
    finalized: '삭제 처리 완료',
    cancelled: '삭제 예약 취소됨',
  };
  return labels[state];
}

export function createDeletionOperation(
  kind: DeletionOperationKind,
  idempotencyKey: string,
  requestId?: string,
  now = Date.now(),
): DeletionOperation {
  if (!isUuid(idempotencyKey)
    || (kind === 'cancel' && !isUuid(requestId))
    || (kind === 'request' && requestId !== undefined)) {
    throw new Error('INVALID_DELETION_OPERATION');
  }
  return {
    version: 1,
    kind,
    phase: 'sending',
    idempotencyKey,
    ...(requestId ? { requestId } : {}),
    updatedAtUtc: new Date(now).toISOString(),
  };
}
export function createDeletionReauthOperation(
  idempotencyKey: string,
  now = Date.now(),
): DeletionOperation {
  const operation = createDeletionOperation('request', idempotencyKey, undefined, now);
  return {
    ...operation,
    phase: 'reauth_pending',
  };
}

export function advanceDeletionOperation(
  operation: DeletionOperation,
  phase: DeletionOperationPhase,
  now = Date.now(),
): DeletionOperation {
  const parsedOperation = parseDeletionOperation(operation);
  if (!canAdvanceDeletionOperation(parsedOperation.phase, phase)) {
    throw new Error('ILLEGAL_DELETION_OPERATION_TRANSITION');
  }
  return parseDeletionOperation({
    ...parsedOperation,
    phase,
    updatedAtUtc: new Date(now).toISOString(),
  });
}

export function acknowledgeDeletionOperation(
  operation: DeletionOperation,
  requestId: string,
  now = Date.now(),
): DeletionOperation {
  const parsedOperation = parseDeletionOperation(operation);
  if (parsedOperation.kind !== 'request'
    || (parsedOperation.requestId !== undefined && parsedOperation.requestId !== requestId)
    || !isUuid(requestId)) {
    throw new Error('DELETION_OPERATION_REQUEST_ID_MISMATCH');
  }
  if (!canAdvanceDeletionOperation(parsedOperation.phase, 'server_acknowledged')) {
    throw new Error('ILLEGAL_DELETION_OPERATION_TRANSITION');
  }
  return parseDeletionOperation({
    ...parsedOperation,
    requestId,
    phase: 'server_acknowledged',
    updatedAtUtc: new Date(now).toISOString(),
  });
}

export function parseStoredDeletionStatus(value: unknown): StoredDeletionStatus | null {
  if (!isRecord(value)
    || !hasExactFields(value, ['requestId', 'statusHandle'])
    || !isUuid(value.requestId)
    || !isStatusHandle(value.statusHandle, value.requestId)) {
    return null;
  }
  return { requestId: value.requestId, statusHandle: value.statusHandle };
}

export function parseStoredDeletionStatusRecord(
  value: string | null,
): StoredDeletionJournal<StoredDeletionStatus> {
  return parseStoredDeletionJournal(value, parseStoredDeletionStatus);
}

export function parseDeletionOperation(value: unknown): DeletionOperation {
  if (!isRecord(value)
    || !hasExactFields(
      value,
      value.requestId === undefined
        ? ['version', 'kind', 'phase', 'idempotencyKey', 'updatedAtUtc']
        : ['version', 'kind', 'phase', 'idempotencyKey', 'requestId', 'updatedAtUtc'],
    )
    || value.version !== 1
    || (value.kind !== 'request' && value.kind !== 'cancel')
    || !isDeletionOperationPhase(value.phase)
    || !isUuid(value.idempotencyKey)
    || !isRfc3339DateTime(value.updatedAtUtc)
    || (value.requestId !== undefined && !isUuid(value.requestId))) {
    throw new Error('INVALID_DELETION_OPERATION');
  }
  const requiresRequestId = value.kind === 'cancel'
    || value.phase === 'server_acknowledged'
    || value.phase === 'local_cleanup_pending'
    || value.phase === 'local_complete';
  const forbidsRequestId = value.kind === 'request'
    && (
      value.phase === 'reauth_pending'
      || value.phase === 'native_begin_pending'
      || value.phase === 'sending'
      || value.phase === 'outcome_unknown'
    );
  if (requiresRequestId !== isUuid(value.requestId)
    || (forbidsRequestId && value.requestId !== undefined)) {
    throw new Error('INVALID_DELETION_OPERATION');
  }
  return {
    version: 1,
    kind: value.kind,
    phase: value.phase,
    idempotencyKey: value.idempotencyKey,
    ...(typeof value.requestId === 'string' ? { requestId: value.requestId } : {}),
    updatedAtUtc: value.updatedAtUtc,
  };
}

export function parseStoredDeletionOperation(value: unknown): DeletionOperation | null {
  try {
    return parseDeletionOperation(value);
  } catch {
    return null;
  }
}

export function parseStoredDeletionOperationRecord(
  value: string | null,
): StoredDeletionJournal<DeletionOperation> {
  return parseStoredDeletionJournal(value, parseStoredDeletionOperation);
}

export function parseDeletionRequestAcknowledgement(
  value: unknown,
  now = Date.now(),
): DeletionRequestAcknowledgement {
  if (!isRecord(value)
    || !hasExactFields(value, [
      'request_id',
      'state',
      'requested_at_utc',
      'deadline_at_utc',
      'status_handle',
    ])
    || !isUuid(value.request_id)
    || value.state !== 'deletion_pending'
    || !isRfc3339DateTime(value.requested_at_utc)
    || !isFutureDeletionDeadline(value.deadline_at_utc, now)
    || !isStatusHandle(value.status_handle, value.request_id)) {
    throw new Error('INVALID_DELETION_ACKNOWLEDGEMENT');
  }
  const requestedAt = Date.parse(value.requested_at_utc);
  const deadlineAt = Date.parse(value.deadline_at_utc);
  if (requestedAt > now + CLOCK_SKEW_MS
    || deadlineAt <= requestedAt
    || deadlineAt - requestedAt > DELETION_DEADLINE_MAX_AGE_MS) {
    throw new Error('INVALID_DELETION_ACKNOWLEDGEMENT');
  }
  return {
    request_id: value.request_id,
    state: 'deletion_pending',
    requested_at_utc: value.requested_at_utc,
    deadline_at_utc: value.deadline_at_utc,
    status_handle: value.status_handle,
  };
}

export function parseDeletionStatus(
  value: unknown,
  expectedRequestId: string,
  now = Date.now(),
  expectedOperation?: DeletionOperation,
): DeletionStatus {
  if (!isUuid(expectedRequestId)
    || !matchesDeletionOperationRequest(expectedOperation, expectedRequestId)
    || !isRecord(value)
    || !hasExactFields(value, [
      'request_id',
      'state',
      'deadline_at_utc',
      'cancelable',
      'retry_guidance',
    ])
    || value.request_id !== expectedRequestId
    || !isDeletionState(value.state)
    || (value.deadline_at_utc !== null && !isRfc3339DateTime(value.deadline_at_utc))
    || typeof value.cancelable !== 'boolean'
    || !isRetryGuidance(value.retry_guidance)) {
    throw new Error('INVALID_DELETION_STATUS');
  }
  const deadlineAt = value.deadline_at_utc === null ? null : Date.parse(value.deadline_at_utc);
  if ((deadlineAt !== null && deadlineAt > now + DELETION_DEADLINE_MAX_AGE_MS)
    || (value.state === 'deletion_pending' && (deadlineAt === null || deadlineAt <= now))
    || (value.cancelable && (value.state !== 'deletion_pending' || deadlineAt === null || deadlineAt <= now))) {
    throw new Error('INVALID_DELETION_STATUS');
  }
  return {
    request_id: value.request_id,
    state: value.state,
    deadline_at_utc: value.deadline_at_utc,
    cancelable: value.cancelable,
    ...(value.retry_guidance === 'none' ? {} : { retry_guidance: value.retry_guidance }),
  };
}

export function parseDeletionCancellationAcknowledgement(
  value: unknown,
  expectedRequestId: string,
  now = Date.now(),
  expectedOperation?: DeletionOperation,
): DeletionCancellationAcknowledgement {
  if (!isUuid(expectedRequestId)
    || !matchesDeletionOperationRequest(expectedOperation, expectedRequestId)
    || !isRecord(value)
    || !hasExactFields(value, [
      'request_id',
      'request_state',
      'account_state',
      'cancelled_at_utc',
      'reauthentication_required',
    ])
    || value.request_id !== expectedRequestId
    || value.request_state !== 'cancelled'
    || (value.account_state !== 'active' && value.account_state !== 'suspended')
    || !isRecentDateTime(value.cancelled_at_utc, now)
    || value.reauthentication_required !== true) {
    throw new Error('INVALID_CANCELLATION_ACKNOWLEDGEMENT');
  }
  return {
    request_id: value.request_id,
    request_state: 'cancelled',
    account_state: value.account_state,
    cancelled_at_utc: value.cancelled_at_utc,
    reauthentication_required: true,
  };
}

export function parseDeletionReauthTransaction(
  value: unknown,
  provider: DeletionProvider,
  purpose: DeletionReauthPurpose,
  now = Date.now(),
): DeletionReauthTransaction {
  if (!isRecord(value)
    || !hasExactFields(value, [
      'transaction_id',
      'provider',
      'purpose',
      'authorization_url',
      'expires_at_utc',
    ])
    || !isUuid(value.transaction_id)
    || value.provider !== provider
    || value.purpose !== purpose
    || !isFutureDateTimeWithin(value.expires_at_utc, DELETION_REAUTH_MAX_AGE_MS, now)
    || typeof value.authorization_url !== 'string') {
    throw new Error('INVALID_REAUTH_TRANSACTION');
  }
  let authorizationUrl: URL;
  try {
    authorizationUrl = new URL(value.authorization_url);
  } catch {
    throw new Error('INVALID_REAUTH_TRANSACTION');
  }
  if (authorizationUrl.protocol !== 'https:'
    || !authorizationUrl.hostname
    || authorizationUrl.username
    || authorizationUrl.password
    || authorizationUrl.hash) {
    throw new Error('INVALID_REAUTH_TRANSACTION');
  }
  const prohibitedAuthorizationParameters = new Set([
    'access_token',
    'code',
    'deletion_capability',
    'id_token',
    'refresh_token',
    'token',
  ]);
  for (const key of authorizationUrl.searchParams.keys()) {
    if (prohibitedAuthorizationParameters.has(key.toLowerCase())) {
      throw new Error('INVALID_REAUTH_TRANSACTION');
    }
  }
  return {
    transaction_id: value.transaction_id,
    provider,
    purpose,
    authorization_url: value.authorization_url,
    expires_at_utc: value.expires_at_utc,
  };
}
export function parseDeletionReauthTransactionIntent(
  value: unknown,
  now = Date.now(),
  allowExpired = false,
): DeletionReauthTransactionIntent | null {
  if (!isRecord(value)
    || !hasExactFields(value, [
      'version',
      'provider',
      'purpose',
      'requestId',
      'platform',
      'state',
      'nonce',
      'codeVerifier',
      'transactionIdempotencyKey',
      'exchangeIdempotencyKey',
      'createdAtUtc',
    ])
    || value.version !== 1
    || !isDeletionProvider(value.provider)
    || !isDeletionReauthPurpose(value.purpose)
    || !isUuid(value.requestId)
    || (value.platform !== 'web' && value.platform !== 'ios' && value.platform !== 'android')
    || !isOpaqueValue(value.state)
    || !isOpaqueValue(value.nonce)
    || !isOpaqueValue(value.codeVerifier)
    || !isUuid(value.transactionIdempotencyKey)
    || !isUuid(value.exchangeIdempotencyKey)
    || (allowExpired
      ? !isRfc3339DateTime(value.createdAtUtc)
      : !isRecentReauthIntentDateTime(value.createdAtUtc, now))) {
    return null;
  }
  return {
    version: 1,
    provider: value.provider,
    purpose: value.purpose,
    requestId: value.requestId,
    platform: value.platform,
    state: value.state,
    nonce: value.nonce,
    codeVerifier: value.codeVerifier,
    transactionIdempotencyKey: value.transactionIdempotencyKey,
    exchangeIdempotencyKey: value.exchangeIdempotencyKey,
    createdAtUtc: value.createdAtUtc as string,
  };
}


export function parseDeletionReauthTransient(
  value: unknown,
  now = Date.now(),
  allowExpired = false,
): DeletionReauthTransient | null {
  if (!isRecord(value)
    || !hasExactFields(value, [
      'version',
      'transactionId',
      'provider',
      'purpose',
      'requestId',
      'platform',
      'state',
      'nonce',
      'codeVerifier',
      'exchangeIdempotencyKey',
      'authorizationUrl',
      'expiresAtUtc',
    ])
    || value.version !== 1
    || !isUuid(value.transactionId)
    || !isDeletionProvider(value.provider)
    || !isDeletionReauthPurpose(value.purpose)
    || !isUuid(value.requestId)
    || (value.platform !== 'web' && value.platform !== 'ios' && value.platform !== 'android')
    || !isOpaqueValue(value.state)
    || !isOpaqueValue(value.nonce)
    || !isOpaqueValue(value.codeVerifier)
    || !isUuid(value.exchangeIdempotencyKey)
    || !isSafeReauthAuthorizationUrl(value.authorizationUrl)
    || (allowExpired
      ? !isRfc3339DateTime(value.expiresAtUtc)
      : !isFutureDateTimeWithin(value.expiresAtUtc, DELETION_REAUTH_MAX_AGE_MS, now))) {
    return null;
  }
  return {
    version: 1,
    transactionId: value.transactionId,
    provider: value.provider,
    purpose: value.purpose,
    requestId: value.requestId,
    platform: value.platform,
    state: value.state,
    nonce: value.nonce,
    codeVerifier: value.codeVerifier,
    exchangeIdempotencyKey: value.exchangeIdempotencyKey,
    expiresAtUtc: value.expiresAtUtc as string,
    authorizationUrl: value.authorizationUrl,
  };
}

export function parseStoredDeletionCapability(
  value: unknown,
  now = Date.now(),
): StoredDeletionCapability | null {
  if (!isRecord(value)
    || !hasExactFields(value, ['version', 'requestId', 'purpose', 'value', 'expiresAtUtc'])
    || value.version !== 1
    || !isUuid(value.requestId)
    || !isDeletionReauthPurpose(value.purpose)
    || !isDeletionCapability(value.value)
    || !isFutureDateTimeWithin(value.expiresAtUtc, DELETION_CAPABILITY_MAX_AGE_MS, now)) {
    return null;
  }
  return {
    version: 1,
    requestId: value.requestId,
    purpose: value.purpose,
    value: value.value,
    expiresAtUtc: value.expiresAtUtc,
  };
}

export function parseDeletionCapabilityResponse(
  value: unknown,
  transient: DeletionReauthTransient,
  now = Date.now(),
  expectedOperation?: DeletionOperation,
): DeletionCapabilityResponse {
  if (!matchesDeletionOperationScope(expectedOperation, transient.purpose, transient.requestId)
    || !isRecord(value)
    || !hasExactFields(value, [
      'result_type',
      'deletion_capability',
      'purpose',
      'expires_at_utc',
      'request_id',
    ])
    || value.result_type !== 'deletion_capability'
    || value.purpose !== transient.purpose
    || value.request_id !== transient.requestId
    || !isDeletionCapability(value.deletion_capability)
    || !isFutureDateTimeWithin(value.expires_at_utc, DELETION_CAPABILITY_MAX_AGE_MS, now)) {
    throw new Error('INVALID_CAPABILITY_RESPONSE');
  }
  return {
    result_type: 'deletion_capability',
    deletion_capability: value.deletion_capability,
    purpose: transient.purpose,
    expires_at_utc: value.expires_at_utc,
    request_id: transient.requestId,
  };
}

export function parseNativeDeletionReauthHandoff(
  value: unknown,
  now = Date.now(),
): NativeDeletionReauthHandoff | null {
  if (!isRecord(value) || value.version !== 1) {
    return null;
  }
  if (value.kind === 'transaction_pending') {
    if (!hasExactFields(value, ['version', 'kind', 'intent'])) {
      return null;
    }
    const intent = parseDeletionReauthTransactionIntent(value.intent, now);
    return intent ? { version: 1, kind: 'transaction_pending', intent } : null;
  }
  if (value.kind === 'transient') {
    if (!hasExactFields(value, ['version', 'kind', 'transient'])) {
      return null;
    }
    const transient = parseDeletionReauthTransient(value.transient, now);
    return transient ? { version: 1, kind: 'transient', transient } : null;
  }
  if (value.kind === 'exchange_pending') {
    if (!hasExactFields(value, ['version', 'kind', 'transient', 'exchangeCode'])) {
      return null;
    }
    const transient = parseDeletionReauthTransient(value.transient, now);
    return transient && isExchangeCode(value.exchangeCode)
      ? { version: 1, kind: 'exchange_pending', transient, exchangeCode: value.exchangeCode }
      : null;
  }
  if (value.kind === 'capability') {
    if (!hasExactFields(value, ['version', 'kind', 'capability'])) {
      return null;
    }
    const capability = parseStoredDeletionCapability(value.capability, now);
    return capability ? { version: 1, kind: 'capability', capability } : null;
  }
  return null;
}

export function parseNativeDeletionCallback(urlString: string): ParsedNativeDeletionCallback {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error('INVALID_CALLBACK_URL');
  }
  if (url.origin !== 'https://zerotime.kr'
    || url.protocol !== 'https:'
    || url.hostname !== 'zerotime.kr'
    || url.port
    || url.pathname !== '/auth/native/callback/'
    || url.username
    || url.password
    || url.hash) {
    throw new Error('INVALID_CALLBACK_URL');
  }
  const allowedParameters = new Set(['code', 'state', 'error', 'error_description']);
  for (const key of url.searchParams.keys()) {
    if (!allowedParameters.has(key)) {
      throw new Error('INVALID_CALLBACK_PARAMETERS');
    }
  }
  const states = url.searchParams.getAll('state');
  const codes = url.searchParams.getAll('code');
  const errors = url.searchParams.getAll('error');
  const descriptions = url.searchParams.getAll('error_description');
  if (states.length !== 1 || !isOpaqueValue(states[0]) || descriptions.length > 1) {
    throw new Error('INVALID_CALLBACK_STATE');
  }
  if (codes.length === 1 && errors.length === 0 && isExchangeCode(codes[0])) {
    return { kind: 'code', state: states[0], code: codes[0] };
  }
  if (errors.length === 1 && codes.length === 0 && typeof errors[0] === 'string' && errors[0].length > 0) {
    return { kind: 'error', state: states[0] };
  }
  throw new Error('INVALID_CALLBACK_PAYLOAD');
}

export function createOpaqueValue(): string {
  if (typeof globalThis.crypto?.getRandomValues !== 'function') {
    throw new Error('SECURE_RANDOMNESS_UNAVAILABLE');
  }
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function createCodeChallenge(codeVerifier: string): Promise<string> {
  if (!isOpaqueValue(codeVerifier) || !globalThis.crypto?.subtle) {
    throw new Error('CRYPTOGRAPHY_UNAVAILABLE');
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  let binary = '';
  for (const byte of new Uint8Array(digest)) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function hasExactFields(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length
    && expected.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function parseStoredDeletionJournal<T>(
  value: string | null,
  parser: (value: unknown) => T | null,
): StoredDeletionJournal<T> {
  if (value === null) {
    return { kind: 'absent' };
  }
  try {
    const parsed = parser(JSON.parse(value) as unknown);
    return parsed ? { kind: 'valid', value: parsed } : { kind: 'corrupt' };
  } catch {
    return { kind: 'corrupt' };
  }
}

function canAdvanceDeletionOperation(
  from: DeletionOperationPhase,
  to: DeletionOperationPhase,
): boolean {
  if (from === to) {
    return true;
  }
  if (from === 'reauth_pending') {
    return to === 'native_begin_pending';
  }
  if (from === 'native_begin_pending') {
    return to === 'sending';
  }
  if (from === 'sending') {
    return to === 'outcome_unknown' || to === 'server_acknowledged';
  }
  if (from === 'outcome_unknown') {
    return to === 'server_acknowledged';
  }
  if (from === 'server_acknowledged') {
    return to === 'local_cleanup_pending' || to === 'local_complete';
  }
  return from === 'local_cleanup_pending' && to === 'local_complete';
}

function matchesDeletionOperationRequest(
  operation: DeletionOperation | undefined,
  requestId: string,
): boolean {
  if (!operation) {
    return true;
  }
  try {
    return parseDeletionOperation(operation).requestId === requestId;
  } catch {
    return false;
  }
}
function matchesDeletionOperationScope(
  operation: DeletionOperation | undefined,
  purpose: DeletionReauthPurpose,
  requestId: string,
): boolean {
  if (!operation) {
    return true;
  }
  try {
    const parsedOperation = parseDeletionOperation(operation);
    if (parsedOperation.kind !== purpose) {
      return false;
    }
    return purpose === 'request'
      ? parsedOperation.requestId === undefined && parsedOperation.idempotencyKey === requestId
      : parsedOperation.requestId === requestId;
  } catch {
    return false;
  }
}

function isDeletionState(value: unknown): value is DeletionState {
  return typeof value === 'string' && (DELETION_STATES as readonly string[]).includes(value);
}

function isDeletionOperationPhase(value: unknown): value is DeletionOperationPhase {
  return typeof value === 'string' && (DELETION_OPERATION_PHASES as readonly string[]).includes(value);
}

function isRetryGuidance(value: unknown): value is 'none' | 'retry_status_later' | 'contact_privacy_support' {
  return value === 'none' || value === 'retry_status_later' || value === 'contact_privacy_support';
}

function isFutureDeletionDeadline(value: unknown, now: number): value is string {
  return isRfc3339DateTime(value)
    && Date.parse(value) > now
    && Date.parse(value) - now <= DELETION_DEADLINE_MAX_AGE_MS;
}

function isSafeReauthAuthorizationUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  let authorizationUrl: URL;
  try {
    authorizationUrl = new URL(value);
  } catch {
    return false;
  }
  if (authorizationUrl.protocol !== 'https:'
    || !authorizationUrl.hostname
    || authorizationUrl.username
    || authorizationUrl.password
    || authorizationUrl.hash) {
    return false;
  }
  const prohibitedParameters = new Set([
    'access_token',
    'code',
    'deletion_capability',
    'id_token',
    'refresh_token',
    'token',
  ]);
  return [...authorizationUrl.searchParams.keys()]
    .every((key) => !prohibitedParameters.has(key.toLowerCase()));
}

function isRecentReauthIntentDateTime(value: unknown, now: number): value is string {
  return isRfc3339DateTime(value)
    && Date.parse(value) <= now + CLOCK_SKEW_MS
    && Date.parse(value) >= now - DELETION_REAUTH_MAX_AGE_MS;
}
function isFutureDateTimeWithin(value: unknown, maxAgeMs: number, now: number): value is string {
  return isRfc3339DateTime(value)
    && Date.parse(value) > now
    && Date.parse(value) - now <= maxAgeMs;
}

function isRecentDateTime(value: unknown, now: number): value is string {
  return isRfc3339DateTime(value)
    && Date.parse(value) <= now + CLOCK_SKEW_MS
    && Date.parse(value) >= now - DELETION_DEADLINE_MAX_AGE_MS;
}

function isExchangeCode(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{32,512}$/.test(value);
}
