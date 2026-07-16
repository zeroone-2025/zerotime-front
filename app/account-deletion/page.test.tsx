import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DELETION_NATIVE_REAUTH_HANDOFF_STORAGE_KEY,
  DELETION_OPERATION_STORAGE_KEY,
  DELETION_STATUS_STORAGE_KEY,
} from '@/_lib/accountDeletion';
import AccountDeletionPage from './page';
const NATIVE_DISPLAY_EPOCH = '18446744073709551615';

const dependencies = vi.hoisted(() => {
  const nativeStorageEntries = new Map<string, string>();
  return {
    accessToken: 'active-access-token',
    apiPost: vi.fn(),
    authApiGet: vi.fn(),
    authApiPost: vi.fn(),
    ensureNativeAccountDeletionBarrier: vi.fn(),
    clearNativeAuthSessionAfterAccountDeletionAcknowledgement: vi.fn(),
    finalizeNativeAccountDeletionBarrier: vi.fn(),
    releaseNativeAuthSessionAfterDeletionCancellation: vi.fn(),
    clearUser: vi.fn(),
    createIdempotencyKey: vi.fn(() => '223e4567-e89b-42d3-a456-426614174000'),
    getQueryClient: vi.fn(() => undefined),
    logoutUser: vi.fn(),
    nativePlatform: false,
    nativeStorage: {
      get: vi.fn(async (key: string) => nativeStorageEntries.get(key) ?? null),
      isAvailable: vi.fn(async () => true),
      remove: vi.fn(async (key: string) => {
        nativeStorageEntries.delete(key);
      }),
      set: vi.fn(async (key: string, value: string) => {
        nativeStorageEntries.set(key, value);
      }),
    },
    nativeStorageEntries,
    resetAuthState: vi.fn(),
  };
});

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => dependencies.nativePlatform ? 'android' : 'web',
  },
}));

vi.mock('@/_components/auth/SocialLoginButton', () => ({
  default: () => null,
}));

vi.mock('@/_lib/api', () => ({
  api: {
    post: dependencies.apiPost,
  },
  authApi: {
    get: dependencies.authApiGet,
    post: dependencies.authApiPost,
  },
  logoutUser: dependencies.logoutUser,
  resetAuthState: dependencies.resetAuthState,
}));

vi.mock('@/_lib/auth/tokenStore', () => ({
  getAccessToken: () => dependencies.accessToken,
}));

vi.mock('@/_lib/native/mobileRelease', () => ({
  MOBILE_RELEASE_CONTRACT: 'mobile-release.v1',
  createIdempotencyKey: dependencies.createIdempotencyKey,
}));

vi.mock('@/_lib/native/nativeAuth', () => ({
  clearNativeAuthSessionAfterAccountDeletionAcknowledgement:
    dependencies.clearNativeAuthSessionAfterAccountDeletionAcknowledgement,
  createNativeAuthSecureStorageAdapter: () => dependencies.nativeStorage,
  isNativeAuthPlatform: () => dependencies.nativePlatform,
  releaseNativeAuthSessionAfterDeletionCancellation:
    dependencies.releaseNativeAuthSessionAfterDeletionCancellation,
}));

vi.mock('@/_lib/store/useUserStore', () => ({
  useUserStore: {
    getState: () => ({ clearUser: dependencies.clearUser }),
  },
}));

vi.mock('@/providers', () => ({
  ensureNativeAccountDeletionBarrier: dependencies.ensureNativeAccountDeletionBarrier,
  finalizeNativeAccountDeletionBarrier: dependencies.finalizeNativeAccountDeletionBarrier,
  getQueryClient: dependencies.getQueryClient,
}));

const REQUEST_ID = '123e4567-e89b-42d3-a456-426614174000';
const STATUS_HANDLE = `${REQUEST_ID}.${'a'.repeat(64)}`;
const CORRUPT_STATUS_JOURNAL = '{  "requestId": "tampered", "statusHandle": "unbound"  }';
const CORRUPT_OPERATION_JOURNAL = '{  "version": 1, "kind": "request", "phase": "sending"  }';
const REQUEST_OPERATION_ID = '223e4567-e89b-42d3-a456-426614174000';
const CANCEL_OPERATION_ID = '323e4567-e89b-42d3-a456-426614174000';
const CAPABILITY_VALUE = `${'a'.repeat(16)}.${'b'.repeat(16)}.${'c'.repeat(16)}`;

