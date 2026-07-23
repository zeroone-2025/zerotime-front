import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authApiPost: vi.fn(),
  clearAccessToken: vi.fn(),
  getAccessToken: vi.fn(),
  getOrCreateInstallationId: vi.fn(),
  hasAccessToken: vi.fn(),
  markLogoutPending: vi.fn(),
  setAccessToken: vi.fn(),
  appAddListener: vi.fn().mockResolvedValue({ remove: vi.fn().mockResolvedValue(undefined) }),
  appGetLaunchUrl: vi.fn().mockResolvedValue(null),
  browserClose: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: mocks.appAddListener,
    getLaunchUrl: mocks.appGetLaunchUrl,
  },
}));
vi.mock('@capacitor/browser', () => ({ Browser: { close: mocks.browserClose } }));
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: vi.fn(() => 'ios'),
    isNativePlatform: vi.fn(() => true),
  },
}));
vi.mock('@/_lib/api/client', () => ({
  authApi: { post: mocks.authApiPost },
}));
vi.mock('@/_lib/auth/tokenStore', () => ({
  clearAccessToken: mocks.clearAccessToken,
  getAccessToken: mocks.getAccessToken,
  hasAccessToken: mocks.hasAccessToken,
  markLogoutPending: mocks.markLogoutPending,
  setAccessToken: mocks.setAccessToken,
}));
vi.mock('./mobileRelease', () => ({
  capacitorPreferencesStorage: {},
  createIdempotencyKey: vi.fn(() => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  getOrCreateInstallationId: mocks.getOrCreateInstallationId,
  MOBILE_RELEASE_CONTRACT: 'test-contract',
  isValidatedNativeReleaseRuntime: vi.fn(() => true),
  readValidatedNativeReleaseManifest: vi.fn(() => ({ platform: 'ios' })),
}));
vi.mock('./notificationCoordinator', () => ({
  nativeNotificationCoordinatorPlugin: {},
}));

import {
  DELETION_NATIVE_REAUTH_HANDOFF_STORAGE_KEY,
  DELETION_OPERATION_STORAGE_KEY,
  DELETION_STATUS_STORAGE_KEY,
} from '@/_lib/accountDeletion';
import {
  applyNativeAuthSessionGenerations,
  clearNativeAuthSessionAfterAccountDeletionAcknowledgement,
  createNativeAuthSecureStorageAdapter,
  getNativeAuthSessionTransitionGeneration,
  invalidateNativeAuthSessionForMutation,
  logoutNativeAuthSession,
  refreshNativeAuthSession,
  releaseNativeAuthSessionAfterDeletionCancellation,
  recoverNativeAuthCorruptSession,
  resumeNativeDeletionAuthCallback,
  routeNativeAuthCallback,
  setNativeAuthNotificationBarrier,
  setNativeAuthSecureStorageAdapter,
  setNativeAuthSessionBinder,
  subscribeToNativeAuthCallbacks,
  startNativeOAuthLogin,
  type NativeAuthNotificationBarrier,
  type NativeAuthSecureStorageAdapter,
} from './nativeAuth';

class FakeSecureStorage implements NativeAuthSecureStorageAdapter {
  readonly removed: string[] = [];
  readonly operations: string[] = [];
  readonly values = new Map<string, string>();
  failMarkerPersistence = false;
  readonly failRemoveKeys = new Set<string>();
  beforeSet: ((key: string, value: string) => Promise<void>) | null = null;

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async get(key: string): Promise<string | null> {
    this.operations.push(`get:${key}`);
    return this.values.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.operations.push(`set:${key}`);
    if (
      key === 'zerotime.native-auth.privacy-barrier-failed.v1'
      && this.failMarkerPersistence
    ) {
      throw new Error('marker persistence failed');
    }
    await this.beforeSet?.(key, value);
    this.values.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.operations.push(`remove:${key}`);
    if (this.failRemoveKeys.has(key)) {
      throw new Error(`remove failed for ${key}`);
    }
    this.removed.push(key);
    this.values.delete(key);
  }
}

const ZERO_MUTATION_RECEIPT = {
  success: true,
  display_epoch: '18446744073709551615',
  zero_counts: {
    pending_count: 0,
    delivered_count: 0,
    foreground_banner_count: 0,
    registry_count: 0,
    inflight_count: 0,
  },
} as never;
const ZERO_MUTATION_LINEAGE = {
  phase: 'awaiting_finalize',
  reason: 'logout',
  display_epoch: ZERO_MUTATION_RECEIPT.display_epoch,
  zero_counts: ZERO_MUTATION_RECEIPT.zero_counts,
} as never;
const INSTALLATION_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';

function createNotificationBarrier(
  overrides: Partial<NativeAuthNotificationBarrier> = {},
): NativeAuthNotificationBarrier {
  return {
    beginAccountMutation: vi.fn().mockResolvedValue(ZERO_MUTATION_RECEIPT),
    finalizeAccountMutation: vi.fn().mockResolvedValue(ZERO_MUTATION_RECEIPT),
    getAccountMutationLineage: vi.fn().mockResolvedValue(ZERO_MUTATION_LINEAGE),
    ...overrides,
  };
}

describe('createNativeAuthSecureStorageAdapter', () => {
  it('requires exact native booleans and an allowlisted credential key', async () => {
    const pluginCalls = {
      isSecureCredentialStorageAvailable: vi.fn(),
      getSecureCredential: vi.fn().mockResolvedValue({ value: null }),
      setSecureCredential: vi.fn(),
      deleteSecureCredential: vi.fn(),
    };
    const adapter = createNativeAuthSecureStorageAdapter(pluginCalls as never);

    pluginCalls.isSecureCredentialStorageAvailable.mockResolvedValueOnce({ available: 'true' });
    await expect(adapter.isAvailable()).resolves.toBe(false);
    pluginCalls.isSecureCredentialStorageAvailable.mockResolvedValueOnce({ available: 1 });
    await expect(adapter.isAvailable()).resolves.toBe(false);

    pluginCalls.setSecureCredential.mockResolvedValueOnce({ success: 'true' });
    await expect(adapter.set('zerotime.native-auth.refresh.v1', 'refresh-token')).rejects.toMatchObject({
      code: 'SECURE_STORAGE_WRITE_FAILED',
    });

    pluginCalls.deleteSecureCredential.mockResolvedValueOnce({ success: 1 });
    await expect(adapter.remove('zerotime.native-auth.session.v1')).rejects.toMatchObject({
      code: 'SECURE_STORAGE_DELETE_FAILED',
    });

    await expect(adapter.get('zerotime.native-auth.untrusted.v1')).rejects.toMatchObject({
      code: 'SECURE_STORAGE_KEY_INVALID',
    });
    expect(pluginCalls.getSecureCredential).not.toHaveBeenCalled();
  });
  it('permits only native auth and native deletion journal keys', async () => {
    const pluginCalls = {
      isSecureCredentialStorageAvailable: vi.fn(),
      getSecureCredential: vi.fn().mockResolvedValue({ value: null }),
      setSecureCredential: vi.fn().mockResolvedValue({ success: true }),
      deleteSecureCredential: vi.fn().mockResolvedValue({ success: true }),
    };
    const adapter = createNativeAuthSecureStorageAdapter(pluginCalls as never);
    const approvedKeys = [
      'zerotime.native-auth.transient.v1',
      'zerotime.native-auth.refresh.v1',
      'zerotime.native-auth.session.v1',
      'zerotime.native-auth.privacy-barrier-failed.v1',
      'zerotime.native-auth.corrupt-session-audit.v1',
      DELETION_STATUS_STORAGE_KEY,
      DELETION_OPERATION_STORAGE_KEY,
      DELETION_NATIVE_REAUTH_HANDOFF_STORAGE_KEY,
    ];

    for (const key of approvedKeys) {
      await expect(adapter.get(key)).resolves.toBeNull();
      await expect(adapter.set(key, 'secure-journal')).resolves.toBeUndefined();
      await expect(adapter.remove(key)).resolves.toBeUndefined();
    }

    expect(pluginCalls.getSecureCredential.mock.calls.map(([request]) => request)).toEqual(
      approvedKeys.map((key) => ({ key })),
    );
    expect(pluginCalls.setSecureCredential.mock.calls.map(([request]) => request.key)).toEqual(approvedKeys);
    expect(pluginCalls.deleteSecureCredential.mock.calls.map(([request]) => request.key)).toEqual(approvedKeys);

    for (const key of [
      'zerotime.native-auth.access-token.v1',
      'zerotime.account-deletion.reauth.transient.v1',
      'zerotime.account-deletion.capability.v1',
      'zerotime.native-auth.untrusted.v1',
    ]) {
      await expect(adapter.get(key)).rejects.toMatchObject({ code: 'SECURE_STORAGE_KEY_INVALID' });
      await expect(adapter.set(key, 'bearer-secret')).rejects.toMatchObject({
        code: 'SECURE_STORAGE_KEY_INVALID',
      });
      await expect(adapter.remove(key)).rejects.toMatchObject({ code: 'SECURE_STORAGE_KEY_INVALID' });
    }
    expect(pluginCalls.getSecureCredential).toHaveBeenCalledTimes(approvedKeys.length);
    expect(pluginCalls.setSecureCredential).toHaveBeenCalledTimes(approvedKeys.length);
    expect(pluginCalls.deleteSecureCredential).toHaveBeenCalledTimes(approvedKeys.length);
  });
});
describe('native callback routing', () => {
  const CALLBACK_STATE = 's'.repeat(43);
  const EXCHANGE_CODE = 'c'.repeat(43);
  const REQUEST_ID = '33333333-3333-4333-8333-333333333333';

  let storage: FakeSecureStorage;

  function deletionTransient() {
    return {
      version: 1,
      transactionId: '44444444-4444-4444-8444-444444444444',
      provider: 'google' as const,
      purpose: 'request' as const,
      requestId: REQUEST_ID,
      platform: 'ios' as const,
      state: CALLBACK_STATE,
      nonce: 'n'.repeat(43),
      codeVerifier: 'v'.repeat(43),
      exchangeIdempotencyKey: '55555555-5555-4555-8555-555555555555',
      expiresAtUtc: new Date(Date.now() + 60_000).toISOString(),
      authorizationUrl: 'https://accounts.example.com/authorize',
    };
  }

  function callbackUrl(state = CALLBACK_STATE): string {
    return `https://zerotime.kr/auth/native/callback/?code=${EXCHANGE_CODE}&state=${state}`;
  }

  function storeDeletionOwner(): void {
    storage.values.set(
      DELETION_NATIVE_REAUTH_HANDOFF_STORAGE_KEY,
      JSON.stringify({ version: 1, kind: 'transient', transient: deletionTransient() }),
    );
    storage.values.set(
      DELETION_OPERATION_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        kind: 'request',
        phase: 'sending',
        idempotencyKey: REQUEST_ID,
        updatedAtUtc: new Date().toISOString(),
      }),
    );
  }

  function deletionCapabilityResponse() {
    return {
      data: {
        result_type: 'deletion_capability',
        deletion_capability: `${'a'.repeat(16)}.${'b'.repeat(16)}.${'c'.repeat(16)}`,
        purpose: 'request',
        expires_at_utc: new Date(Date.now() + 60_000).toISOString(),
        request_id: REQUEST_ID,
      },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    storage = new FakeSecureStorage();
    setNativeAuthSecureStorageAdapter(storage);
    setNativeAuthNotificationBarrier(null);
    setNativeAuthSessionBinder(null);
    mocks.getOrCreateInstallationId.mockResolvedValue(INSTALLATION_ID);
    mocks.appGetLaunchUrl.mockResolvedValue(null);
  });

  afterEach(() => {
    setNativeAuthSecureStorageAdapter(null);
    setNativeAuthNotificationBarrier(null);
    setNativeAuthSessionBinder(null);
  });

  it('persists a scoped deletion capability once, resumes it, and rejects raw callback replay', async () => {
    storeDeletionOwner();
    mocks.authApiPost.mockResolvedValueOnce(deletionCapabilityResponse());

    await expect(routeNativeAuthCallback(callbackUrl())).resolves.toEqual({
      kind: 'deletion_capability',
      purpose: 'request',
      requestId: REQUEST_ID,
    });
    await expect(resumeNativeDeletionAuthCallback(callbackUrl())).resolves.toEqual({
      kind: 'deletion_capability',
      purpose: 'request',
      requestId: REQUEST_ID,
    });
    await expect(routeNativeAuthCallback(callbackUrl())).rejects.toMatchObject({
      code: 'NATIVE_CALLBACK_OWNER_INVALID',
    });

    expect(mocks.authApiPost).toHaveBeenCalledTimes(1);
    expect(JSON.parse(
      storage.values.get(DELETION_NATIVE_REAUTH_HANDOFF_STORAGE_KEY) ?? '{}',
    )).toMatchObject({
      kind: 'capability',
      capability: { purpose: 'request', requestId: REQUEST_ID },
    });
  });

  it('rejects an ambiguous callback state without dispatching either owner', async () => {
    storeDeletionOwner();
    storage.values.set('zerotime.native-auth.transient.v1', JSON.stringify({
      version: 1,
      transactionId: '66666666-6666-4666-8666-666666666666',
      provider: 'google',
      state: CALLBACK_STATE,
      nonce: 'n'.repeat(43),
      codeVerifier: 'v'.repeat(43),
      exchangeIdempotencyKey: '77777777-7777-4777-8777-777777777777',
      redirectTo: '/',
    }));

    await expect(routeNativeAuthCallback(callbackUrl())).rejects.toMatchObject({
      code: 'NATIVE_CALLBACK_OWNER_INVALID',
    });
    expect(mocks.authApiPost).not.toHaveBeenCalled();
    expect(JSON.parse(
      storage.values.get(DELETION_NATIVE_REAUTH_HANDOFF_STORAGE_KEY) ?? '{}',
    )).toMatchObject({ kind: 'transient' });
    expect(storage.values.get('zerotime.native-auth.transient.v1')).toContain(CALLBACK_STATE);
  });

  it('never sends deletion callback results to login-error subscribers', async () => {
    storeDeletionOwner();
    mocks.authApiPost.mockResolvedValueOnce(deletionCapabilityResponse());
    const onError = vi.fn();
    const unsubscribe = subscribeToNativeAuthCallbacks(vi.fn(), onError);

    await vi.waitFor(() => expect(mocks.appAddListener).toHaveBeenCalledTimes(1));
    const listener = mocks.appAddListener.mock.calls[0]?.[1] as (event: { url: string }) => void;
    listener({ url: callbackUrl() });

    await vi.waitFor(() => expect(mocks.authApiPost).toHaveBeenCalledTimes(1));
    expect(onError).not.toHaveBeenCalled();
    unsubscribe();
  });
});

