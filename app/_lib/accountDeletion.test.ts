import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  acknowledgeDeletionOperation,
  advanceDeletionOperation,
  createDeletionOperation,
  createDeletionReauthOperation,
  parseDeletionCancellationAcknowledgement,
  parseDeletionCapabilityResponse,
  parseDeletionRequestAcknowledgement,
  parseDeletionStatus,
  parseNativeDeletionReauthHandoff,
  parseDeletionReauthTransient,
  parseDeletionReauthTransactionIntent,
  parseStoredDeletionCapability,
  parseStoredDeletionOperation,
  parseStoredDeletionOperationRecord,
  parseStoredDeletionStatus,
  parseStoredDeletionStatusRecord,
  type DeletionReauthTransient,
} from './accountDeletion';
import { MobileReleaseClient, type MobileReleaseTransport } from './native/mobileRelease';

const NOW = Date.parse('2026-07-13T00:00:00Z');
const REQUEST_ID = '123e4567-e89b-42d3-a456-426614174000';
const OPERATION_ID = '223e4567-e89b-42d3-a456-426614174000';
const OTHER_REQUEST_ID = '523e4567-e89b-42d3-a456-426614174000';
const STATUS_HANDLE = `${REQUEST_ID}.${'a'.repeat(64)}`;
const CAPABILITY = `${'a'.repeat(24)}.${'b'.repeat(24)}.${'c'.repeat(43)}`;
const TRANSIENT: DeletionReauthTransient = {
  version: 1,
  transactionId: '323e4567-e89b-42d3-a456-426614174000',
  provider: 'google',
  purpose: 'cancel',
  requestId: REQUEST_ID,
  platform: 'web',
  state: 'a'.repeat(43),
  nonce: 'b'.repeat(43),
  codeVerifier: 'c'.repeat(43),
  exchangeIdempotencyKey: OPERATION_ID,
  expiresAtUtc: '2026-07-13T00:05:00Z',
  authorizationUrl: 'https://accounts.example.com/authorize',
};