function nativeCapabilityRecord(
  purpose: 'request' | 'cancel',
  requestId: string,
  expiresAtUtc = new Date(Date.now() + 5 * 60 * 1000).toISOString(),
): string {
  return JSON.stringify({
    version: 1,
    kind: 'capability',
    capability: {
      version: 1,
      requestId,
      purpose,
      value: CAPABILITY_VALUE,
      expiresAtUtc,
    },
  });
}

function operationRecord(
  kind: 'request' | 'cancel',
  phase: 'reauth_pending' | 'native_begin_pending' | 'sending' | 'outcome_unknown' | 'server_acknowledged' | 'local_cleanup_pending' | 'local_complete',
  idempotencyKey: string,
  requestId?: string,
): string {
  return JSON.stringify({
    version: 1,
    kind,
    phase,
    idempotencyKey,
    ...(requestId ? { requestId } : {}),
    updatedAtUtc: new Date().toISOString(),
  });
}

function requestAcknowledgement() {
  const requestedAtUtc = new Date().toISOString();
  return {
    request_id: REQUEST_OPERATION_ID,
    state: 'deletion_pending',
    requested_at_utc: requestedAtUtc,
    deadline_at_utc: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    status_handle: `${REQUEST_OPERATION_ID}.${'b'.repeat(64)}`,
  };
}