describe('clearNativeAuthSessionAfterAccountDeletionAcknowledgement', () => {
  let storage: FakeSecureStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = new FakeSecureStorage();
    setNativeAuthSessionBinder(null);
    setNativeAuthSecureStorageAdapter(storage);
    setNativeAuthNotificationBarrier(createNotificationBarrier());
  });

  afterEach(() => {
    setNativeAuthSecureStorageAdapter(null);
    setNativeAuthNotificationBarrier(null);
    setNativeAuthSessionBinder(null);
  });

  it('finalizes the caller-held deletion epoch before purging local credentials', async () => {
    const beginAccountMutation = vi.fn().mockResolvedValue(ZERO_MUTATION_RECEIPT);
    const finalizeAccountMutation = vi.fn().mockResolvedValue(ZERO_MUTATION_RECEIPT);
    setNativeAuthNotificationBarrier(createNotificationBarrier({
      beginAccountMutation,
      finalizeAccountMutation,
    }));
    await clearNativeAuthSessionAfterAccountDeletionAcknowledgement(
      ZERO_MUTATION_RECEIPT.display_epoch,
    );
    expect(beginAccountMutation).not.toHaveBeenCalled();

    expect(finalizeAccountMutation).toHaveBeenCalledWith(
      'deletion',
      ZERO_MUTATION_RECEIPT.display_epoch,
    );

    expect(storage.removed).toEqual([
      'zerotime.native-auth.refresh.v1',
      'zerotime.native-auth.session.v1',
      'zerotime.native-auth.transient.v1',
      'zerotime.native-auth.corrupt-session-audit.v1',
      'zerotime.native-auth.privacy-barrier-failed.v1',
    ]);
    expect(mocks.clearAccessToken).toHaveBeenCalledTimes(1);
    expect(mocks.authApiPost).not.toHaveBeenCalled();
  });
  it('clears volatile publication before a fallible post-ack deletion cleanup step', async () => {
    setNativeAuthNotificationBarrier(createNotificationBarrier({
      finalizeAccountMutation: vi.fn().mockRejectedValue(new Error('native cleanup failed')),
    }));

    await expect(clearNativeAuthSessionAfterAccountDeletionAcknowledgement(
      ZERO_MUTATION_RECEIPT.display_epoch,
    )).rejects.toThrow(
      'native cleanup failed',
    );

    expect(mocks.clearAccessToken).toHaveBeenCalledTimes(1);
    expect(mocks.markLogoutPending).toHaveBeenCalledTimes(1);
    expect(storage.removed).toEqual([]);
  });
  it('fails explicitly without clearing credentials when its privacy marker cannot persist', async () => {
    storage.failMarkerPersistence = true;

    await expect(clearNativeAuthSessionAfterAccountDeletionAcknowledgement(
      ZERO_MUTATION_RECEIPT.display_epoch,
    )).rejects.toMatchObject({
      code: 'LOCAL_PRIVACY_BARRIER_MARKER_PERSIST_FAILED',
    });
    expect(storage.removed).toEqual([]);

    storage.failMarkerPersistence = false;
    await clearNativeAuthSessionAfterAccountDeletionAcknowledgement(
      ZERO_MUTATION_RECEIPT.display_epoch,
    );
    expect(storage.removed).toEqual([
      'zerotime.native-auth.refresh.v1',
      'zerotime.native-auth.session.v1',
      'zerotime.native-auth.transient.v1',
      'zerotime.native-auth.corrupt-session-audit.v1',
      'zerotime.native-auth.privacy-barrier-failed.v1',
    ]);
  });
  it('aggregates credential cleanup failures behind a durable privacy marker', async () => {
    storage.failRemoveKeys.add('zerotime.native-auth.refresh.v1');
    storage.failRemoveKeys.add('zerotime.native-auth.session.v1');

    await expect(clearNativeAuthSessionAfterAccountDeletionAcknowledgement(
      ZERO_MUTATION_RECEIPT.display_epoch,
    )).rejects.toMatchObject({
      code: 'NATIVE_CREDENTIAL_CLEANUP_FAILED',
    });
    expect(storage.operations).toContain('remove:zerotime.native-auth.refresh.v1');
    expect(storage.operations).toContain('remove:zerotime.native-auth.session.v1');
    expect(storage.operations).toContain('remove:zerotime.native-auth.transient.v1');
    expect(storage.values.size).toBe(1);
    expect(mocks.clearAccessToken).toHaveBeenCalledTimes(1);
    expect(mocks.markLogoutPending).toHaveBeenCalledTimes(1);

    storage.failRemoveKeys.clear();
    await clearNativeAuthSessionAfterAccountDeletionAcknowledgement(
      ZERO_MUTATION_RECEIPT.display_epoch,
    );
  });

  it('closes admission without clearing possibly bound credentials before server acknowledgement', async () => {
    const order: string[] = [];
    const beginAccountMutation = vi.fn().mockImplementation(async () => {
      order.push('begin');
      return ZERO_MUTATION_RECEIPT;
    });
    const finalizeAccountMutation = vi.fn().mockImplementation(async () => {
      order.push('finalize');
      return ZERO_MUTATION_RECEIPT;
    });
    setNativeAuthNotificationBarrier(createNotificationBarrier({
      beginAccountMutation,
      finalizeAccountMutation,
    }));
    setNativeAuthSessionBinder({
      bindSession: vi.fn().mockImplementation(async () => {
        order.push('bind');
        return 'failed';
      }),
    });
    mocks.getOrCreateInstallationId.mockResolvedValue(INSTALLATION_ID);
    storage.values.set('zerotime.native-auth.refresh.v1', 'refresh-token');
    storage.values.set('zerotime.native-auth.session.v1', JSON.stringify({
      version: 1,
      sessionId: SESSION_ID,
      authVersion: 1,
      installationId: INSTALLATION_ID,
      bindingGeneration: 7,
      tokenGeneration: 9,
    }));
    mocks.authApiPost.mockResolvedValue({
      data: {
        access_token: 'access-token',
        token_type: 'Bearer',
        expires_at_utc: new Date(Date.now() + 60_000).toISOString(),
        refresh_token: 'rotated-refresh-token',
        session_id: SESSION_ID,
        auth_version: 1,
        installation: {
          installation_id: INSTALLATION_ID,
          binding_generation: 7,
          token_generation: 9,
          binding_state: 'bound',
        },
      },
    });

    await expect(refreshNativeAuthSession()).rejects.toMatchObject({
      code: 'NATIVE_POST_BIND_PURGE_FAILED',
    });

    expect(order).toEqual(['bind', 'begin']);
    expect(storage.operations).toContain(
      'set:zerotime.native-auth.privacy-barrier-failed.v1',
    );
    expect(storage.values.has('zerotime.native-auth.refresh.v1')).toBe(true);
    expect(storage.values.has('zerotime.native-auth.session.v1')).toBe(true);
  });
  it('does not synthesize a mutation owner when binding is blocked before a native attempt', async () => {
    await clearNativeAuthSessionAfterAccountDeletionAcknowledgement(
      ZERO_MUTATION_RECEIPT.display_epoch,
    );
    const beginAccountMutation = vi.fn().mockResolvedValue(ZERO_MUTATION_RECEIPT);
    setNativeAuthNotificationBarrier(createNotificationBarrier({ beginAccountMutation }));
    setNativeAuthSessionBinder({
      bindSession: vi.fn().mockResolvedValue('blocked'),
    });
    mocks.getOrCreateInstallationId.mockResolvedValue(INSTALLATION_ID);
    storage.values.set('zerotime.native-auth.refresh.v1', 'refresh-token');
    storage.values.set('zerotime.native-auth.session.v1', JSON.stringify({
      version: 1,
      sessionId: SESSION_ID,
      authVersion: 1,
      installationId: INSTALLATION_ID,
      bindingGeneration: 7,
      tokenGeneration: 9,
    }));
    mocks.authApiPost.mockResolvedValue({
      data: {
        access_token: 'access-token',
        token_type: 'Bearer',
        expires_at_utc: new Date(Date.now() + 60_000).toISOString(),
        refresh_token: 'rotated-refresh-token',
        session_id: SESSION_ID,
        auth_version: 1,
        installation: {
          installation_id: INSTALLATION_ID,
          binding_generation: 7,
          token_generation: 9,
          binding_state: 'bound',
        },
      },
    });

    await expect(refreshNativeAuthSession()).rejects.toMatchObject({
      code: 'NATIVE_BIND_FAILED',
    });

    expect(beginAccountMutation).not.toHaveBeenCalled();
    expect(storage.values.has('zerotime.native-auth.privacy-barrier-failed.v1')).toBe(false);
    expect(storage.values.get('zerotime.native-auth.refresh.v1')).toBe('refresh-token');
  });
  it('reopens native session publication only after deletion cancellation completes', async () => {
    await clearNativeAuthSessionAfterAccountDeletionAcknowledgement(
      ZERO_MUTATION_RECEIPT.display_epoch,
    );
    setNativeAuthSessionBinder({
      bindSession: vi.fn().mockResolvedValue('bound'),
    });
    mocks.getOrCreateInstallationId.mockResolvedValue(INSTALLATION_ID);
    storage.values.set('zerotime.native-auth.refresh.v1', 'refresh-token');
    storage.values.set('zerotime.native-auth.session.v1', JSON.stringify({
      version: 1,
      sessionId: SESSION_ID,
      authVersion: 1,
      installationId: INSTALLATION_ID,
      bindingGeneration: 7,
      tokenGeneration: 9,
    }));
    mocks.authApiPost.mockResolvedValue({
      data: {
        access_token: 'access-token',
        token_type: 'Bearer',
        expires_at_utc: new Date(Date.now() + 60_000).toISOString(),
        refresh_token: 'rotated-refresh-token',
        session_id: SESSION_ID,
        auth_version: 1,
        installation: {
          installation_id: INSTALLATION_ID,
          binding_generation: 7,
          token_generation: 9,
          binding_state: 'bound',
        },
      },
    });

    invalidateNativeAuthSessionForMutation();
    await expect(refreshNativeAuthSession()).resolves.toBeNull();
    expect(mocks.authApiPost).not.toHaveBeenCalled();

    releaseNativeAuthSessionAfterDeletionCancellation();
    await expect(refreshNativeAuthSession()).resolves.toBe('access-token');
    expect(mocks.authApiPost).toHaveBeenCalledOnce();
  });
});
describe('native logout recovery', () => {
  let storage: FakeSecureStorage;

  beforeEach(async () => {
    vi.clearAllMocks();
    storage = new FakeSecureStorage();
    setNativeAuthSessionBinder(null);
    setNativeAuthSecureStorageAdapter(storage);
    setNativeAuthNotificationBarrier(createNotificationBarrier());
    await clearNativeAuthSessionAfterAccountDeletionAcknowledgement(
      ZERO_MUTATION_RECEIPT.display_epoch,
    );
    vi.clearAllMocks();
    storage.operations.length = 0;
    mocks.authApiPost.mockReset();
    mocks.getAccessToken.mockReset();
    mocks.getOrCreateInstallationId.mockReset();
    mocks.getOrCreateInstallationId.mockResolvedValue(INSTALLATION_ID);
    mocks.getAccessToken.mockReturnValue(null);
  });

  afterEach(() => {
    setNativeAuthSecureStorageAdapter(null);
    setNativeAuthNotificationBarrier(null);
    setNativeAuthSessionBinder(null);
  });

  function storeRecoverableNativeSession(
    phase?: 'server_acknowledgement_pending' | 'reconciliation_required',
  ): void {
    storage.values.set('zerotime.native-auth.refresh.v1', 'refresh-token');
    storage.values.set('zerotime.native-auth.session.v1', JSON.stringify({
      version: 1,
      sessionId: SESSION_ID,
      authVersion: 1,
      installationId: INSTALLATION_ID,
      bindingGeneration: 7,
      tokenGeneration: 9,
      ...(phase
        ? {
            pendingMutation: {
              version: 4,
              reason: 'logout',
              sessionId: SESSION_ID,
              installationId: INSTALLATION_ID,
              bindingGeneration: 7,
              idempotencyKey: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              displayEpoch: ZERO_MUTATION_RECEIPT.display_epoch,
              phase,
            },
          }
        : {}),
    }));
  }

  function nativeSessionResponse() {
    return {
      data: {
        access_token: 'access-token',
        token_type: 'Bearer' as const,
        expires_at_utc: new Date(Date.now() + 60_000).toISOString(),
        refresh_token: 'rotated-refresh-token',
        session_id: SESSION_ID,
        auth_version: 1,
        installation: {
          installation_id: INSTALLATION_ID,
          binding_generation: 7,
          token_generation: 9,
          binding_state: 'bound' as const,
        },
      },
    };
  }
  function nativeLogoutAcknowledgement() {
    return {
      status: 200,
      data: {
        installation_id: INSTALLATION_ID,
        binding_generation: 8,
        token_generation: 9,
        binding_state: 'unlinked' as const,
        acknowledged_at_utc: '2026-07-14T00:00:00.000Z',
      },
    };
  }

  async function restoreNativeSession(): Promise<void> {
    storeRecoverableNativeSession();
    setNativeAuthSessionBinder({
      bindSession: vi.fn().mockResolvedValue('bound'),
    });
    mocks.authApiPost.mockResolvedValueOnce(nativeSessionResponse());
    await expect(refreshNativeAuthSession()).resolves.toBe('access-token');
    mocks.getAccessToken.mockReturnValue('access-token');
  }

  it('finishes a server-acknowledged logout after restart without refreshing or persisting a bearer', async () => {
    const initialFinalize = vi.fn().mockRejectedValueOnce(new Error('crash after server commit'));
    setNativeAuthNotificationBarrier(createNotificationBarrier({
      finalizeAccountMutation: initialFinalize,
    }));
    await restoreNativeSession();
    mocks.authApiPost.mockResolvedValueOnce(nativeLogoutAcknowledgement());

    await expect(logoutNativeAuthSession()).rejects.toThrow('crash after server commit');

    const pendingSession = storage.values.get('zerotime.native-auth.session.v1');
    expect(pendingSession).toContain('"phase":"server_acknowledged"');
    expect(pendingSession).toContain('"idempotencyKey":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"');
    expect(pendingSession).toContain(`"displayEpoch":"${ZERO_MUTATION_RECEIPT.display_epoch}"`);
    expect(pendingSession).not.toContain('access-token');

    const recoveryBegin = vi.fn().mockResolvedValue(ZERO_MUTATION_RECEIPT);
    const recoveryFinalize = vi.fn().mockResolvedValue(ZERO_MUTATION_RECEIPT);
    setNativeAuthNotificationBarrier(createNotificationBarrier({
      beginAccountMutation: recoveryBegin,
      finalizeAccountMutation: recoveryFinalize,
    }));

    await expect(refreshNativeAuthSession()).resolves.toBeNull();

    expect(mocks.authApiPost.mock.calls.map(([path]) => path)).toEqual([
      '/v1/native-auth/refresh',
      '/v1/native-auth/logout',
    ]);
    expect(recoveryBegin).not.toHaveBeenCalled();
    expect(recoveryFinalize).toHaveBeenCalledWith(
      'logout',
      ZERO_MUTATION_RECEIPT.display_epoch,
    );
    expect(storage.values.has('zerotime.native-auth.refresh.v1')).toBe(false);
    expect(storage.values.has('zerotime.native-auth.session.v1')).toBe(false);
  });
  it('replays a durable pre-begin intent only after proving native lineage is inactive', async () => {
    const beginReceipt = {
      ...ZERO_MUTATION_RECEIPT,
      display_epoch: '77',
    };
    const beginAccountMutation = vi.fn().mockResolvedValue(beginReceipt);
    const finalizeAccountMutation = vi.fn().mockResolvedValue(beginReceipt);
    setNativeAuthNotificationBarrier(createNotificationBarrier({
      beginAccountMutation,
      finalizeAccountMutation,
      getAccountMutationLineage: vi.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValue({
          ...ZERO_MUTATION_LINEAGE,
          display_epoch: beginReceipt.display_epoch,
        }),
    }));
    storage.values.set('zerotime.native-auth.refresh.v1', 'refresh-token');
    storage.values.set('zerotime.native-auth.session.v1', JSON.stringify({
      version: 1,
      sessionId: SESSION_ID,
      authVersion: 1,
      installationId: INSTALLATION_ID,
      bindingGeneration: 7,
      tokenGeneration: 9,
      pendingMutation: {
        version: 4,
        reason: 'logout',
        sessionId: SESSION_ID,
        installationId: INSTALLATION_ID,
        bindingGeneration: 7,
        idempotencyKey: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        phase: 'pre_begin',
      },
    }));
    mocks.authApiPost.mockResolvedValueOnce(nativeLogoutAcknowledgement());

    await expect(refreshNativeAuthSession()).resolves.toBeNull();

    expect(beginAccountMutation).toHaveBeenCalledOnce();
    expect(finalizeAccountMutation).toHaveBeenCalledWith('logout', '77');
    expect(storage.values.has('zerotime.native-auth.refresh.v1')).toBe(false);
    expect(storage.values.has('zerotime.native-auth.session.v1')).toBe(false);
  });
  it('binds only a matching awaiting lineage in the crash window before pending epoch persistence', async () => {
    const owner = { reason: 'logout' as const, display_epoch: '77' };
    const beginAccountMutation = vi.fn().mockResolvedValue(ZERO_MUTATION_RECEIPT);
    const finalizeAccountMutation = vi.fn().mockResolvedValue({
      ...ZERO_MUTATION_RECEIPT,
      display_epoch: owner.display_epoch,
    });
    setNativeAuthNotificationBarrier(createNotificationBarrier({
      beginAccountMutation,
      finalizeAccountMutation,
      getAccountMutationLineage: vi.fn().mockResolvedValue({
        ...ZERO_MUTATION_LINEAGE,
        ...owner,
      }),
    }));
    storage.values.set('zerotime.native-auth.refresh.v1', 'refresh-token');
    storage.values.set('zerotime.native-auth.session.v1', JSON.stringify({
      version: 1,
      sessionId: SESSION_ID,
      authVersion: 1,
      installationId: INSTALLATION_ID,
      bindingGeneration: 7,
      tokenGeneration: 9,
      pendingMutation: {
        version: 4,
        reason: owner.reason,
        sessionId: SESSION_ID,
        installationId: INSTALLATION_ID,
        bindingGeneration: 7,
        idempotencyKey: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        phase: 'server_acknowledgement_pending',
      },
    }));
    storage.beforeSet = async (key, value) => {
      if (
        key === 'zerotime.native-auth.session.v1'
        && value.includes(`"displayEpoch":"${owner.display_epoch}"`)
      ) {
        storage.operations.push('persist-epoch');
      }
    };
    mocks.authApiPost.mockImplementationOnce(async () => {
      storage.operations.push('reconcile');
      return nativeLogoutAcknowledgement();
    });

    await expect(refreshNativeAuthSession()).resolves.toBeNull();

    expect(beginAccountMutation).not.toHaveBeenCalled();
    expect(finalizeAccountMutation).toHaveBeenCalledWith(owner.reason, owner.display_epoch);
    expect(storage.operations.indexOf('persist-epoch')).toBeLessThan(
      storage.operations.indexOf('reconcile'),
    );
  });

  it('keeps legacy pending journals closed without beginning a replacement mutation', async () => {
    storeRecoverableNativeSession('server_acknowledgement_pending');
    const legacySession = storage.values.get('zerotime.native-auth.session.v1') ?? '';
    storage.values.set(
      'zerotime.native-auth.session.v1',
      legacySession.replace('"version":4', '"version":2').replace(
        `,"displayEpoch":"${ZERO_MUTATION_RECEIPT.display_epoch}"`,
        '',
      ),
    );
    const beginAccountMutation = vi.fn().mockResolvedValue(ZERO_MUTATION_RECEIPT);
    const finalizeAccountMutation = vi.fn().mockResolvedValue(ZERO_MUTATION_RECEIPT);
    setNativeAuthNotificationBarrier(createNotificationBarrier({
      beginAccountMutation,
      finalizeAccountMutation,
    }));

    await expect(refreshNativeAuthSession()).rejects.toMatchObject({
      code: 'NATIVE_PENDING_MUTATION_EPOCH_UNAVAILABLE',
    });

    expect(beginAccountMutation).not.toHaveBeenCalled();
    expect(finalizeAccountMutation).not.toHaveBeenCalled();
    expect(mocks.authApiPost).not.toHaveBeenCalled();
  });
  it('reconciles a crash after server acknowledgement before phase persistence without a bearer or token publication', async () => {
    storeRecoverableNativeSession('server_acknowledgement_pending');
    storage.values.set(
      'zerotime.native-auth.privacy-barrier-failed.v1',
      JSON.stringify({
        version: 2,
        reason: 'logout',
        display_epoch: ZERO_MUTATION_RECEIPT.display_epoch,
      }),
    );
    mocks.authApiPost.mockResolvedValueOnce(nativeLogoutAcknowledgement());

    await expect(refreshNativeAuthSession()).resolves.toBeNull();

    expect(mocks.authApiPost.mock.calls.map(([path]) => path)).toEqual([
      '/v1/native-auth/logout/reconcile',
    ]);
    const [, body, config] = mocks.authApiPost.mock.calls[0];
    expect(body).toEqual({
      refresh_token: 'refresh-token',
      installation_id: INSTALLATION_ID,
      expected_binding_generation: 7,
    });
    expect(config.headers).toEqual({
      'X-ZeroTime-Contract': 'test-contract',
      'Idempotency-Key': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });
    expect(mocks.setAccessToken).not.toHaveBeenCalled();
    expect(storage.values.has('zerotime.native-auth.refresh.v1')).toBe(false);
    expect(storage.values.has('zerotime.native-auth.session.v1')).toBe(false);
  });
  it('uses refresh-and-replay only for the typed definitive not-acknowledged receipt', async () => {
    storeRecoverableNativeSession('reconciliation_required');
    mocks.authApiPost
      .mockRejectedValueOnce({
        response: { status: 409, data: { code: 'LOGOUT_NOT_ACKNOWLEDGED' } },
      })
      .mockResolvedValueOnce(nativeSessionResponse())
      .mockImplementationOnce(async () => {
        expect(storage.values.get('zerotime.native-auth.refresh.v1')).toBe('refresh-token');
        expect(storage.values.get('zerotime.native-auth.session.v1')).toContain(
          '"refreshRecoveryIdempotencyKey":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"',
        );
        expect(storage.values.get('zerotime.native-auth.session.v1')).toContain(
          '"phase":"refresh_recovery_pending"',
        );
        return nativeLogoutAcknowledgement();
      });

    await expect(refreshNativeAuthSession()).resolves.toBeNull();

    expect(mocks.authApiPost.mock.calls.map(([path]) => path)).toEqual([
      '/v1/native-auth/logout/reconcile',
      '/v1/native-auth/refresh',
      '/v1/native-auth/logout',
    ]);
    const [, body, config] = mocks.authApiPost.mock.calls[0];
    expect(body).toEqual({
      refresh_token: 'refresh-token',
      installation_id: INSTALLATION_ID,
      expected_binding_generation: 7,
    });
    expect(config.headers).toEqual({
      'X-ZeroTime-Contract': 'test-contract',
      'Idempotency-Key': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });
    const [, refreshBody, refreshConfig] = mocks.authApiPost.mock.calls[1];
    expect(refreshBody).toEqual({
      refresh_token: 'refresh-token',
      installation_id: INSTALLATION_ID,
      expected_binding_generation: 7,
    });
    expect(refreshConfig.headers).toEqual({
      'X-ZeroTime-Contract': 'test-contract',
      'Idempotency-Key': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });
    expect(mocks.setAccessToken).not.toHaveBeenCalled();
    expect(storage.values.has('zerotime.native-auth.refresh.v1')).toBe(false);
    expect(storage.values.has('zerotime.native-auth.session.v1')).toBe(false);
  });
  it('replays the durable refresh subphase after crashing behind server rotation', async () => {
    storeRecoverableNativeSession('reconciliation_required');
    let crashAfterRefresh = false;
    storage.beforeSet = async (key, value) => {
      if (
        crashAfterRefresh
        && key === 'zerotime.native-auth.session.v1'
        && value.includes('"phase":"refresh_recovery_pending"')
      ) {
        throw new Error('crash after refresh rotation');
      }
    };
    mocks.authApiPost
      .mockRejectedValueOnce({
        response: { status: 409, data: { code: 'LOGOUT_NOT_ACKNOWLEDGED' } },
      })
      .mockImplementationOnce(async () => {
        crashAfterRefresh = true;
        return nativeSessionResponse();
      });

    await expect(refreshNativeAuthSession()).rejects.toMatchObject({
      code: 'NATIVE_PENDING_MUTATION_RECOVERY_FAILED',
    });
    expect(storage.values.get('zerotime.native-auth.session.v1')).toContain(
      '"phase":"refresh_recovery_pending"',
    );
    expect(storage.values.get('zerotime.native-auth.session.v1')).toContain(
      '"refreshRecoveryIdempotencyKey":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"',
    );
    expect(storage.values.get('zerotime.native-auth.refresh.v1')).toBe('refresh-token');

    crashAfterRefresh = false;
    storage.beforeSet = null;
    mocks.authApiPost
      .mockResolvedValueOnce(nativeSessionResponse())
      .mockResolvedValueOnce(nativeLogoutAcknowledgement());

    await expect(refreshNativeAuthSession()).resolves.toBeNull();

    expect(mocks.authApiPost.mock.calls.map(([path]) => path)).toEqual([
      '/v1/native-auth/logout/reconcile',
      '/v1/native-auth/refresh',
      '/v1/native-auth/refresh',
      '/v1/native-auth/logout',
    ]);
    expect(storage.values.has('zerotime.native-auth.refresh.v1')).toBe(false);
    expect(storage.values.has('zerotime.native-auth.session.v1')).toBe(false);
  });
  it.each([401, 409, 422, 503])(
    'keeps logout reconciliation required without clearing credentials on a %i response',
    async (status) => {
      const finalizeAccountMutation = vi.fn().mockResolvedValue(ZERO_MUTATION_RECEIPT);
      setNativeAuthNotificationBarrier(createNotificationBarrier({
        finalizeAccountMutation,
      }));
      storeRecoverableNativeSession('server_acknowledgement_pending');
      mocks.authApiPost.mockRejectedValueOnce({ response: { status } });

      await expect(refreshNativeAuthSession()).rejects.toMatchObject({
        code: 'NATIVE_PENDING_MUTATION_RECOVERY_FAILED',
      });

      expect(mocks.authApiPost.mock.calls.map(([path]) => path)).toEqual([
        '/v1/native-auth/logout/reconcile',
      ]);
      expect(storage.values.get('zerotime.native-auth.session.v1')).toContain(
        '"phase":"reconciliation_required"',
      );
      expect(storage.values.get('zerotime.native-auth.refresh.v1')).toBe('refresh-token');
      expect(finalizeAccountMutation).not.toHaveBeenCalled();
      expect(mocks.setAccessToken).not.toHaveBeenCalled();
    },
  );
  it('keeps logout reconciliation required on a malformed acknowledgement', async () => {
    const finalizeAccountMutation = vi.fn().mockResolvedValue(ZERO_MUTATION_RECEIPT);
    setNativeAuthNotificationBarrier(createNotificationBarrier({
      finalizeAccountMutation,
    }));
    storeRecoverableNativeSession('server_acknowledgement_pending');
    mocks.authApiPost.mockResolvedValueOnce({ status: 200, data: { binding_state: 'unlinked' } });

    await expect(refreshNativeAuthSession()).rejects.toMatchObject({
      code: 'INVALID_LOGOUT_ACKNOWLEDGEMENT',
    });

    expect(storage.values.get('zerotime.native-auth.session.v1')).toContain(
      '"phase":"reconciliation_required"',
    );
    expect(storage.values.get('zerotime.native-auth.refresh.v1')).toBe('refresh-token');
    expect(finalizeAccountMutation).not.toHaveBeenCalled();
    expect(mocks.setAccessToken).not.toHaveBeenCalled();
  });

  it('keeps a non-enumerating reconciliation 401 closed without refreshing or replaying logout', async () => {
    const finalizeAccountMutation = vi.fn().mockResolvedValue(ZERO_MUTATION_RECEIPT);
    setNativeAuthNotificationBarrier(createNotificationBarrier({
      finalizeAccountMutation,
    }));
    await restoreNativeSession();
    const deniedRefresh = { response: { status: 401 } };
    mocks.authApiPost
      .mockRejectedValueOnce(deniedRefresh)
      .mockRejectedValueOnce(deniedRefresh);

    await expect(logoutNativeAuthSession()).rejects.toMatchObject({
      code: 'NATIVE_LOGOUT_FAILED',
    });
    expect(storage.values.get('zerotime.native-auth.session.v1')).toContain(
      '"phase":"reconciliation_required"',
    );

    await expect(refreshNativeAuthSession()).rejects.toMatchObject({
      code: 'NATIVE_PENDING_MUTATION_RECOVERY_FAILED',
    });

    expect(mocks.authApiPost.mock.calls.map(([path]) => path)).toEqual([
      '/v1/native-auth/refresh',
      '/v1/native-auth/logout',
      '/v1/native-auth/logout/reconcile',
    ]);
    expect(finalizeAccountMutation).not.toHaveBeenCalled();
    expect(storage.values.has('zerotime.native-auth.refresh.v1')).toBe(true);
    expect(storage.values.has('zerotime.native-auth.session.v1')).toBe(true);
    expect(mocks.setAccessToken).toHaveBeenCalledTimes(1);
  });
  it('keeps a newer mutation journal when delayed FCM generation work is rejected', async () => {
    await restoreNativeSession();

    let releaseJournalWrite: () => void = () => {};
    let journalWriteStarted!: () => void;
    const journalWrite = new Promise<void>((resolve) => {
      releaseJournalWrite = resolve;
    });
    const journalWriteStartedPromise = new Promise<void>((resolve) => {
      journalWriteStarted = resolve;
    });
    storage.beforeSet = async (key, value) => {
      if (
        key === 'zerotime.native-auth.session.v1'
        && value.includes('"pendingMutation"')
      ) {
        journalWriteStarted();
        await journalWrite;
      }
    };

    let acknowledgeLogout!: (response: ReturnType<typeof nativeLogoutAcknowledgement>) => void;
    const logoutAcknowledgement = new Promise<ReturnType<typeof nativeLogoutAcknowledgement>>((resolve) => {
      acknowledgeLogout = resolve;
    });
    mocks.authApiPost.mockImplementationOnce(() => logoutAcknowledgement);

    const logout = logoutNativeAuthSession();
    await journalWriteStartedPromise;
    const fcmPublication = applyNativeAuthSessionGenerations(
      SESSION_ID,
      8,
      10,
      getNativeAuthSessionTransitionGeneration(),
    );

    releaseJournalWrite();

    await expect(fcmPublication).rejects.toMatchObject({
      code: 'NATIVE_GENERATION_UPDATE_STALE',
    });
    expect(storage.values.get('zerotime.native-auth.session.v1')).toContain(
      '"phase":"native_begin_pending"',
    );
    expect(storage.values.get('zerotime.native-auth.session.v1')).toContain(
      '"bindingGeneration":7',
    );

    acknowledgeLogout(nativeLogoutAcknowledgement());
    await expect(logout).resolves.toBeUndefined();
  });
  it('persists corrupt-session begin intent before creating and finalizing its exact epoch', async () => {
    const corruptSession = JSON.stringify({
      version: 1,
      sessionId: SESSION_ID,
      authVersion: 1,
      installationId: INSTALLATION_ID,
      bindingGeneration: 7,
      tokenGeneration: 9,
      pendingMutation: {
        version: 4,
        reason: 'logout',
        sessionId: SESSION_ID,
        installationId: INSTALLATION_ID,
        bindingGeneration: 7,
        idempotencyKey: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        phase: 'pre_begin',
      },
      unexpected: true,
    });
    const recoveryReceipt = {
      success: true,
      display_epoch: '42',
      zero_counts: {
        pending_count: 0,
        delivered_count: 0,
        foreground_banner_count: 0,
        registry_count: 0,
        inflight_count: 0,
      },
    } as never;
    const beginAccountMutation = vi.fn().mockImplementation(async () => {
      storage.operations.push('begin');
      return recoveryReceipt;
    });
    const finalizeAccountMutation = vi.fn().mockImplementation(async () => {
      storage.operations.push('finalize');
      return recoveryReceipt;
    });
    setNativeAuthNotificationBarrier(createNotificationBarrier({
      beginAccountMutation,
      finalizeAccountMutation,
      getAccountMutationLineage: vi.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValue({
          ...ZERO_MUTATION_LINEAGE,
          display_epoch: recoveryReceipt.display_epoch,
        }),
    }));
    const persistedAuditValues: string[] = [];
    const persistedMarkerValues: string[] = [];
    storage.beforeSet = async (key, value) => {
      if (key === 'zerotime.native-auth.corrupt-session-audit.v1') {
        persistedAuditValues.push(value);
      }
      if (key === 'zerotime.native-auth.privacy-barrier-failed.v1') {
        persistedMarkerValues.push(value);
      }
    };
    storage.values.set('zerotime.native-auth.refresh.v1', 'refresh-token');
    storage.values.set('zerotime.native-auth.session.v1', corruptSession);
    mocks.authApiPost.mockImplementationOnce(async () => {
      storage.operations.push('reconcile');
      return nativeLogoutAcknowledgement();
    });

    await expect(recoverNativeAuthCorruptSession()).resolves.toBe(true);

    expect(mocks.authApiPost.mock.calls.map(([path]) => path)).toEqual([
      '/v1/native-auth/logout/reconcile',
    ]);
    const beginIndex = storage.operations.indexOf('begin');
    const auditIndexes = storage.operations.flatMap((operation, index) =>
      operation === 'set:zerotime.native-auth.corrupt-session-audit.v1'
        ? [index]
        : [],
    );
    const markerIndex = storage.operations.indexOf(
      'set:zerotime.native-auth.privacy-barrier-failed.v1',
    );
    const reconciliationIndex = storage.operations.indexOf('reconcile');
    expect(auditIndexes).toHaveLength(3);
    expect(auditIndexes[0]).toBeLessThan(beginIndex);
    expect(beginIndex).toBeLessThan(auditIndexes[1] ?? -1);
    expect(auditIndexes[1]).toBeLessThan(markerIndex);
    expect(markerIndex).toBeLessThan(reconciliationIndex);
    const finalizeIndex = storage.operations.indexOf('finalize');
    expect(auditIndexes[2]).toBeLessThan(finalizeIndex);
    expect(beginAccountMutation).toHaveBeenCalledWith('logout');
    expect(finalizeAccountMutation).toHaveBeenCalledWith(
      'logout',
      recoveryReceipt.display_epoch,
    );
    expect(storage.operations.filter(
      (operation) => operation === 'get:zerotime.native-auth.session.v1',
    )).toHaveLength(1);
    expect(JSON.parse(persistedMarkerValues[0] ?? '{}')).toEqual({
      version: 2,
      reason: 'logout',
      display_epoch: recoveryReceipt.display_epoch,
      corruptSession: true,
    });
    expect(JSON.parse(persistedAuditValues[0] ?? '{}')).toMatchObject({
      version: 3,
      reason: 'logout',
      phase: 'native_begin_pending',
      pendingMutation: {
        version: 4,
        phase: 'native_begin_pending',
      },
    });
    expect(JSON.parse(persistedAuditValues[1] ?? '{}')).toMatchObject({
      version: 2,
      reason: 'logout',
      display_epoch: recoveryReceipt.display_epoch,
      serverAcknowledged: false,
    });
    expect(JSON.parse(persistedAuditValues[2] ?? '{}')).toMatchObject({
      version: 2,
      reason: 'logout',
      display_epoch: recoveryReceipt.display_epoch,
      serverAcknowledged: true,
    });
    expect(storage.values.has('zerotime.native-auth.refresh.v1')).toBe(false);
    expect(storage.values.has('zerotime.native-auth.session.v1')).toBe(false);
    expect(storage.values.has('zerotime.native-auth.privacy-barrier-failed.v1')).toBe(false);
    expect(storage.values.has('zerotime.native-auth.corrupt-session-audit.v1')).toBe(false);
  });
  it('rebinds a crash-after-begin corrupt intent to the exact awaiting epoch', async () => {
    const owner = { reason: 'logout' as const, display_epoch: '77' };
    const receipt = {
      ...ZERO_MUTATION_RECEIPT,
      display_epoch: owner.display_epoch,
    };
    const beginAccountMutation = vi.fn().mockResolvedValue(receipt);
    const finalizeAccountMutation = vi.fn().mockResolvedValue(receipt);
    setNativeAuthNotificationBarrier(createNotificationBarrier({
      beginAccountMutation,
      finalizeAccountMutation,
      getAccountMutationLineage: vi.fn().mockResolvedValue({
        ...ZERO_MUTATION_LINEAGE,
        ...owner,
      }),
    }));
    storage.values.set('zerotime.native-auth.refresh.v1', 'refresh-token');
    storage.values.set(
      'zerotime.native-auth.corrupt-session-audit.v1',
      JSON.stringify({
        version: 3,
        sessionValue: 'corrupt-session',
        pendingMutation: {
          version: 4,
          reason: owner.reason,
          sessionId: SESSION_ID,
          installationId: INSTALLATION_ID,
          bindingGeneration: 7,
          idempotencyKey: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          phase: 'native_begin_pending',
        },
        reason: owner.reason,
        phase: 'native_begin_pending',
      }),
    );
    mocks.authApiPost.mockResolvedValueOnce(nativeLogoutAcknowledgement());

    await expect(recoverNativeAuthCorruptSession()).resolves.toBe(true);

    expect(beginAccountMutation).not.toHaveBeenCalled();
    expect(finalizeAccountMutation).toHaveBeenCalledWith(
      owner.reason,
      owner.display_epoch,
    );
    expect(storage.values.has('zerotime.native-auth.refresh.v1')).toBe(false);
    expect(storage.values.has('zerotime.native-auth.corrupt-session-audit.v1')).toBe(false);
  });

  it.each([
    ['inactive', null],
    ['reason mismatch', { ...ZERO_MUTATION_LINEAGE, reason: 'account_switch' }],
    ['epoch mismatch', { ...ZERO_MUTATION_LINEAGE, display_epoch: '43' }],
    ['nonzero', {
      ...ZERO_MUTATION_LINEAGE,
      zero_counts: { ...ZERO_MUTATION_RECEIPT.zero_counts, delivered_count: 1 },
    }],
  ])('rejects %s corrupt native lineage without finalizing or reconciling', async (_name, lineage) => {
    const owner = { reason: 'logout' as const, display_epoch: '42' };
    const pendingMutation = {
      version: 2 as const,
      reason: 'logout' as const,
      sessionId: SESSION_ID,
      installationId: INSTALLATION_ID,
      bindingGeneration: 7,
      idempotencyKey: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      phase: 'server_acknowledged' as const,
    };
    const beginAccountMutation = vi.fn().mockResolvedValue(ZERO_MUTATION_RECEIPT);
    const finalizeAccountMutation = vi.fn().mockResolvedValue(ZERO_MUTATION_RECEIPT);
    setNativeAuthNotificationBarrier(createNotificationBarrier({
      beginAccountMutation,
      finalizeAccountMutation,
      getAccountMutationLineage: vi.fn().mockResolvedValue(lineage),
    }));
    storage.values.set('zerotime.native-auth.privacy-barrier-failed.v1', JSON.stringify({
      version: 2,
      ...owner,
      corruptSession: true,
    }));
    storage.values.set('zerotime.native-auth.corrupt-session-audit.v1', JSON.stringify({
      version: 2,
      sessionValue: 'corrupt-session',
      pendingMutation,
      ...owner,
      serverAcknowledged: true,
    }));

    await expect(recoverNativeAuthCorruptSession()).rejects.toMatchObject({
      code: 'NATIVE_MUTATION_LINEAGE_MISMATCH',
    });

    expect(beginAccountMutation).not.toHaveBeenCalled();
    expect(finalizeAccountMutation).not.toHaveBeenCalled();
    expect(mocks.authApiPost).not.toHaveBeenCalled();
  });

  it('rejects mismatched corrupt marker and audit owners before native or network recovery', async () => {
    const beginAccountMutation = vi.fn().mockResolvedValue(ZERO_MUTATION_RECEIPT);
    const finalizeAccountMutation = vi.fn().mockResolvedValue(ZERO_MUTATION_RECEIPT);
    setNativeAuthNotificationBarrier(createNotificationBarrier({
      beginAccountMutation,
      finalizeAccountMutation,
    }));
    storage.values.set('zerotime.native-auth.privacy-barrier-failed.v1', JSON.stringify({
      version: 2,
      reason: 'logout',
      display_epoch: '42',
      corruptSession: true,
    }));
    storage.values.set('zerotime.native-auth.corrupt-session-audit.v1', JSON.stringify({
      version: 2,
      sessionValue: 'corrupt-session',
      pendingMutation: null,
      reason: 'account_switch',
      display_epoch: '42',
      serverAcknowledged: true,
    }));

    await expect(recoverNativeAuthCorruptSession()).rejects.toMatchObject({
      code: 'NATIVE_CORRUPT_SESSION_REASON_MISMATCH',
    });

    expect(beginAccountMutation).not.toHaveBeenCalled();
    expect(finalizeAccountMutation).not.toHaveBeenCalled();
    expect(mocks.authApiPost).not.toHaveBeenCalled();
  });

  it('replays an acknowledged exact corrupt receipt after native secret wipe without reading or reconciling', async () => {
    const owner = { reason: 'logout' as const, display_epoch: '42' };
    const finalizeAccountMutation = vi.fn().mockResolvedValue({
      ...ZERO_MUTATION_RECEIPT,
      display_epoch: owner.display_epoch,
    });
    setNativeAuthNotificationBarrier(createNotificationBarrier({
      finalizeAccountMutation,
      getAccountMutationLineage: vi.fn().mockResolvedValue({
        ...ZERO_MUTATION_LINEAGE,
        ...owner,
      }),
    }));
    storage.values.set('zerotime.native-auth.privacy-barrier-failed.v1', JSON.stringify({
      version: 2,
      ...owner,
      corruptSession: true,
    }));
    storage.values.set('zerotime.native-auth.corrupt-session-audit.v1', JSON.stringify({
      version: 2,
      sessionValue: 'corrupt-session',
      pendingMutation: null,
      ...owner,
      serverAcknowledged: true,
    }));

    await expect(recoverNativeAuthCorruptSession()).resolves.toBe(true);

    expect(finalizeAccountMutation).toHaveBeenCalledWith(owner.reason, owner.display_epoch);
    expect(storage.operations).not.toContain('get:zerotime.native-auth.refresh.v1');
    expect(storage.operations).not.toContain('get:zerotime.native-auth.session.v1');
    expect(storage.operations).not.toContain('get:zerotime.native-auth.transient.v1');
    expect(mocks.authApiPost).not.toHaveBeenCalled();
    expect(storage.values.has('zerotime.native-auth.privacy-barrier-failed.v1')).toBe(false);
    expect(storage.values.has('zerotime.native-auth.corrupt-session-audit.v1')).toBe(false);
  });

  it('preserves an exact corrupt refresh-recovery journal after a crash following replay', async () => {
    const pendingMutation = {
      version: 4 as const,
      reason: 'logout' as const,
      sessionId: SESSION_ID,
      installationId: INSTALLATION_ID,
      bindingGeneration: 7,
      idempotencyKey: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      displayEpoch: ZERO_MUTATION_RECEIPT.display_epoch,
      phase: 'refresh_recovery_pending' as const,
      refreshRecoveryIdempotencyKey: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    };
    storage.values.set('zerotime.native-auth.refresh.v1', 'refresh-token');
    storage.values.set('zerotime.native-auth.session.v1', JSON.stringify({
      version: 1,
      sessionId: SESSION_ID,
      authVersion: 1,
      installationId: INSTALLATION_ID,
      bindingGeneration: 7,
      tokenGeneration: 9,
      pendingMutation,
      unexpected: true,
    }));
    mocks.authApiPost
      .mockResolvedValueOnce(nativeSessionResponse())
      .mockRejectedValueOnce(new Error('crash after refresh replay'));

    await expect(recoverNativeAuthCorruptSession()).rejects.toThrow('crash after refresh replay');

    expect(JSON.parse(
      storage.values.get('zerotime.native-auth.corrupt-session-audit.v1') ?? '{}',
    )).toMatchObject({
      version: 2,
      reason: pendingMutation.reason,
      display_epoch: pendingMutation.displayEpoch,
      serverAcknowledged: false,
      pendingMutation: {
        version: 4,
        reason: pendingMutation.reason,
        displayEpoch: pendingMutation.displayEpoch,
        phase: 'refresh_recovery_pending',
        refreshRecoveryIdempotencyKey: pendingMutation.refreshRecoveryIdempotencyKey,
      },
    });
    expect(mocks.authApiPost.mock.calls.map(([path]) => path)).toEqual([
      '/v1/native-auth/refresh',
      '/v1/native-auth/logout',
    ]);
    expect(storage.values.get('zerotime.native-auth.refresh.v1')).toBe('refresh-token');
  });
  it('fails closed on a malformed corrupt refresh-recovery replay context', async () => {
    const beginAccountMutation = vi.fn().mockResolvedValue(ZERO_MUTATION_RECEIPT);
    setNativeAuthNotificationBarrier(createNotificationBarrier({ beginAccountMutation }));
    storage.values.set('zerotime.native-auth.session.v1', JSON.stringify({
      version: 1,
      sessionId: SESSION_ID,
      authVersion: 1,
      installationId: INSTALLATION_ID,
      bindingGeneration: 7,
      tokenGeneration: 9,
      pendingMutation: {
        version: 4,
        reason: 'logout',
        sessionId: SESSION_ID,
        installationId: INSTALLATION_ID,
        bindingGeneration: 7,
        idempotencyKey: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        displayEpoch: ZERO_MUTATION_RECEIPT.display_epoch,
        phase: 'refresh_recovery_pending',
      },
      unexpected: true,
    }));

    await expect(recoverNativeAuthCorruptSession()).rejects.toMatchObject({
      code: 'NATIVE_CORRUPT_SESSION_REFRESH_RECOVERY_CONTEXT_INVALID',
    });

    expect(beginAccountMutation).not.toHaveBeenCalled();
    expect(mocks.authApiPost).not.toHaveBeenCalled();
    expect(storage.values.has('zerotime.native-auth.corrupt-session-audit.v1')).toBe(false);
    expect(storage.values.has('zerotime.native-auth.privacy-barrier-failed.v1')).toBe(false);
  });

  it('replays a corrupt refresh-recovery journal before logout without reconciliation downgrade', async () => {
    const owner = {
      reason: 'logout' as const,
      display_epoch: ZERO_MUTATION_RECEIPT.display_epoch,
    };
    const pendingMutation = {
      version: 4 as const,
      reason: owner.reason,
      sessionId: SESSION_ID,
      installationId: INSTALLATION_ID,
      bindingGeneration: 7,
      idempotencyKey: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      displayEpoch: owner.display_epoch,
      phase: 'refresh_recovery_pending' as const,
      refreshRecoveryIdempotencyKey: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    };
    const finalizeAccountMutation = vi.fn().mockResolvedValue(ZERO_MUTATION_RECEIPT);
    setNativeAuthNotificationBarrier(createNotificationBarrier({
      finalizeAccountMutation,
      getAccountMutationLineage: vi.fn().mockResolvedValue({
        ...ZERO_MUTATION_LINEAGE,
        ...owner,
      }),
    }));
    storage.values.set('zerotime.native-auth.refresh.v1', 'refresh-token');
    storage.values.set('zerotime.native-auth.privacy-barrier-failed.v1', JSON.stringify({
      version: 2,
      ...owner,
      corruptSession: true,
    }));
    storage.values.set('zerotime.native-auth.corrupt-session-audit.v1', JSON.stringify({
      version: 2,
      sessionValue: 'corrupt-session',
      pendingMutation,
      ...owner,
      serverAcknowledged: false,
    }));
    mocks.authApiPost
      .mockImplementationOnce(async () => {
        expect(storage.values.get('zerotime.native-auth.refresh.v1')).toBe('refresh-token');
        return nativeSessionResponse();
      })
      .mockImplementationOnce(async () => {
        expect(storage.values.get('zerotime.native-auth.refresh.v1')).toBe('refresh-token');
        return nativeLogoutAcknowledgement();
      });

    await expect(recoverNativeAuthCorruptSession()).resolves.toBe(true);

    expect(mocks.authApiPost.mock.calls.map(([path]) => path)).toEqual([
      '/v1/native-auth/refresh',
      '/v1/native-auth/logout',
    ]);
    const [, refreshBody, refreshConfig] = mocks.authApiPost.mock.calls[0];
    expect(refreshBody).toEqual({
      refresh_token: 'refresh-token',
      installation_id: INSTALLATION_ID,
      expected_binding_generation: 7,
    });
    expect(refreshConfig.headers).toEqual({
      'X-ZeroTime-Contract': 'test-contract',
      'Idempotency-Key': pendingMutation.refreshRecoveryIdempotencyKey,
    });
    expect(finalizeAccountMutation).toHaveBeenCalledWith(owner.reason, owner.display_epoch);
    expect(storage.values.has('zerotime.native-auth.refresh.v1')).toBe(false);
    expect(storage.values.has('zerotime.native-auth.corrupt-session-audit.v1')).toBe(false);
  });
  it.each([
    ['legacy', JSON.stringify({ version: 1, reason: 'logout' })],
    ['unowned', JSON.stringify({ version: 2, unowned: true })],
  ])('keeps %s privacy evidence blocked without probing or creating a mutation', async (_name, marker) => {
    const beginAccountMutation = vi.fn().mockResolvedValue(ZERO_MUTATION_RECEIPT);
    const finalizeAccountMutation = vi.fn().mockResolvedValue(ZERO_MUTATION_RECEIPT);
    const getAccountMutationLineage = vi.fn().mockResolvedValue(ZERO_MUTATION_LINEAGE);
    setNativeAuthNotificationBarrier(createNotificationBarrier({
      beginAccountMutation,
      finalizeAccountMutation,
      getAccountMutationLineage,
    }));
    storage.values.set('zerotime.native-auth.privacy-barrier-failed.v1', marker);

    await expect(refreshNativeAuthSession()).rejects.toMatchObject({
      code: 'LOCAL_PRIVACY_BARRIER_RECOVERY_UNOWNED',
    });

    expect(beginAccountMutation).not.toHaveBeenCalled();
    expect(finalizeAccountMutation).not.toHaveBeenCalled();
    expect(getAccountMutationLineage).not.toHaveBeenCalled();
    expect(mocks.authApiPost).not.toHaveBeenCalled();
  });

  it.each([
    ['empty', ''],
    ['malformed', '{'],
  ])('keeps %s privacy evidence blocked without beginning a guessed mutation', async (_name, marker) => {
    const beginAccountMutation = vi.fn().mockResolvedValue(ZERO_MUTATION_RECEIPT);
    setNativeAuthNotificationBarrier(createNotificationBarrier({ beginAccountMutation }));
    storage.values.set('zerotime.native-auth.privacy-barrier-failed.v1', marker);

    await expect(refreshNativeAuthSession()).rejects.toMatchObject({
      code: 'INVALID_PRIVACY_BARRIER_FAILURE_STATE',
    });

    expect(beginAccountMutation).not.toHaveBeenCalled();
    expect(mocks.authApiPost).not.toHaveBeenCalled();
  });
});