describe('account deletion contract codecs', () => {
  it('removes the mobile-release deletion transport and client surface', () => {
    expectTypeOf<Extract<keyof MobileReleaseTransport, 'requestAccountDeletion'>>()
      .toEqualTypeOf<never>();
    expect(MobileReleaseClient.prototype).not.toHaveProperty('requestAccountDeletion');
  });
  it('accepts only a request acknowledgement with a request-bound status handle and permitted deadline', () => {
    expect(parseDeletionRequestAcknowledgement({
      request_id: REQUEST_ID,
      state: 'deletion_pending',
      requested_at_utc: '2026-07-13T00:00:00Z',
      deadline_at_utc: '2026-08-12T00:00:00Z',
      status_handle: STATUS_HANDLE,
    }, NOW)).toMatchObject({ request_id: REQUEST_ID, status_handle: STATUS_HANDLE });

    expect(() => parseDeletionRequestAcknowledgement({
      request_id: REQUEST_ID,
      state: 'deletion_pending',
      requested_at_utc: '2026-07-13T00:00:00Z',
      deadline_at_utc: '2026-08-12T00:00:00Z',
      status_handle: STATUS_HANDLE,
      unexpected: true,
    }, NOW)).toThrow('INVALID_DELETION_ACKNOWLEDGEMENT');
  });

  it('rejects cancelable states outside an active pending deletion', () => {
    expect(() => parseDeletionStatus({
      request_id: REQUEST_ID,
      state: 'finalized',
      deadline_at_utc: '2026-07-12T00:00:00Z',
      cancelable: true,
      retry_guidance: 'none',
    }, REQUEST_ID, NOW)).toThrow('INVALID_DELETION_STATUS');

    expect(() => parseDeletionStatus({
      request_id: REQUEST_ID,
      state: 'deletion_pending',
      deadline_at_utc: '2026-02-31T00:00:00Z',
      cancelable: false,
      retry_guidance: 'none',
    }, REQUEST_ID, NOW)).toThrow('INVALID_DELETION_STATUS');
    expect(parseDeletionStatus({
      request_id: REQUEST_ID,
      state: 'deletion_pending',
      deadline_at_utc: '2026-08-12T00:00:00Z',
      cancelable: true,
      retry_guidance: 'none',
    }, REQUEST_ID, NOW).cancelable).toBe(true);
    expect(parseDeletionStatus({
      request_id: REQUEST_ID,
      state: 'finalized',
      deadline_at_utc: null,
      cancelable: false,
      retry_guidance: 'none',
    }, REQUEST_ID, NOW).deadline_at_utc).toBeNull();
  });

  it('requires the complete cancellation acknowledgement instead of a matching request id alone', () => {
    expect(() => parseDeletionCancellationAcknowledgement({
      request_id: REQUEST_ID,
      request_state: 'cancelled',
      account_state: 'active',
      cancelled_at_utc: '2026-07-13T00:00:00Z',
      reauthentication_required: false,
    }, REQUEST_ID, NOW)).toThrow('INVALID_CANCELLATION_ACKNOWLEDGEMENT');
  });

  it('keeps idempotency stable through durable ambiguous retries and permits only monotonic local cleanup', () => {
    const sending = createDeletionOperation('request', OPERATION_ID, undefined, NOW);
    const unknown = advanceDeletionOperation(sending, 'outcome_unknown', NOW + 1);
    const recoveredUnknown = parseStoredDeletionOperationRecord(JSON.stringify(unknown));
    if (recoveredUnknown.kind !== 'valid') {
      throw new Error('ambiguous retry journal should be valid');
    }

    const replay = advanceDeletionOperation(recoveredUnknown.value, 'outcome_unknown', NOW + 2);
    const acknowledged = acknowledgeDeletionOperation(replay, REQUEST_ID, NOW + 3);
    const cleanup = advanceDeletionOperation(acknowledged, 'local_cleanup_pending', NOW + 4);
    const complete = advanceDeletionOperation(cleanup, 'local_complete', NOW + 5);

    expect(replay).toMatchObject({
      phase: 'outcome_unknown',
      idempotencyKey: OPERATION_ID,
    });
    expect(cleanup.idempotencyKey).toBe(OPERATION_ID);
    expect(acknowledgeDeletionOperation(acknowledged, REQUEST_ID, NOW + 6)).toMatchObject({
      phase: 'server_acknowledged',
      idempotencyKey: OPERATION_ID,
      requestId: REQUEST_ID,
    });
    expect(() => acknowledgeDeletionOperation(acknowledged, OTHER_REQUEST_ID)).toThrow(
      'DELETION_OPERATION_REQUEST_ID_MISMATCH',
    );
    expect(advanceDeletionOperation(complete, 'local_complete', NOW + 7)).toMatchObject({
      phase: 'local_complete',
      idempotencyKey: OPERATION_ID,
      requestId: REQUEST_ID,
    });
    expect(() => advanceDeletionOperation(complete, 'sending')).toThrow(
      'ILLEGAL_DELETION_OPERATION_TRANSITION',
    );
    expect(() => advanceDeletionOperation(complete, 'server_acknowledged')).toThrow(
      'ILLEGAL_DELETION_OPERATION_TRANSITION',
    );
    expect(() => advanceDeletionOperation(complete, 'local_cleanup_pending')).toThrow(
      'ILLEGAL_DELETION_OPERATION_TRANSITION',
    );
    expect(parseStoredDeletionOperation(cleanup)).toMatchObject({
      phase: 'local_cleanup_pending',
      idempotencyKey: OPERATION_ID,
      requestId: REQUEST_ID,
    });
    expect(parseStoredDeletionOperation({ ...cleanup, idempotencyKey: 'not-a-uuid' })).toBeNull();
  });
  it('durably separates reauthentication, native begin, and server dispatch ownership', () => {
    const reauthPending = createDeletionReauthOperation(OPERATION_ID, NOW);
    const nativeBeginPending = advanceDeletionOperation(
      reauthPending,
      'native_begin_pending',
      NOW + 1,
    );
    const sending = advanceDeletionOperation(nativeBeginPending, 'sending', NOW + 2);

    expect(reauthPending).toMatchObject({
      kind: 'request',
      phase: 'reauth_pending',
      idempotencyKey: OPERATION_ID,
    });
    expect(nativeBeginPending.phase).toBe('native_begin_pending');
    expect(sending.phase).toBe('sending');
    expect(() => advanceDeletionOperation(reauthPending, 'sending', NOW + 3)).toThrow(
      'ILLEGAL_DELETION_OPERATION_TRANSITION',
    );
    expect(() => advanceDeletionOperation(nativeBeginPending, 'outcome_unknown', NOW + 4)).toThrow(
      'ILLEGAL_DELETION_OPERATION_TRANSITION',
    );
  });
  it('validates a durable pre-dispatch reauthentication owner', () => {
    expect(parseDeletionReauthTransactionIntent({
      version: 1,
      provider: 'google',
      purpose: 'request',
      requestId: OPERATION_ID,
      platform: 'android',
      state: 's'.repeat(43),
      nonce: 'n'.repeat(43),
      codeVerifier: 'v'.repeat(43),
      transactionIdempotencyKey: OTHER_REQUEST_ID,
      exchangeIdempotencyKey: REQUEST_ID,
      createdAtUtc: '2026-07-13T00:00:00Z',
    }, NOW)).toMatchObject({
      requestId: OPERATION_ID,
      transactionIdempotencyKey: OTHER_REQUEST_ID,
    });
  });

  it('rejects malformed persisted receipts and binds native capability handoff to one request', () => {
    expect(parseStoredDeletionStatus({ requestId: REQUEST_ID, statusHandle: 'opaque-but-unbound' })).toBeNull();
    expect(parseNativeDeletionReauthHandoff({
      version: 1,
      kind: 'capability',
      capability: {
        version: 1,
        requestId: REQUEST_ID,
        purpose: 'cancel',
        value: CAPABILITY,
        expiresAtUtc: '2026-07-13T00:10:00Z',
      },
    }, NOW)).toMatchObject({ kind: 'capability', capability: { requestId: REQUEST_ID } });
  });

  it('distinguishes absent, corrupt, impossible, and current durable journal records', () => {
    const sending = createDeletionOperation('request', OPERATION_ID, undefined, NOW);
    const malformedJournal = '{';
    const identityRollbackStatus = JSON.stringify({
      requestId: REQUEST_ID,
      statusHandle: `${OTHER_REQUEST_ID}.${'a'.repeat(64)}`,
    });
    const impossiblePhaseRollback = JSON.stringify({
      ...sending,
      phase: 'local_complete',
    });

    expect(parseStoredDeletionOperationRecord(null)).toEqual({ kind: 'absent' });
    expect(parseStoredDeletionOperationRecord(malformedJournal)).toEqual({ kind: 'corrupt' });
    expect(parseStoredDeletionStatusRecord('')).toEqual({ kind: 'corrupt' });
    expect(parseStoredDeletionStatusRecord(identityRollbackStatus)).toEqual({ kind: 'corrupt' });
    expect(parseStoredDeletionOperationRecord(impossiblePhaseRollback)).toEqual({ kind: 'corrupt' });
    expect(parseStoredDeletionStatusRecord(JSON.stringify({
      requestId: REQUEST_ID,
      statusHandle: STATUS_HANDLE,
    }))).toMatchObject({
      kind: 'valid',
      value: { requestId: REQUEST_ID, statusHandle: STATUS_HANDLE },
    });
    expect(parseStoredDeletionOperationRecord(JSON.stringify(sending))).toMatchObject({
      kind: 'valid',
      value: { idempotencyKey: OPERATION_ID, phase: 'sending' },
    });
  });

  it('rejects stale terminal operations that try to regress or bind a different request identity', () => {
    const acknowledged = acknowledgeDeletionOperation(
      createDeletionOperation('request', OPERATION_ID, undefined, NOW),
      REQUEST_ID,
      NOW + 1,
    );
    const complete = advanceDeletionOperation(acknowledged, 'local_complete', NOW + 2);
    const terminalJournal = parseStoredDeletionOperationRecord(JSON.stringify(complete));
    if (terminalJournal.kind !== 'valid') {
      throw new Error('terminal deletion journal should be valid');
    }

    expect(parseStoredDeletionOperationRecord(JSON.stringify({
      ...complete,
      phase: 'outcome_unknown',
    }))).toEqual({ kind: 'corrupt' });
    expect(() => advanceDeletionOperation(terminalJournal.value, 'outcome_unknown')).toThrow(
      'ILLEGAL_DELETION_OPERATION_TRANSITION',
    );
    expect(() => parseDeletionStatus({
      request_id: OTHER_REQUEST_ID,
      state: 'deletion_pending',
      deadline_at_utc: '2026-08-12T00:00:00Z',
      cancelable: true,
      retry_guidance: 'none',
    }, REQUEST_ID, NOW, terminalJournal.value)).toThrow('INVALID_DELETION_STATUS');
  });

  it('rejects response request identities that do not match the durable operation', () => {
    const otherOperation = acknowledgeDeletionOperation(
      createDeletionOperation('request', OPERATION_ID, undefined, NOW),
      OTHER_REQUEST_ID,
      NOW + 1,
    );

    expect(() => parseDeletionStatus({
      request_id: REQUEST_ID,
      state: 'deletion_pending',
      deadline_at_utc: '2026-08-12T00:00:00Z',
      cancelable: true,
      retry_guidance: 'none',
    }, REQUEST_ID, NOW, otherOperation)).toThrow('INVALID_DELETION_STATUS');
    expect(() => parseDeletionCancellationAcknowledgement({
      request_id: OTHER_REQUEST_ID,
      request_state: 'cancelled',
      account_state: 'active',
      cancelled_at_utc: '2026-07-13T00:00:00Z',
      reauthentication_required: true,
    }, REQUEST_ID, NOW)).toThrow('INVALID_CANCELLATION_ACKNOWLEDGEMENT');
  });

  it('rejects capability responses with a mismatched request identity or noncanonical fields', () => {
    expect(() => parseDeletionCapabilityResponse({
      result_type: 'deletion_capability',
      deletion_capability: CAPABILITY,
      purpose: 'cancel',
      expires_at_utc: '2026-07-13T00:09:00Z',
      request_id: OTHER_REQUEST_ID,
    }, TRANSIENT, NOW)).toThrow('INVALID_CAPABILITY_RESPONSE');
    expect(() => parseDeletionCapabilityResponse({
      result_type: 'deletion_capability',
      deletion_capability: CAPABILITY,
      purpose: 'cancel',
      expires_at_utc: '2026-07-13T00:09:00Z',
      request_id: REQUEST_ID,
      unexpected: true,
    }, TRANSIENT, NOW)).toThrow('INVALID_CAPABILITY_RESPONSE');
  });
  it('separates request and cancel capabilities by durable request scope and purpose', () => {
    const requestOperation = createDeletionOperation('request', OPERATION_ID, undefined, NOW);
    const requestTransient: DeletionReauthTransient = {
      ...TRANSIENT,
      purpose: 'request',
      requestId: OPERATION_ID,
    };
    const requestCapability = {
      result_type: 'deletion_capability',
      deletion_capability: CAPABILITY,
      purpose: 'request',
      expires_at_utc: '2026-07-13T00:09:00Z',
      request_id: OPERATION_ID,
    };

    expect(parseDeletionReauthTransient(requestTransient, NOW)).toMatchObject({
      purpose: 'request',
      requestId: OPERATION_ID,
    });
    expect(parseDeletionReauthTransient({ ...requestTransient, unexpected: true }, NOW)).toBeNull();
    expect(parseStoredDeletionCapability({
      version: 1,
      requestId: OPERATION_ID,
      purpose: 'request',
      value: CAPABILITY,
      expiresAtUtc: '2026-07-13T00:10:00Z',
    }, NOW)).toMatchObject({
      purpose: 'request',
      requestId: OPERATION_ID,
    });
    expect(parseStoredDeletionCapability({
      version: 1,
      requestId: OPERATION_ID,
      purpose: 'request',
      value: CAPABILITY,
      expiresAtUtc: '2026-07-13T00:10:00Z',
      unexpected: true,
    }, NOW)).toBeNull();
    expect(parseDeletionCapabilityResponse(
      requestCapability,
      requestTransient,
      NOW,
      requestOperation,
    )).toMatchObject({ purpose: 'request', request_id: OPERATION_ID });
    expect(() => parseDeletionCapabilityResponse(
      { ...requestCapability, purpose: 'cancel' },
      requestTransient,
      NOW,
      requestOperation,
    )).toThrow('INVALID_CAPABILITY_RESPONSE');
    expect(() => parseDeletionCapabilityResponse({
      ...requestCapability,
      purpose: 'cancel',
      request_id: REQUEST_ID,
    }, TRANSIENT, NOW, requestOperation)).toThrow('INVALID_CAPABILITY_RESPONSE');

    const resumedRequestOperation = advanceDeletionOperation(requestOperation, 'outcome_unknown', NOW + 1);
    expect(resumedRequestOperation.idempotencyKey).toBe(OPERATION_ID);
    expect(parseDeletionCapabilityResponse(
      requestCapability,
      requestTransient,
      NOW,
      resumedRequestOperation,
    ).request_id).toBe(OPERATION_ID);
  });
});