async function renderAccountDeletionPage(): Promise<void> {
  render(<AccountDeletionPage />);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function expectRecoveryToCloseNewDeletionRequests(): void {
  const requestButton = screen.queryByRole('button', { name: '삭제 예약 요청' });
  expect(requestButton === null || requestButton.hasAttribute('disabled')).toBe(true);
}

function expectNoDeletionEndpointCalls(): void {
  expect(dependencies.authApiGet).not.toHaveBeenCalled();
  expect(dependencies.authApiPost).not.toHaveBeenCalled();
}

function expectNoDeletionSuccessState(): void {
  expect(screen.queryByText(/^현재 상태:/)).not.toBeInTheDocument();
  expect(screen.queryByText('삭제 처리 완료')).not.toBeInTheDocument();
}

describe('AccountDeletionPage durable journal recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.apiPost.mockReset();
    dependencies.authApiGet.mockReset();
    dependencies.authApiPost.mockReset();
    dependencies.accessToken = 'active-access-token';
    window.localStorage.clear();
    window.sessionStorage.clear();
    dependencies.ensureNativeAccountDeletionBarrier.mockReset();
    dependencies.ensureNativeAccountDeletionBarrier.mockResolvedValue(NATIVE_DISPLAY_EPOCH);
    dependencies.finalizeNativeAccountDeletionBarrier.mockReset();
    dependencies.finalizeNativeAccountDeletionBarrier.mockResolvedValue(undefined);
    dependencies.nativeStorage.get.mockImplementation(
      async (key: string) => dependencies.nativeStorageEntries.get(key) ?? null,
    );
    dependencies.clearNativeAuthSessionAfterAccountDeletionAcknowledgement.mockReset();
    dependencies.clearNativeAuthSessionAfterAccountDeletionAcknowledgement.mockResolvedValue(undefined);
    dependencies.nativePlatform = false;
    dependencies.nativeStorageEntries.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('preserves a corrupt status journal and fails closed before any deletion endpoint can run', async () => {
    window.sessionStorage.setItem(DELETION_STATUS_STORAGE_KEY, CORRUPT_STATUS_JOURNAL);

    await renderAccountDeletionPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '삭제 상태 기록이 손상되어 상태 확인이나 변경을 전송하지 않았습니다.',
    );
    expect(window.sessionStorage.getItem(DELETION_STATUS_STORAGE_KEY)).toBe(CORRUPT_STATUS_JOURNAL);
    expectRecoveryToCloseNewDeletionRequests();
    expectNoDeletionEndpointCalls();
    expectNoDeletionSuccessState();
  });

  it('preserves a corrupt operation journal and fails closed before any deletion endpoint can run', async () => {
    window.sessionStorage.setItem(DELETION_OPERATION_STORAGE_KEY, CORRUPT_OPERATION_JOURNAL);

    await renderAccountDeletionPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '삭제 작업 기록이 손상되었거나 서로 일치하지 않습니다. 기존 기록은 보존했으며 상태 변경을 전송하지 않았습니다.',
    );
    expect(window.sessionStorage.getItem(DELETION_OPERATION_STORAGE_KEY)).toBe(CORRUPT_OPERATION_JOURNAL);
    expectRecoveryToCloseNewDeletionRequests();
    expectNoDeletionEndpointCalls();
    expectNoDeletionSuccessState();
  });

  it('loads a valid stored status through the status endpoint', async () => {
    const deadlineAtUtc = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    window.sessionStorage.setItem(DELETION_STATUS_STORAGE_KEY, JSON.stringify({
      requestId: REQUEST_ID,
      statusHandle: STATUS_HANDLE,
    }));
    window.sessionStorage.setItem(DELETION_OPERATION_STORAGE_KEY, JSON.stringify({
      version: 1,
      kind: 'request',
      phase: 'server_acknowledged',
      idempotencyKey: REQUEST_ID,
      requestId: REQUEST_ID,
      updatedAtUtc: new Date().toISOString(),
    }));
    dependencies.authApiGet.mockResolvedValue({
      data: {
        request_id: REQUEST_ID,
        state: 'deletion_pending',
        deadline_at_utc: deadlineAtUtc,
        cancelable: false,
        retry_guidance: 'none',
      },
    });

    await renderAccountDeletionPage();

    expect(await screen.findByText('현재 상태: 삭제 예약 접수됨')).toBeVisible();
    expect(dependencies.authApiGet).toHaveBeenCalledOnce();
    expect(dependencies.authApiGet).toHaveBeenCalledWith(
      `/v1/account-deletion/requests/${REQUEST_ID}/status`,
      {
        headers: {
          'X-ZeroTime-Contract': 'mobile-release.v1',
          'X-Deletion-Status-Handle': STATUS_HANDLE,
        },
      },
    );
    expect(dependencies.authApiPost).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('reauthenticates an expired request capability and replays the preserved request operation', async () => {
    dependencies.nativePlatform = true;
    dependencies.nativeStorageEntries.set(
      DELETION_OPERATION_STORAGE_KEY,
      operationRecord('request', 'outcome_unknown', REQUEST_OPERATION_ID),
    );
    dependencies.nativeStorageEntries.set(
      DELETION_NATIVE_REAUTH_HANDOFF_STORAGE_KEY,
      nativeCapabilityRecord('request', REQUEST_OPERATION_ID, new Date(Date.now() - 1_000).toISOString()),
    );
    dependencies.apiPost.mockResolvedValue({
      data: {
        transaction_id: REQUEST_ID,
        provider: 'google',
        purpose: 'request',
        authorization_url: 'https://accounts.example.com/authorize',
        expires_at_utc: new Date(Date.now() + 60_000).toISOString(),
      },
    });

    await renderAccountDeletionPage();

    expect(dependencies.nativeStorageEntries.get(DELETION_NATIVE_REAUTH_HANDOFF_STORAGE_KEY)).toBeUndefined();
    const reauthButton = await screen.findByRole('button', { name: 'Google로 재인증' });
    await act(async () => {
      reauthButton.click();
    });
    await waitFor(() => expect(dependencies.apiPost).toHaveBeenCalledWith(
      '/v1/account-deletion/reauth/transactions',
      expect.objectContaining({ provider: 'google', purpose: 'request' }),
      {
        headers: {
          'X-ZeroTime-Contract': 'mobile-release.v1',
          'Idempotency-Key': REQUEST_OPERATION_ID,
        },
      },
    ));
    await waitFor(() => expect(JSON.parse(
      dependencies.nativeStorageEntries.get(DELETION_NATIVE_REAUTH_HANDOFF_STORAGE_KEY) ?? '{}',
    )).toMatchObject({
      kind: 'transient',
      transient: { requestId: REQUEST_OPERATION_ID, purpose: 'request' },
    }));

    dependencies.nativeStorageEntries.set(
      DELETION_NATIVE_REAUTH_HANDOFF_STORAGE_KEY,
      nativeCapabilityRecord('request', REQUEST_OPERATION_ID),
    );
    dependencies.authApiPost.mockResolvedValue({ data: requestAcknowledgement() });
    cleanup();

    await renderAccountDeletionPage();

    await waitFor(() => expect(dependencies.authApiPost).toHaveBeenCalledWith(
      '/v1/account-deletion/requests',
      {},
      {
        headers: {
          'X-ZeroTime-Contract': 'mobile-release.v1',
          'Idempotency-Key': REQUEST_OPERATION_ID,
          'X-Deletion-Capability': CAPABILITY_VALUE,
        },
      },
    ));
    await waitFor(() => {
      expect(JSON.parse(
        dependencies.nativeStorageEntries.get(DELETION_OPERATION_STORAGE_KEY) ?? '{}',
      )).toMatchObject({ phase: 'local_complete', idempotencyKey: REQUEST_OPERATION_ID });
    });
  });
  it('closes native admission before a capability-authorized deletion request reaches the network', async () => {
    const events: string[] = [];
    dependencies.nativePlatform = true;
    dependencies.nativeStorageEntries.set(
      DELETION_OPERATION_STORAGE_KEY,
      operationRecord('request', 'sending', REQUEST_OPERATION_ID),
    );
    dependencies.nativeStorageEntries.set(
      DELETION_NATIVE_REAUTH_HANDOFF_STORAGE_KEY,
      nativeCapabilityRecord('request', REQUEST_OPERATION_ID),
    );
    dependencies.ensureNativeAccountDeletionBarrier.mockImplementation(async () => {
      events.push('barrier');
      return NATIVE_DISPLAY_EPOCH;
    });
    dependencies.authApiPost.mockImplementation(async () => {
      events.push('network');
      return { data: requestAcknowledgement() };
    });

    await renderAccountDeletionPage();

    await waitFor(() => expect(dependencies.authApiPost).toHaveBeenCalledOnce());
    expect(events.slice(0, 2)).toEqual(['barrier', 'network']);
  });

  it('keeps native admission closed when a request outcome is unknown', async () => {
    const events: string[] = [];
    dependencies.nativePlatform = true;
    dependencies.nativeStorageEntries.set(
      DELETION_OPERATION_STORAGE_KEY,
      operationRecord('request', 'sending', REQUEST_OPERATION_ID),
    );
    dependencies.nativeStorageEntries.set(
      DELETION_NATIVE_REAUTH_HANDOFF_STORAGE_KEY,
      nativeCapabilityRecord('request', REQUEST_OPERATION_ID),
    );
    dependencies.ensureNativeAccountDeletionBarrier.mockImplementation(async () => {
      events.push('barrier');
      return NATIVE_DISPLAY_EPOCH;
    });
    dependencies.authApiPost.mockImplementation(async () => {
      events.push('network');
      throw new Error('network unavailable');
    });

    await renderAccountDeletionPage();

    await waitFor(() => {
      expect(JSON.parse(
        dependencies.nativeStorageEntries.get(DELETION_OPERATION_STORAGE_KEY) ?? '{}',
      )).toMatchObject({ phase: 'outcome_unknown', idempotencyKey: REQUEST_OPERATION_ID });
    });
    expect(events).toEqual(['barrier', 'network']);
    expect(JSON.parse(
      dependencies.nativeStorageEntries.get(DELETION_NATIVE_REAUTH_HANDOFF_STORAGE_KEY) ?? '{}',
    )).toMatchObject({
      kind: 'capability',
      capability: { purpose: 'request', requestId: REQUEST_OPERATION_ID },
    });
  });

  it('resumes acknowledged request cleanup after restart', async () => {
    const events: string[] = [];
    dependencies.nativePlatform = true;
    dependencies.nativeStorageEntries.set(DELETION_STATUS_STORAGE_KEY, JSON.stringify({
      requestId: REQUEST_ID,
      statusHandle: STATUS_HANDLE,
    }));
    dependencies.nativeStorageEntries.set(
      DELETION_OPERATION_STORAGE_KEY,
      operationRecord('request', 'server_acknowledged', REQUEST_OPERATION_ID, REQUEST_ID),
    );
    dependencies.ensureNativeAccountDeletionBarrier.mockImplementation(async () => {
      if (!events.includes('barrier')) events.push('barrier');
      return NATIVE_DISPLAY_EPOCH;
    });
    dependencies.clearNativeAuthSessionAfterAccountDeletionAcknowledgement.mockImplementation(async () => {
      events.push('cleanup');
    });
    dependencies.authApiGet.mockResolvedValue({
      data: {
        request_id: REQUEST_ID,
        state: 'deletion_pending',
        deadline_at_utc: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        cancelable: false,
        retry_guidance: 'none',
      },
    });

    await renderAccountDeletionPage();

    await waitFor(() => {
      expect(JSON.parse(
        dependencies.nativeStorageEntries.get(DELETION_OPERATION_STORAGE_KEY) ?? '{}',
      )).toMatchObject({ phase: 'local_complete', requestId: REQUEST_ID });
    });
    expect(events).toEqual(['barrier', 'cleanup']);
    expect(dependencies.nativeStorageEntries.get(DELETION_STATUS_STORAGE_KEY)).not.toBeNull();
    expect(dependencies.authApiPost).not.toHaveBeenCalled();
  });

  it('reconciles a cancelled status through cancel cleanup after its capability expires', async () => {
    dependencies.nativePlatform = true;
    dependencies.nativeStorageEntries.set(DELETION_STATUS_STORAGE_KEY, JSON.stringify({
      requestId: REQUEST_ID,
      statusHandle: STATUS_HANDLE,
    }));
    dependencies.nativeStorageEntries.set(
      DELETION_OPERATION_STORAGE_KEY,
      operationRecord('cancel', 'outcome_unknown', CANCEL_OPERATION_ID, REQUEST_ID),
    );
    dependencies.nativeStorageEntries.set(
      DELETION_NATIVE_REAUTH_HANDOFF_STORAGE_KEY,
      nativeCapabilityRecord('cancel', REQUEST_ID, new Date(Date.now() - 1_000).toISOString()),
    );
    dependencies.authApiGet.mockResolvedValue({
      data: {
        request_id: REQUEST_ID,
        state: 'cancelled',
        deadline_at_utc: new Date().toISOString(),
        cancelable: false,
        retry_guidance: 'none',
      },
    });

    await renderAccountDeletionPage();

    await waitFor(() => {
      expect(JSON.parse(
        dependencies.nativeStorageEntries.get(DELETION_OPERATION_STORAGE_KEY) ?? '{}',
      )).toMatchObject({
        phase: 'local_complete',
        idempotencyKey: CANCEL_OPERATION_ID,
        requestId: REQUEST_ID,
      });
    });
    expect(dependencies.authApiGet).toHaveBeenCalledOnce();
    expect(dependencies.authApiPost).not.toHaveBeenCalled();
    expect(dependencies.ensureNativeAccountDeletionBarrier).toHaveBeenCalledOnce();
    expect(dependencies.finalizeNativeAccountDeletionBarrier).toHaveBeenCalledWith(
      NATIVE_DISPLAY_EPOCH,
    );
    expect(dependencies.clearNativeAuthSessionAfterAccountDeletionAcknowledgement).not.toHaveBeenCalled();
    expect(dependencies.nativeStorageEntries.get(DELETION_STATUS_STORAGE_KEY)).toBeUndefined();
    expect(dependencies.nativeStorageEntries.get(DELETION_NATIVE_REAUTH_HANDOFF_STORAGE_KEY))
      .toBeUndefined();
  });

  it('resumes acknowledged cancellation cleanup by finalizing the native mutation lifecycle', async () => {
    dependencies.nativePlatform = true;
    dependencies.nativeStorageEntries.set(DELETION_STATUS_STORAGE_KEY, JSON.stringify({
      requestId: REQUEST_ID,
      statusHandle: STATUS_HANDLE,
    }));
    dependencies.nativeStorageEntries.set(
      DELETION_OPERATION_STORAGE_KEY,
      operationRecord('cancel', 'server_acknowledged', CANCEL_OPERATION_ID, REQUEST_ID),
    );
    dependencies.nativeStorageEntries.set(
      DELETION_NATIVE_REAUTH_HANDOFF_STORAGE_KEY,
      nativeCapabilityRecord('cancel', REQUEST_ID),
    );

    await renderAccountDeletionPage();

    await waitFor(() => {
      expect(JSON.parse(
        dependencies.nativeStorageEntries.get(DELETION_OPERATION_STORAGE_KEY) ?? '{}',
      )).toMatchObject({ phase: 'local_complete', requestId: REQUEST_ID });
    });
    expect(dependencies.ensureNativeAccountDeletionBarrier).toHaveBeenCalledOnce();
    expect(dependencies.finalizeNativeAccountDeletionBarrier).toHaveBeenCalledWith(
      NATIVE_DISPLAY_EPOCH,
    );
    expect(dependencies.releaseNativeAuthSessionAfterDeletionCancellation).toHaveBeenCalledOnce();
    expect(dependencies.nativeStorageEntries.get(DELETION_STATUS_STORAGE_KEY)).toBeUndefined();
    expect(dependencies.nativeStorageEntries.get(DELETION_NATIVE_REAUTH_HANDOFF_STORAGE_KEY))
      .toBeUndefined();
    expectNoDeletionEndpointCalls();
  });
  it('does not close native admission for a pre-reauth request journal', async () => {
    dependencies.nativePlatform = true;
    dependencies.nativeStorageEntries.set(
      DELETION_OPERATION_STORAGE_KEY,
      operationRecord('request', 'reauth_pending', REQUEST_OPERATION_ID),
    );

    await renderAccountDeletionPage();

    expect(dependencies.ensureNativeAccountDeletionBarrier).not.toHaveBeenCalled();
    expectNoDeletionEndpointCalls();
  });

  it('replays one durable reauth transaction intent byte-for-byte after an ambiguous dispatch failure', async () => {
    dependencies.nativePlatform = true;
    dependencies.apiPost.mockRejectedValueOnce(new Error('reauth unavailable'));

    await renderAccountDeletionPage();
    await act(async () => {
      screen.getByRole('button', { name: 'Google로 재인증' }).click();
    });

    await waitFor(() => expect(dependencies.apiPost).toHaveBeenCalledOnce());
    const firstDispatch = dependencies.apiPost.mock.calls[0];
    expect(JSON.parse(
      dependencies.nativeStorageEntries.get(DELETION_OPERATION_STORAGE_KEY) ?? '{}',
    )).toMatchObject({ kind: 'request', phase: 'reauth_pending' });
    expect(JSON.parse(
      dependencies.nativeStorageEntries.get(DELETION_NATIVE_REAUTH_HANDOFF_STORAGE_KEY) ?? '{}',
    )).toMatchObject({
      kind: 'transaction_pending',
      intent: {
        purpose: 'request',
        requestId: REQUEST_OPERATION_ID,
        platform: 'android',
      },
    });

    dependencies.apiPost.mockResolvedValueOnce({
      data: {
        transaction_id: REQUEST_ID,
        provider: 'google',
        purpose: 'request',
        authorization_url: 'https://accounts.example.com/authorize',
        expires_at_utc: new Date(Date.now() + 60_000).toISOString(),
      },
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Google로 재인증' })).toBeEnabled();
    });
    await act(async () => {
      screen.getByRole('button', { name: 'Google로 재인증' }).click();
    });

    await waitFor(() => expect(dependencies.apiPost).toHaveBeenCalledTimes(2));
    expect(dependencies.apiPost.mock.calls[1]).toEqual(firstDispatch);
    expect(JSON.parse(
      dependencies.nativeStorageEntries.get(DELETION_NATIVE_REAUTH_HANDOFF_STORAGE_KEY) ?? '{}',
    )).toMatchObject({
      kind: 'transient',
      transient: {
        purpose: 'request',
        requestId: REQUEST_OPERATION_ID,
        platform: 'android',
        authorizationUrl: 'https://accounts.example.com/authorize',
      },
    });
    expect(dependencies.ensureNativeAccountDeletionBarrier).not.toHaveBeenCalled();
    expectNoDeletionEndpointCalls();
  });

  it('relies on the runtime to make a remounted request barrier idempotent', async () => {
    const events: string[] = [];
    dependencies.nativePlatform = true;
    dependencies.nativeStorageEntries.set(
      DELETION_OPERATION_STORAGE_KEY,
      operationRecord('request', 'sending', REQUEST_OPERATION_ID),
    );
    dependencies.nativeStorageEntries.set(
      DELETION_NATIVE_REAUTH_HANDOFF_STORAGE_KEY,
      nativeCapabilityRecord('request', REQUEST_OPERATION_ID),
    );
    dependencies.ensureNativeAccountDeletionBarrier.mockImplementation(async () => {
      if (!events.includes('barrier')) events.push('barrier');
      return NATIVE_DISPLAY_EPOCH;
    });
    dependencies.authApiPost.mockImplementation(async () => {
      events.push('network');
      throw new Error('network unavailable');
    });

    await renderAccountDeletionPage();
    await waitFor(() => expect(dependencies.authApiPost).toHaveBeenCalledOnce());
    cleanup();

    await renderAccountDeletionPage();
    await waitFor(() => expect(dependencies.authApiPost).toHaveBeenCalledTimes(2));

    expect(events.filter((event) => event === 'barrier')).toEqual(['barrier']);
  });

  it('keeps corrupt operation bytes quarantined while using a valid status handle read-only', async () => {
    const deadlineAtUtc = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    window.sessionStorage.setItem(DELETION_STATUS_STORAGE_KEY, JSON.stringify({
      requestId: REQUEST_ID,
      statusHandle: STATUS_HANDLE,
    }));
    window.sessionStorage.setItem(DELETION_OPERATION_STORAGE_KEY, CORRUPT_OPERATION_JOURNAL);
    dependencies.authApiGet.mockResolvedValue({
      data: {
        request_id: REQUEST_ID,
        state: 'deletion_pending',
        deadline_at_utc: deadlineAtUtc,
        cancelable: false,
        retry_guidance: 'none',
      },
    });

    await renderAccountDeletionPage();

    expect(await screen.findByText('현재 상태: 삭제 예약 접수됨')).toBeVisible();
    expect(dependencies.authApiGet).toHaveBeenCalledOnce();
    expect(dependencies.authApiPost).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(DELETION_OPERATION_STORAGE_KEY))
      .toBe(CORRUPT_OPERATION_JOURNAL);
  });

  it('creates a cancellation recovery terminal record for an externally cancelled request journal', async () => {
    const requestJournal = operationRecord(
      'request',
      'local_complete',
      REQUEST_OPERATION_ID,
      REQUEST_ID,
    );
    window.sessionStorage.setItem(DELETION_STATUS_STORAGE_KEY, JSON.stringify({
      requestId: REQUEST_ID,
      statusHandle: STATUS_HANDLE,
    }));
    window.sessionStorage.setItem(DELETION_OPERATION_STORAGE_KEY, requestJournal);
    dependencies.authApiGet.mockResolvedValue({
      data: {
        request_id: REQUEST_ID,
        state: 'cancelled',
        deadline_at_utc: new Date().toISOString(),
        cancelable: false,
        retry_guidance: 'none',
      },
    });

    await renderAccountDeletionPage();

    await waitFor(() => {
      expect(JSON.parse(
        window.sessionStorage.getItem(DELETION_OPERATION_STORAGE_KEY) ?? '{}',
      )).toMatchObject({
        kind: 'cancel',
        phase: 'local_complete',
        requestId: REQUEST_ID,
      });
    });
    expect(JSON.parse(
      window.sessionStorage.getItem('zerotime.account-deletion.operation.audit.v1') ?? '{}',
    )).toMatchObject({
      requestId: REQUEST_ID,
      operationBytes: requestJournal,
    });
    expect(window.sessionStorage.getItem(DELETION_STATUS_STORAGE_KEY)).toBeNull();
  });

  it('revalidates a capability at request dispatch without sending or recording an unknown outcome', async () => {
    dependencies.nativePlatform = true;
    const validCapability = nativeCapabilityRecord('request', REQUEST_OPERATION_ID);
    const expiredCapability = nativeCapabilityRecord(
      'request',
      REQUEST_OPERATION_ID,
      new Date(Date.now() - 1_000).toISOString(),
    );
    let capabilityReads = 0;
    dependencies.nativeStorageEntries.set(
      DELETION_OPERATION_STORAGE_KEY,
      operationRecord('request', 'sending', REQUEST_OPERATION_ID),
    );
    dependencies.nativeStorageEntries.set(
      DELETION_NATIVE_REAUTH_HANDOFF_STORAGE_KEY,
      validCapability,
    );
    dependencies.nativeStorage.get.mockImplementation(async (key: string) => {
      if (key === DELETION_NATIVE_REAUTH_HANDOFF_STORAGE_KEY) {
        capabilityReads += 1;
        return capabilityReads === 1 ? validCapability : expiredCapability;
      }
      return dependencies.nativeStorageEntries.get(key) ?? null;
    });

    await renderAccountDeletionPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('삭제 예약 재인증 권한이 만료되었거나 범위가 일치하지 않습니다.');
    expect(dependencies.authApiPost).not.toHaveBeenCalled();
    expect(JSON.parse(
      dependencies.nativeStorageEntries.get(DELETION_OPERATION_STORAGE_KEY) ?? '{}',
    )).toMatchObject({ phase: 'sending', idempotencyKey: REQUEST_OPERATION_ID });
    expect(dependencies.nativeStorageEntries.get(DELETION_NATIVE_REAUTH_HANDOFF_STORAGE_KEY))
      .toBeUndefined();
    expect(dependencies.finalizeNativeAccountDeletionBarrier).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Google로 재인증' })).toBeEnabled());
  });
  it('revalidates a cancellation capability at dispatch and falls back to authoritative status', async () => {
    dependencies.nativePlatform = true;
    const validCapability = nativeCapabilityRecord('cancel', REQUEST_ID);
    const expiredCapability = nativeCapabilityRecord(
      'cancel',
      REQUEST_ID,
      new Date(Date.now() - 1_000).toISOString(),
    );
    let capabilityReads = 0;
    dependencies.nativeStorageEntries.set(DELETION_STATUS_STORAGE_KEY, JSON.stringify({
      requestId: REQUEST_ID,
      statusHandle: STATUS_HANDLE,
    }));
    dependencies.nativeStorageEntries.set(
      DELETION_OPERATION_STORAGE_KEY,
      operationRecord('request', 'local_complete', REQUEST_OPERATION_ID, REQUEST_ID),
    );
    dependencies.nativeStorageEntries.set(
      DELETION_NATIVE_REAUTH_HANDOFF_STORAGE_KEY,
      validCapability,
    );
    dependencies.nativeStorage.get.mockImplementation(async (key: string) => {
      if (key === DELETION_NATIVE_REAUTH_HANDOFF_STORAGE_KEY) {
        capabilityReads += 1;
        return capabilityReads === 1 ? validCapability : expiredCapability;
      }
      return dependencies.nativeStorageEntries.get(key) ?? null;
    });
    dependencies.authApiGet.mockResolvedValue({
      data: {
        request_id: REQUEST_ID,
        state: 'deletion_pending',
        deadline_at_utc: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        cancelable: true,
        retry_guidance: 'none',
      },
    });

    await renderAccountDeletionPage();

    expect(await screen.findByText('현재 상태: 삭제 예약 접수됨')).toBeVisible();
    expect(dependencies.authApiPost).not.toHaveBeenCalled();
    expect(JSON.parse(
      dependencies.nativeStorageEntries.get(DELETION_OPERATION_STORAGE_KEY) ?? '{}',
    )).toMatchObject({
      kind: 'request',
      phase: 'local_complete',
      requestId: REQUEST_ID,
    });
    expect(dependencies.nativeStorageEntries.get(DELETION_NATIVE_REAUTH_HANDOFF_STORAGE_KEY))
      .toBeUndefined();
    expect(dependencies.finalizeNativeAccountDeletionBarrier).not.toHaveBeenCalled();
  });
});
