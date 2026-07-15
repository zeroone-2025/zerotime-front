import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api, { authApi } from '@/_lib/api/client';
import { DELETION_OPERATION_STORAGE_KEY } from '@/_lib/accountDeletion';
import { clearAccessToken, getAccessToken, setAccessToken } from '@/_lib/auth/tokenStore';

interface NativeSession {
  readonly sessionId: string;
  readonly authVersion: number;
  readonly installationId: string;
  readonly bindingGeneration: number;
  readonly tokenGeneration: number;
  readonly authorizationBearer: string;
}
interface NativeSessionBinder {
  bindSession(session: NativeSession): Promise<'bound' | 'blocked' | 'failed'>;
}


const startup = vi.hoisted(() => ({
  native: true,
  platform: 'ios',
  session: null as NativeSession | null,
  initializeAuth: vi.fn(),
  refreshNativeAuthSession: vi.fn(),
  prepareNativeTerminalRecovery: vi.fn(),
  applyNativeAuthSessionGenerations: vi.fn(),
  nativeSessionTransitionGeneration: 0,
  isNativeAuthSessionCurrent: vi.fn(() => true),
  invalidateNativeAuthSessionForMutation: vi.fn(),
  releaseNativeAuthSessionAfterDeletionCancellation: vi.fn(),
  setNativeAuthNotificationBarrier: vi.fn(),
  setNativeAuthSecureStorageAdapter: vi.fn(),
  setNativeAuthSessionBinder: vi.fn(),
  nativeSessionBinder: null as NativeSessionBinder | null,
  nativeInitialize: vi.fn(),
  nativeGetOrCreateInstallationId: vi.fn(),
  nativeBindSession: vi.fn(),
  nativeUpdateSessionGenerations: vi.fn(),
  nativeGetDisplayPermission: vi.fn(),
  nativeRequestDisplayPermission: vi.fn(),
  nativeAddListener: vi.fn(),
  mobileRegisterInstallation: vi.fn(),
  nativeBeginAccountMutation: vi.fn(),
  nativeFinalizeAccountMutation: vi.fn(),
  nativeGetAccountMutationLineage: vi.fn(),
  nativeCreateSecureStorageAdapter: vi.fn(),
  nativeSecureStorageSet: vi.fn(),
  nativeSecureStorageGet: vi.fn(),
  zeroMutationReceipt: {
    success: true,
    display_epoch: '18446744073709551615',
    zero_counts: {
      pending_count: 0,
      delivered_count: 0,
      foreground_banner_count: 0,
      registry_count: 0,
      inflight_count: 0,
    },
  },
  releaseManifest: {
    contract: 'mobile-release.v1',
    contract_sha256: '0f736c8e90c5ba1ea68370e327f2f405fba5a83e4807c3bc7691aaa8c0711d84',
    plane: 'prod',
    frontend_git_sha: 'a'.repeat(40),
    backend_git_sha: 'b'.repeat(40),
    backend_image_digest: `sha256:${'c'.repeat(64)}`,
    backend_deployment_id: 'deployment-1',
    backend_deployed_at_utc: '2026-07-13T00:00:00.000Z',
    firebase_project_id: 'zerotime-prod',
    api_origin: 'https://api.zerotime.kr',
    platform: 'ios',
    app_version: '1.0.0',
    build_number: '1',
    bundle_id: 'kr.zerotime.app',
  },
}));


vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => startup.native,
    getPlatform: () => startup.platform,
  },
}));

vi.mock('@capacitor/splash-screen', () => ({
  SplashScreen: { hide: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('@/_lib/api', () => ({
  api: {
    defaults: { baseURL: 'https://api.zerotime.kr' },
    post: vi.fn(),
    put: vi.fn(),
  },
  initializeAuth: startup.initializeAuth,
}));
vi.mock('@/_lib/api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/_lib/api/client')>();
  return {
    ...original,
    mobileReleaseClient: {
      registerInstallation: startup.mobileRegisterInstallation,
    },
  };
});

vi.mock('@/_lib/hooks/useUser', () => ({
  useUser: vi.fn(),
}));

vi.mock('@/_lib/native/nativeAuth', () => ({
  applyNativeAuthSessionGenerations: startup.applyNativeAuthSessionGenerations,
  createNativeAuthSecureStorageAdapter: startup.nativeCreateSecureStorageAdapter,
  getNativeAuthSession: () => startup.session,
  getNativeAuthSessionTransitionGeneration: () => startup.nativeSessionTransitionGeneration,
  invalidateNativeAuthSessionForMutation: startup.invalidateNativeAuthSessionForMutation,
  isNativeAuthPlatform: () => startup.native,
  isNativeAuthSessionCurrent: startup.isNativeAuthSessionCurrent,
  refreshNativeAuthSession: startup.refreshNativeAuthSession,
  releaseNativeAuthSessionAfterDeletionCancellation:
    startup.releaseNativeAuthSessionAfterDeletionCancellation,
  prepareNativeTerminalRecovery: startup.prepareNativeTerminalRecovery,
  setNativeAuthNotificationBarrier: startup.setNativeAuthNotificationBarrier,
  setNativeAuthSecureStorageAdapter: startup.setNativeAuthSecureStorageAdapter,
  setNativeAuthSessionBinder: startup.setNativeAuthSessionBinder,
  subscribeToNativeAuthCallbacks: () => () => undefined,
}));

vi.mock('@/_lib/native/mobileRelease', () => ({
  MOBILE_RELEASE_CONTRACT: 'mobile-release.v1',
  MOBILE_RELEASE_CONTRACT_SHA256: '0f736c8e90c5ba1ea68370e327f2f405fba5a83e4807c3bc7691aaa8c0711d84',
  MOBILE_RELEASE_ARTIFACT: 'native',
  NATIVE_API_ORIGIN_BY_PLANE: {
    beta: 'https://beta-api.zerotime.kr',
    prod: 'https://api.zerotime.kr',
  },
  capacitorPreferencesStorage: {},
  createIdempotencyKey: () => 'idempotency-key',
  getOrCreateInstallationId: vi.fn().mockResolvedValue('installation-id'),
  isValidatedNativeReleaseRuntime: () => startup.native,
  readMobileReleaseBuildManifest: vi.fn(() => startup.releaseManifest),
  readValidatedNativeReleaseManifest: vi.fn(() => startup.releaseManifest),
  MobileReleaseClient: class {
    authorizeDisplay = vi.fn();
    registerInstallation = vi.fn();
    updateInstallationToken = vi.fn();
  },
}));

vi.mock('@/_lib/native/notificationCoordinator', () => ({
  createNativeNotificationCoordinatorAdapter: () => ({
    getOrCreateInstallationId: startup.nativeGetOrCreateInstallationId,
    initialize: startup.nativeInitialize,
    bindSession: startup.nativeBindSession,
    updateSessionGenerations: startup.nativeUpdateSessionGenerations,
    beginDisplayAuthorization: vi.fn().mockResolvedValue(null),
    scheduleAuthorizedNotification: vi.fn().mockResolvedValue(true),
    abortDisplayAuthorization: vi.fn().mockResolvedValue(undefined),
    beginTapAuthorization: vi.fn().mockResolvedValue(null),
    completeTapAuthorization: vi.fn().mockResolvedValue(true),
    abortTapAuthorization: vi.fn().mockResolvedValue(undefined),
    beginAccountMutation: startup.nativeBeginAccountMutation,
    finalizeAccountMutation: startup.nativeFinalizeAccountMutation,
    getAccountMutationLineage: startup.nativeGetAccountMutationLineage,
    getDisplayPermission: startup.nativeGetDisplayPermission,
    requestDisplayPermission: startup.nativeRequestDisplayPermission,
    openNotificationSettings: vi.fn().mockResolvedValue(undefined),
    addDataOnlyPushListener: startup.nativeAddListener,
    addNotificationTapListener: startup.nativeAddListener,
    addFcmTokenListener: startup.nativeAddListener,
  }),
  hasZeroNotificationCounts: (receipt: typeof startup.zeroMutationReceipt) =>
    receipt.success && Object.values(receipt.zero_counts).every((count) => count === 0),
  hasZeroNativeNotificationCounts: (
    counts: typeof startup.zeroMutationReceipt.zero_counts,
  ) => Object.values(counts).every((count) => count === 0),
}));

async function renderProviders() {
  const { default: Providers } = await import('./providers');
  return render(
    <Providers>
      <div>normal application content</div>
    </Providers>,
  );
}

function configureNativeStartup() {
  startup.native = true;
  startup.platform = 'ios';
  startup.session = null;
  startup.nativeSessionTransitionGeneration = 0;
  startup.nativeSessionBinder = null;
  startup.initializeAuth.mockResolvedValue(false);
  startup.refreshNativeAuthSession.mockResolvedValue(null);
  startup.prepareNativeTerminalRecovery.mockResolvedValue('credential_free');
  startup.nativeInitialize.mockResolvedValue(true);
  startup.nativeGetOrCreateInstallationId.mockResolvedValue('11111111-1111-4111-8111-111111111111');
  startup.nativeBindSession.mockResolvedValue(true);
  startup.nativeUpdateSessionGenerations.mockResolvedValue(true);
  startup.nativeGetDisplayPermission.mockResolvedValue('granted');
  startup.nativeRequestDisplayPermission.mockResolvedValue('granted');
  startup.nativeAddListener.mockResolvedValue({ remove: vi.fn().mockResolvedValue(undefined) });
  startup.nativeBeginAccountMutation.mockImplementation(async () => startup.zeroMutationReceipt);
  startup.nativeFinalizeAccountMutation.mockImplementation(
    async (_reason: string, displayEpoch: string) => ({
      ...startup.zeroMutationReceipt,
      display_epoch: displayEpoch,
    }),
  );
  startup.nativeGetAccountMutationLineage.mockResolvedValue(null);
  startup.nativeSecureStorageSet.mockResolvedValue(undefined);
  startup.nativeSecureStorageGet.mockResolvedValue(null);
  startup.nativeCreateSecureStorageAdapter.mockReturnValue({
    get: startup.nativeSecureStorageGet,
    set: startup.nativeSecureStorageSet,
  });
  startup.mobileRegisterInstallation.mockResolvedValue({
    binding_generation: 13,
    token_generation: 24,
  });
  startup.applyNativeAuthSessionGenerations.mockResolvedValue(undefined);
  startup.invalidateNativeAuthSessionForMutation.mockImplementation(() => {
    startup.session = null;
    startup.nativeSessionTransitionGeneration += 1;
  });
  startup.setNativeAuthSessionBinder.mockImplementation((binder: NativeSessionBinder | null) => {
    startup.nativeSessionBinder = binder;
  });
}
function getFcmTokenListener(): (data: { readonly token: string }) => void {
  const listener = startup.nativeAddListener.mock.calls[2]?.[0];
  if (typeof listener !== 'function') {
    throw new Error('Native FCM token listener was not registered.');
  }
  return listener as (data: { readonly token: string }) => void;
}

async function bindCurrentNativeSession(session: NativeSession): Promise<void> {
  const binder = startup.nativeSessionBinder;
  if (!binder) {
    throw new Error('Native session binder was not registered.');
  }
  if ((await binder.bindSession(session)) !== 'bound') {
    throw new Error('Native session was not bound.');
  }
  startup.session = session;
}

async function flushNativeAsyncWork(): Promise<void> {
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve();
  }
}
function rejectUnauthorizedRequest(config: unknown): Promise<never> {
  return Promise.reject({
    config,
    response: {
      config,
      data: null,
      headers: {},
      status: 401,
      statusText: 'Unauthorized',
    },
  });
}


describe('Providers native startup gate', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    configureNativeStartup();
    clearAccessToken();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders recovery instead of children when native coordinator initialization fails', async () => {
    startup.nativeInitialize.mockResolvedValue(false);

    await renderProviders();

    expect(await screen.findByRole('alert')).toHaveTextContent('Secure startup could not be completed');
    expect(screen.getByRole('button', { name: 'Reload app' })).toBeVisible();
    expect(screen.queryByText('normal application content')).not.toBeInTheDocument();
  });

  it('renders recovery instead of children when native identity reconciliation fails', async () => {
    startup.nativeGetOrCreateInstallationId.mockRejectedValue(new Error('native identity unavailable'));

    await renderProviders();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('normal application content')).not.toBeInTheDocument();
  });
  it('keeps children closed when native listener registration fails', async () => {
    const registeredListener = { remove: vi.fn().mockResolvedValue(undefined) };
    startup.nativeAddListener
      .mockResolvedValueOnce(registeredListener)
      .mockRejectedValueOnce(new Error('notification tap listener unavailable'));

    await renderProviders();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('normal application content')).not.toBeInTheDocument();
    expect(registeredListener.remove).toHaveBeenCalledOnce();
  });


  it('renders recovery instead of children when native auth recovery rejects', async () => {
    startup.refreshNativeAuthSession.mockRejectedValue(new Error('native recovery failed'));

    await renderProviders();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('normal application content')).not.toBeInTheDocument();
  });
  it('keeps children closed when a restored token has no published session', async () => {
    startup.refreshNativeAuthSession.mockResolvedValue('refreshed-access-token');

    await renderProviders();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('normal application content')).not.toBeInTheDocument();
  });

  it('keeps children closed when a native session exists without a restored token', async () => {
    startup.session = {
      sessionId: '22222222-2222-4222-8222-222222222222',
      authVersion: 7,
      installationId: '11111111-1111-4111-8111-111111111111',
      bindingGeneration: 12,
      tokenGeneration: 23,
      authorizationBearer: 'Bearer refreshed-access-token',
    };

    await renderProviders();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('normal application content')).not.toBeInTheDocument();
  });


  it('keeps recovery visible when native initialization resolves after the deadline', async () => {
    vi.useFakeTimers();
    let resolveNativeInitialization: ((value: boolean) => void) | null = null;
    startup.nativeInitialize.mockImplementation(
      () => new Promise<boolean>((resolve) => {
        resolveNativeInitialization = resolve;
      }),
    );

    await renderProviders();
    expect(screen.queryByText('normal application content')).not.toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(screen.getByRole('alert')).toBeInTheDocument();
    const resolve = resolveNativeInitialization;
    if (!resolve) {
      throw new Error('Native initialization did not begin.');
    }
    await act(async () => {
      resolve(true);
      await flushNativeAsyncWork();
    });
    expect(startup.nativeGetOrCreateInstallationId).not.toHaveBeenCalled();
    expect(startup.nativeGetAccountMutationLineage).toHaveBeenCalledOnce();
    expect(startup.nativeBeginAccountMutation).toHaveBeenCalledWith('logout');
    expect(startup.nativeFinalizeAccountMutation).not.toHaveBeenCalled();
    expect(startup.nativeSecureStorageSet).toHaveBeenCalledWith(
      'zerotime.native-auth.privacy-barrier-failed.v1',
      JSON.stringify({
        version: 2,
        reason: 'logout',
        display_epoch: startup.zeroMutationReceipt.display_epoch,
      }),
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('normal application content')).not.toBeInTheDocument();
  });
  it.each([
    ['completed account switch', 'account_switch', '42'],
    ['completed logout', 'logout', '43'],
  ] as const)(
    'replays a completed %s receipt with its exact reason and epoch',
    async (_state, reason, displayEpoch) => {
      startup.nativeGetOrCreateInstallationId.mockRejectedValue(
        new Error('native identity unavailable'),
      );
      startup.nativeGetAccountMutationLineage.mockResolvedValue({
        phase: 'completed',
        reason,
        display_epoch: displayEpoch,
        zero_counts: startup.zeroMutationReceipt.zero_counts,
      });

      await renderProviders();
      expect(await screen.findByRole('alert')).toBeInTheDocument();
      await act(async () => {
        await flushNativeAsyncWork();
      });

      expect(startup.nativeGetAccountMutationLineage).toHaveBeenCalledOnce();
      expect(startup.nativeBeginAccountMutation).not.toHaveBeenCalled();
      expect(startup.nativeFinalizeAccountMutation).toHaveBeenCalledWith(
        reason,
        displayEpoch,
      );
      expect(startup.nativeSecureStorageSet).not.toHaveBeenCalled();
    },
  );
  it('preserves exact completed lineage when replay finalization fails', async () => {
    startup.nativeGetOrCreateInstallationId.mockRejectedValue(
      new Error('native identity unavailable'),
    );
    startup.nativeGetAccountMutationLineage.mockResolvedValue({
      phase: 'completed',
      reason: 'account_switch',
      display_epoch: '46',
      zero_counts: startup.zeroMutationReceipt.zero_counts,
    });
    startup.nativeFinalizeAccountMutation.mockRejectedValue(
      new Error('finalize replay failed'),
    );

    await renderProviders();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await act(async () => {
      await flushNativeAsyncWork();
    });

    expect(startup.nativeSecureStorageSet).toHaveBeenCalledWith(
      'zerotime.native-auth.privacy-barrier-failed.v1',
      JSON.stringify({
        version: 2,
        reason: 'account_switch',
        display_epoch: '46',
      }),
    );
  });
  it('leaves recovered native-auth journals authoritative over terminal fallback', async () => {
    startup.nativeGetOrCreateInstallationId.mockRejectedValue(
      new Error('native identity unavailable'),
    );
    startup.prepareNativeTerminalRecovery.mockResolvedValue('recovered');

    await renderProviders();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await act(async () => {
      await flushNativeAsyncWork();
    });

    expect(startup.prepareNativeTerminalRecovery).toHaveBeenCalledOnce();
    expect(startup.nativeGetAccountMutationLineage).not.toHaveBeenCalled();
    expect(startup.nativeBeginAccountMutation).not.toHaveBeenCalled();
    expect(startup.nativeFinalizeAccountMutation).not.toHaveBeenCalled();
    expect(startup.nativeSecureStorageSet).not.toHaveBeenCalled();
  });
  it('keeps a crash-before-native-begin journal authoritative during terminal recovery', async () => {
    startup.nativeGetOrCreateInstallationId.mockRejectedValue(
      new Error('native identity unavailable'),
    );
    startup.prepareNativeTerminalRecovery.mockResolvedValue('journal_pending');

    await renderProviders();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await act(async () => {
      await flushNativeAsyncWork();
    });

    expect(startup.prepareNativeTerminalRecovery).toHaveBeenCalledOnce();
    expect(startup.nativeGetAccountMutationLineage).not.toHaveBeenCalled();
    expect(startup.nativeBeginAccountMutation).not.toHaveBeenCalled();
    expect(startup.nativeSecureStorageSet).not.toHaveBeenCalled();
  });
  it('keeps a crash-after-native-begin intent owner out of generic terminal recovery', async () => {
    startup.nativeGetOrCreateInstallationId.mockRejectedValue(
      new Error('native identity unavailable'),
    );
    startup.prepareNativeTerminalRecovery.mockResolvedValue('journal_pending');
    startup.nativeGetAccountMutationLineage.mockResolvedValue({
      phase: 'awaiting_finalize',
      reason: 'logout',
      display_epoch: '45',
      zero_counts: startup.zeroMutationReceipt.zero_counts,
    });

    await renderProviders();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await act(async () => {
      await flushNativeAsyncWork();
    });

    expect(startup.prepareNativeTerminalRecovery).toHaveBeenCalledOnce();
    expect(startup.nativeGetAccountMutationLineage).not.toHaveBeenCalled();
    expect(startup.nativeBeginAccountMutation).not.toHaveBeenCalled();
    expect(startup.nativeSecureStorageSet).not.toHaveBeenCalled();
  });
  it('does not synthesize a marker when terminal journal preparation is unknown', async () => {
    startup.nativeGetOrCreateInstallationId.mockRejectedValue(
      new Error('native identity unavailable'),
    );
    startup.prepareNativeTerminalRecovery.mockRejectedValue(
      new Error('terminal journal preparation failed'),
    );

    await renderProviders();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await act(async () => {
      await flushNativeAsyncWork();
    });

    expect(startup.nativeGetAccountMutationLineage).not.toHaveBeenCalled();
    expect(startup.nativeBeginAccountMutation).not.toHaveBeenCalled();
    expect(startup.nativeSecureStorageSet).not.toHaveBeenCalled();
  });
  it('retains terminal recovery dependencies until journal preparation settles', async () => {
    startup.nativeGetOrCreateInstallationId.mockRejectedValue(
      new Error('native identity unavailable'),
    );
    let resolvePreparation: ((value: 'journal_pending') => void) | null = null;
    startup.prepareNativeTerminalRecovery.mockImplementation(
      () => new Promise<'journal_pending'>((resolve) => {
        resolvePreparation = resolve;
      }),
    );

    await renderProviders();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await act(async () => {
      await flushNativeAsyncWork();
    });

    expect(startup.prepareNativeTerminalRecovery).toHaveBeenCalledOnce();
    expect(startup.setNativeAuthSecureStorageAdapter).not.toHaveBeenCalledWith(null);
    expect(startup.setNativeAuthNotificationBarrier).not.toHaveBeenCalledWith(null);

    const resolve = resolvePreparation;
    if (!resolve) {
      throw new Error('Terminal journal preparation did not begin.');
    }
    await act(async () => {
      resolve('journal_pending');
      await flushNativeAsyncWork();
    });

    expect(startup.setNativeAuthSecureStorageAdapter).toHaveBeenLastCalledWith(null);
    expect(startup.setNativeAuthNotificationBarrier).toHaveBeenLastCalledWith(null);
  });

  it('keeps an awaiting terminal lineage closed without finalizing it', async () => {
    startup.nativeGetOrCreateInstallationId.mockRejectedValue(
      new Error('native identity unavailable'),
    );
    startup.nativeGetAccountMutationLineage.mockResolvedValue({
      phase: 'awaiting_finalize',
      reason: 'deletion',
      display_epoch: '41',
      zero_counts: startup.zeroMutationReceipt.zero_counts,
    });

    await renderProviders();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await act(async () => {
      await flushNativeAsyncWork();
    });

    expect(startup.nativeBeginAccountMutation).not.toHaveBeenCalled();
    expect(startup.nativeFinalizeAccountMutation).not.toHaveBeenCalled();
    expect(startup.nativeSecureStorageSet).toHaveBeenCalledWith(
      'zerotime.native-auth.privacy-barrier-failed.v1',
      JSON.stringify({ version: 2, reason: 'deletion', display_epoch: '41' }),
    );
  });

  it('keeps a nonzero active lineage closed without finalizing or replacing it', async () => {
    startup.nativeGetOrCreateInstallationId.mockRejectedValue(
      new Error('native identity unavailable'),
    );
    startup.nativeGetAccountMutationLineage.mockResolvedValue({
      phase: 'awaiting_finalize',
      reason: 'account_switch',
      display_epoch: '44',
      zero_counts: {
        ...startup.zeroMutationReceipt.zero_counts,
        delivered_count: 1,
      },
    });

    await renderProviders();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await act(async () => {
      await flushNativeAsyncWork();
    });

    expect(startup.nativeBeginAccountMutation).not.toHaveBeenCalled();
    expect(startup.nativeFinalizeAccountMutation).not.toHaveBeenCalled();
    expect(startup.nativeSecureStorageSet).toHaveBeenCalledWith(
      'zerotime.native-auth.privacy-barrier-failed.v1',
      JSON.stringify({ version: 2, reason: 'account_switch', display_epoch: '44' }),
    );
  });

  it('does not fabricate a logout mutation after strict native lineage query rejection', async () => {
    startup.nativeGetOrCreateInstallationId.mockRejectedValue(
      new Error('native identity unavailable'),
    );
    startup.nativeGetAccountMutationLineage.mockRejectedValue(
      new Error('Native account mutation lineage was malformed.'),
    );

    await renderProviders();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await act(async () => {
      await flushNativeAsyncWork();
    });

    expect(startup.nativeBeginAccountMutation).not.toHaveBeenCalled();
    expect(startup.nativeFinalizeAccountMutation).not.toHaveBeenCalled();
    expect(startup.nativeSecureStorageSet).not.toHaveBeenCalled();
  });
  it('preserves stronger existing corrupt-session recovery evidence', async () => {
    startup.nativeGetOrCreateInstallationId.mockRejectedValue(
      new Error('native identity unavailable'),
    );
    startup.nativeSecureStorageGet.mockResolvedValue(JSON.stringify({
      version: 2,
      reason: 'account_switch',
      display_epoch: '91',
      corruptSession: true,
    }));

    await renderProviders();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await act(async () => {
      await flushNativeAsyncWork();
    });

    expect(startup.nativeSecureStorageSet).not.toHaveBeenCalled();
  });

  it('closes a proven inactive native lineage with a new local logout barrier', async () => {
    startup.nativeGetOrCreateInstallationId.mockRejectedValue(
      new Error('native identity unavailable'),
    );
    startup.nativeGetAccountMutationLineage.mockResolvedValue(null);

    await renderProviders();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await act(async () => {
      await flushNativeAsyncWork();
    });

    expect(startup.nativeGetAccountMutationLineage).toHaveBeenCalledOnce();
    expect(startup.nativeBeginAccountMutation).toHaveBeenCalledWith('logout');
    expect(startup.nativeFinalizeAccountMutation).not.toHaveBeenCalled();
    expect(startup.nativeSecureStorageSet).toHaveBeenCalledWith(
      'zerotime.native-auth.privacy-barrier-failed.v1',
      JSON.stringify({
        version: 2,
        reason: 'logout',
        display_epoch: startup.zeroMutationReceipt.display_epoch,
      }),
    );
  });

  it('retains the exact native owner when a proven no-owner begin cannot prove zero', async () => {
    startup.nativeGetOrCreateInstallationId.mockRejectedValue(
      new Error('native identity unavailable'),
    );
    const nonzeroCounts = {
      ...startup.zeroMutationReceipt.zero_counts,
      registry_count: 1,
    };
    startup.nativeGetAccountMutationLineage.mockResolvedValue(null);
    startup.nativeBeginAccountMutation.mockResolvedValue({
      ...startup.zeroMutationReceipt,
      zero_counts: nonzeroCounts,
    });

    await renderProviders();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await act(async () => {
      await flushNativeAsyncWork();
    });

    expect(startup.nativeGetAccountMutationLineage).toHaveBeenCalledOnce();
    expect(startup.nativeBeginAccountMutation).toHaveBeenCalledWith('logout');
    expect(startup.nativeFinalizeAccountMutation).not.toHaveBeenCalled();
    expect(startup.nativeSecureStorageSet).toHaveBeenCalledWith(
      'zerotime.native-auth.privacy-barrier-failed.v1',
      JSON.stringify({
        version: 2,
        reason: 'logout',
        display_epoch: startup.zeroMutationReceipt.display_epoch,
      }),
    );
  });
  it('fences a late native refresh bind after the startup timeout', async () => {
    vi.useFakeTimers();
    const restoredSession: NativeSession = {
      sessionId: '22222222-2222-4222-8222-222222222222',
      authVersion: 7,
      installationId: '11111111-1111-4111-8111-111111111111',
      bindingGeneration: 12,
      tokenGeneration: 23,
      authorizationBearer: 'Bearer refreshed-access-token',
    };
    let resumeRefresh: (() => void) | null = null;
    startup.refreshNativeAuthSession.mockImplementation(async () => {
      await new Promise<void>((resolve) => {
        resumeRefresh = resolve;
      });

      const binder = startup.nativeSessionBinder;
      if (!binder || !(await binder.bindSession(restoredSession))) {
        return null;
      }
      startup.session = restoredSession;
      const activeTokenStore = await import('@/_lib/auth/tokenStore');
      activeTokenStore.setAccessToken('late-refreshed-access-token', { persistSessionHint: false });
      return 'late-refreshed-access-token';
    });

    await renderProviders();
    await act(async () => {
      await flushNativeAsyncWork();
    });
    const resume = resumeRefresh;
    if (!resume) {
      throw new Error('Native refresh did not begin.');
    }

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(screen.getByRole('alert')).toBeInTheDocument();

    await act(async () => {
      resume();
      await flushNativeAsyncWork();
    });

    expect(startup.invalidateNativeAuthSessionForMutation).toHaveBeenCalled();
    expect(startup.nativeBindSession).not.toHaveBeenCalled();
    expect(startup.nativeSessionBinder).toBeNull();
    expect(startup.session).toBeNull();
    const activeTokenStore = await import('@/_lib/auth/tokenStore');
    expect(activeTokenStore.getAccessToken()).toBeNull();
    expect(screen.queryByText('normal application content')).not.toBeInTheDocument();
  });


  it('keeps a pre-reauth deletion intent resumable without closing fresh session admission', async () => {
    startup.nativeSecureStorageGet.mockImplementation(async (key: string) => {
      if (key !== DELETION_OPERATION_STORAGE_KEY) {
        return null;
      }
      return JSON.stringify({
        version: 1,
        kind: 'request',
        phase: 'reauth_pending',
        idempotencyKey: '22222222-2222-4222-8222-222222222222',
        updatedAtUtc: new Date().toISOString(),
      });
    });

    await renderProviders();

    expect(await screen.findByText('normal application content')).toBeVisible();
    expect(startup.refreshNativeAuthSession).toHaveBeenCalledOnce();
    expect(startup.nativeBeginAccountMutation).not.toHaveBeenCalled();
    expect(startup.invalidateNativeAuthSessionForMutation).not.toHaveBeenCalled();
  });
  it.each([
    ['request', 'native_begin_pending', 'awaiting_finalize'],
    ['request', 'sending', 'awaiting_finalize'],
    ['request', 'outcome_unknown', 'awaiting_finalize'],
    ['request', 'server_acknowledged', 'awaiting_finalize'],
    ['request', 'local_cleanup_pending', 'completed'],
    ['request', 'local_complete', 'completed'],
    ['cancel', 'sending', 'completed'],
    ['cancel', 'outcome_unknown', 'awaiting_finalize'],
    ['cancel', 'server_acknowledged', 'awaiting_finalize'],
    ['cancel', 'local_cleanup_pending', 'completed'],
  ] as const)(
    'recovers a %s %s deletion journal before native session binding',
    async (kind, phase, lineagePhase) => {
      const requestId = '33333333-3333-4333-8333-333333333333';
      const requiresRequestId = kind === 'cancel'
        || phase === 'server_acknowledged'
        || phase === 'local_cleanup_pending'
        || phase === 'local_complete';
      startup.nativeSecureStorageGet.mockImplementation(async (key: string) => {
        if (key !== DELETION_OPERATION_STORAGE_KEY) {
          return null;
        }
        return JSON.stringify({
          version: 1,
          kind,
          phase,
          idempotencyKey: '22222222-2222-4222-8222-222222222222',
          ...(requiresRequestId ? { requestId } : {}),
          updatedAtUtc: new Date().toISOString(),
        });
      });
      startup.nativeGetAccountMutationLineage.mockResolvedValue({
        phase: lineagePhase,
        reason: 'deletion',
        display_epoch: '47',
        zero_counts: startup.zeroMutationReceipt.zero_counts,
      });

      await renderProviders();

      expect(await screen.findByText('normal application content')).toBeVisible();
      expect(startup.refreshNativeAuthSession).not.toHaveBeenCalled();
      expect(startup.nativeBindSession).not.toHaveBeenCalled();
      const { ensureNativeAccountDeletionBarrier } = await import('./providers');
      await expect(ensureNativeAccountDeletionBarrier()).resolves.toBe('47');
      expect(startup.nativeBeginAccountMutation).not.toHaveBeenCalled();
    },
  );
  it('fails closed when a completed request journal loses native lineage', async () => {
    startup.nativeSecureStorageGet.mockImplementation(async (key: string) => {
      if (key !== DELETION_OPERATION_STORAGE_KEY) {
        return null;
      }
      return JSON.stringify({
        version: 1,
        kind: 'request',
        phase: 'local_complete',
        idempotencyKey: '22222222-2222-4222-8222-222222222222',
        requestId: '33333333-3333-4333-8333-333333333333',
        updatedAtUtc: new Date().toISOString(),
      });
    });
    startup.nativeGetAccountMutationLineage.mockResolvedValue(null);

    await renderProviders();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(startup.refreshNativeAuthSession).not.toHaveBeenCalled();
    expect(startup.nativeBindSession).not.toHaveBeenCalled();
  });
  it('releases a completed cancellation journal for fresh session recovery', async () => {
    startup.nativeSecureStorageGet.mockImplementation(async (key: string) => {
      if (key !== DELETION_OPERATION_STORAGE_KEY) {
        return null;
      }
      return JSON.stringify({
        version: 1,
        kind: 'cancel',
        phase: 'local_complete',
        idempotencyKey: '22222222-2222-4222-8222-222222222222',
        requestId: '33333333-3333-4333-8333-333333333333',
        updatedAtUtc: new Date().toISOString(),
      });
    });
    startup.nativeGetAccountMutationLineage.mockResolvedValue({
      phase: 'completed',
      reason: 'deletion',
      display_epoch: '52',
      zero_counts: startup.zeroMutationReceipt.zero_counts,
    });

    await renderProviders();

    expect(await screen.findByText('normal application content')).toBeVisible();
    expect(startup.refreshNativeAuthSession).toHaveBeenCalledOnce();
    expect(startup.nativeBindSession).not.toHaveBeenCalled();
    expect(startup.invalidateNativeAuthSessionForMutation).not.toHaveBeenCalled();
    expect(startup.releaseNativeAuthSessionAfterDeletionCancellation).toHaveBeenCalledOnce();
  });
  it('rejects a local-complete deletion journal with an awaiting native lineage', async () => {
    startup.nativeSecureStorageGet.mockImplementation(async (key: string) => {
      if (key !== DELETION_OPERATION_STORAGE_KEY) {
        return null;
      }
      return JSON.stringify({
        version: 1,
        kind: 'request',
        phase: 'local_complete',
        idempotencyKey: '22222222-2222-4222-8222-222222222222',
        requestId: '33333333-3333-4333-8333-333333333333',
        updatedAtUtc: new Date().toISOString(),
      });
    });
    startup.nativeGetAccountMutationLineage.mockResolvedValue({
      phase: 'awaiting_finalize',
      reason: 'deletion',
      display_epoch: '50',
      zero_counts: startup.zeroMutationReceipt.zero_counts,
    });

    await renderProviders();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(startup.refreshNativeAuthSession).not.toHaveBeenCalled();
    expect(startup.nativeBindSession).not.toHaveBeenCalled();
  });
  it('never lets deletion recovery overtake an authoritative native-auth journal', async () => {
    startup.prepareNativeTerminalRecovery.mockResolvedValue('journal_pending');
    startup.nativeSecureStorageGet.mockImplementation(async (key: string) => {
      if (key !== DELETION_OPERATION_STORAGE_KEY) {
        return null;
      }
      return JSON.stringify({
        version: 1,
        kind: 'request',
        phase: 'native_begin_pending',
        idempotencyKey: '22222222-2222-4222-8222-222222222222',
        updatedAtUtc: new Date().toISOString(),
      });
    });

    await renderProviders();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(startup.nativeGetAccountMutationLineage).not.toHaveBeenCalled();
    expect(startup.nativeBeginAccountMutation).not.toHaveBeenCalled();
  });
  it('replays a request native-begin intent with no native owner before session binding', async () => {
    startup.nativeSecureStorageGet.mockImplementation(async (key: string) => {
      if (key !== DELETION_OPERATION_STORAGE_KEY) {
        return null;
      }
      return JSON.stringify({
        version: 1,
        kind: 'request',
        phase: 'native_begin_pending',
        idempotencyKey: '22222222-2222-4222-8222-222222222222',
        updatedAtUtc: new Date().toISOString(),
      });
    });
    startup.nativeGetAccountMutationLineage.mockResolvedValue(null);
    startup.nativeBeginAccountMutation.mockResolvedValue({
      ...startup.zeroMutationReceipt,
      display_epoch: '51',
    });

    await renderProviders();

    expect(await screen.findByText('normal application content')).toBeVisible();
    expect(startup.nativeBeginAccountMutation).toHaveBeenCalledWith('deletion');
    expect(startup.prepareNativeTerminalRecovery.mock.invocationCallOrder[0]).toBeLessThan(
      startup.nativeGetAccountMutationLineage.mock.invocationCallOrder[0]!,
    );
    expect(startup.refreshNativeAuthSession).not.toHaveBeenCalled();
    expect(startup.nativeBindSession).not.toHaveBeenCalled();
    const { ensureNativeAccountDeletionBarrier } = await import('./providers');
    await expect(ensureNativeAccountDeletionBarrier()).resolves.toBe('51');
  });
  it('fails closed when a pre-acknowledgement deletion journal has no native owner', async () => {
    startup.nativeSecureStorageGet.mockImplementation(async (key: string) => {
      if (key !== DELETION_OPERATION_STORAGE_KEY) {
        return null;
      }
      return JSON.stringify({
        version: 1,
        kind: 'request',
        phase: 'outcome_unknown',
        idempotencyKey: '22222222-2222-4222-8222-222222222222',
        updatedAtUtc: new Date().toISOString(),
      });
    });
    startup.nativeGetAccountMutationLineage.mockResolvedValue(null);

    await renderProviders();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(startup.refreshNativeAuthSession).not.toHaveBeenCalled();
    expect(startup.nativeBindSession).not.toHaveBeenCalled();
    expect(startup.nativeBeginAccountMutation).not.toHaveBeenCalled();
  });
  it('fails closed when a pre-acknowledgement deletion journal conflicts with native ownership', async () => {
    startup.nativeSecureStorageGet.mockImplementation(async (key: string) => {
      if (key !== DELETION_OPERATION_STORAGE_KEY) {
        return null;
      }
      return JSON.stringify({
        version: 1,
        kind: 'request',
        phase: 'sending',
        idempotencyKey: '22222222-2222-4222-8222-222222222222',
        updatedAtUtc: new Date().toISOString(),
      });
    });
    startup.nativeGetAccountMutationLineage.mockResolvedValue({
      phase: 'awaiting_finalize',
      reason: 'logout',
      display_epoch: '48',
      zero_counts: startup.zeroMutationReceipt.zero_counts,
    });

    await renderProviders();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(startup.refreshNativeAuthSession).not.toHaveBeenCalled();
    expect(startup.nativeBindSession).not.toHaveBeenCalled();
    expect(startup.nativeBeginAccountMutation).not.toHaveBeenCalled();
  });
  it('fails closed when a deletion lineage has no resumable deletion journal', async () => {
    startup.nativeGetAccountMutationLineage.mockResolvedValue({
      phase: 'awaiting_finalize',
      reason: 'deletion',
      display_epoch: '49',
      zero_counts: startup.zeroMutationReceipt.zero_counts,
    });

    await renderProviders();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(startup.refreshNativeAuthSession).not.toHaveBeenCalled();
    expect(startup.nativeBindSession).not.toHaveBeenCalled();
    expect(startup.nativeBeginAccountMutation).not.toHaveBeenCalled();
  });
  it('publishes a restored session only after binding its full Bearer authorization', async () => {
    const restoredSession: NativeSession = {
      sessionId: '22222222-2222-4222-8222-222222222222',
      authVersion: 7,
      installationId: '11111111-1111-4111-8111-111111111111',
      bindingGeneration: 12,
      tokenGeneration: 23,
      authorizationBearer: 'Bearer refreshed-access-token',
    };
    startup.refreshNativeAuthSession.mockImplementation(async () => {
      const binder = startup.nativeSessionBinder;
      if (!binder) {
        throw new Error('Native session binder was not registered.');
      }
      if (!(await binder.bindSession(restoredSession))) {
        return null;
      }
      startup.session = restoredSession;
      return 'refreshed-access-token';
    });

    await renderProviders();

    expect(await screen.findByText('normal application content')).toBeVisible();
    expect(startup.nativeBindSession).toHaveBeenCalledWith({
      sessionId: restoredSession.sessionId,
      authVersion: '7',
      bindingGeneration: 12,
      tokenGeneration: 23,
      authorizationBearer: 'Bearer refreshed-access-token',
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('admits children while the foreground permission prompt is delayed beyond startup', async () => {
    vi.useFakeTimers();
    let resolvePermissionRequest: ((value: string) => void) | null = null;
    startup.nativeGetDisplayPermission.mockResolvedValue('not_determined');
    startup.nativeRequestDisplayPermission.mockImplementation(
      () => new Promise<string>((resolve) => {
        resolvePermissionRequest = resolve;
      }),
    );

    await renderProviders();
    await act(async () => {
      await flushNativeAsyncWork();
    });

    expect(screen.getByText('normal application content')).toBeVisible();
    expect(startup.nativeRequestDisplayPermission).toHaveBeenCalledOnce();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(screen.getByText('normal application content')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    const resolve = resolvePermissionRequest;
    if (!resolve) {
      throw new Error('Native permission prompt did not begin.');
    }
    await act(async () => {
      resolve('granted');
      await flushNativeAsyncWork();
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('replays an FCM token received before the current session binds', async () => {
    const session: NativeSession = {
      sessionId: '22222222-2222-4222-8222-222222222222',
      authVersion: 7,
      installationId: '11111111-1111-4111-8111-111111111111',
      bindingGeneration: 12,
      tokenGeneration: 23,
      authorizationBearer: 'Bearer refreshed-access-token',
    };

    await renderProviders();
    expect(await screen.findByText('normal application content')).toBeVisible();

    act(() => {
      getFcmTokenListener()({ token: ' fcm-token-before-bind ' });
    });
    await flushNativeAsyncWork();
    expect(startup.mobileRegisterInstallation).not.toHaveBeenCalled();

    await act(async () => {
      await bindCurrentNativeSession(session);
      await flushNativeAsyncWork();
    });

    expect(startup.mobileRegisterInstallation).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      {
        platform: 'ios',
        environment: 'production',
        token_provider: 'fcm',
        token_type: 'fcm_registration',
        fcm_token: 'fcm-token-before-bind',
        permission_status: 'granted',
        expected_binding_generation: 12,
      },
    );
    expect(startup.nativeUpdateSessionGenerations).toHaveBeenCalledWith({
      sessionId: session.sessionId,
      bindingGeneration: 13,
      tokenGeneration: 24,
    });
    expect(startup.applyNativeAuthSessionGenerations).toHaveBeenCalledWith(
      session.sessionId,
      13,
      24,
      0,
    );

    act(() => {
      getFcmTokenListener()({ token: 'fcm-token-before-bind' });
    });
    await flushNativeAsyncWork();
    expect(startup.mobileRegisterInstallation).toHaveBeenCalledOnce();
  });

  it('retains a failed FCM sync and retries the same token', async () => {
    const session: NativeSession = {
      sessionId: '22222222-2222-4222-8222-222222222222',
      authVersion: 7,
      installationId: '11111111-1111-4111-8111-111111111111',
      bindingGeneration: 12,
      tokenGeneration: 23,
      authorizationBearer: 'Bearer refreshed-access-token',
    };
    startup.mobileRegisterInstallation
      .mockRejectedValueOnce(new Error('temporary registration failure'))
      .mockResolvedValueOnce({
        binding_generation: 13,
        token_generation: 24,
      });

    await renderProviders();
    expect(await screen.findByText('normal application content')).toBeVisible();
    vi.useFakeTimers();

    act(() => {
      getFcmTokenListener()({ token: 'fcm-token-retry' });
    });
    await act(async () => {
      await bindCurrentNativeSession(session);
      await flushNativeAsyncWork();
    });

    expect(startup.mobileRegisterInstallation).toHaveBeenCalledOnce();
    expect(startup.nativeUpdateSessionGenerations).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
      await flushNativeAsyncWork();
    });

    expect(startup.mobileRegisterInstallation).toHaveBeenCalledTimes(2);
    expect(startup.mobileRegisterInstallation.mock.calls[0]?.[1]).toMatchObject({
      fcm_token: 'fcm-token-retry',
    });
    expect(startup.mobileRegisterInstallation.mock.calls[1]?.[1]).toMatchObject({
      fcm_token: 'fcm-token-retry',
    });
    expect(startup.nativeUpdateSessionGenerations).toHaveBeenCalledOnce();
    expect(startup.applyNativeAuthSessionGenerations).toHaveBeenCalledOnce();
  });

  it('fences terminal FCM recovery from later session or token publication', async () => {
    const session: NativeSession = {
      sessionId: '22222222-2222-4222-8222-222222222222',
      authVersion: 7,
      installationId: '11111111-1111-4111-8111-111111111111',
      bindingGeneration: 12,
      tokenGeneration: 23,
      authorizationBearer: 'Bearer refreshed-access-token',
    };
    startup.applyNativeAuthSessionGenerations.mockRejectedValueOnce(
      new Error('secure generation publication failed'),
    );

    await renderProviders();
    expect(await screen.findByText('normal application content')).toBeVisible();
    const activeTokenStore = await import('@/_lib/auth/tokenStore');
    activeTokenStore.setAccessToken('already-published-access-token', { persistSessionHint: false });

    act(() => {
      getFcmTokenListener()({ token: 'fcm-token-terminal' });
    });
    await act(async () => {
      await bindCurrentNativeSession(session);
      await flushNativeAsyncWork();
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Secure startup could not be completed',
    );
    await act(async () => {
      await flushNativeAsyncWork();
    });
    expect(startup.invalidateNativeAuthSessionForMutation).toHaveBeenCalledOnce();
    expect(startup.nativeBeginAccountMutation).toHaveBeenCalledWith('logout');
    expect(startup.nativeFinalizeAccountMutation).not.toHaveBeenCalled();
    expect(startup.nativeSecureStorageSet).toHaveBeenCalledWith(
      'zerotime.native-auth.privacy-barrier-failed.v1',
      JSON.stringify({
        version: 2,
        reason: 'logout',
        display_epoch: startup.zeroMutationReceipt.display_epoch,
      }),
    );
    expect(startup.mobileRegisterInstallation).toHaveBeenCalledOnce();
    expect(startup.nativeUpdateSessionGenerations).toHaveBeenCalledOnce();
    expect(startup.applyNativeAuthSessionGenerations).toHaveBeenCalledOnce();
    expect(startup.nativeSessionBinder).toBeNull();
    expect(startup.session).toBeNull();
    expect(activeTokenStore.getAccessToken()).toBeNull();

    act(() => {
      getFcmTokenListener()({ token: 'fcm-token-after-recovery' });
    });
    await act(async () => {
      await flushNativeAsyncWork();
    });

    expect(startup.mobileRegisterInstallation).toHaveBeenCalledOnce();
    expect(startup.nativeUpdateSessionGenerations).toHaveBeenCalledOnce();
    expect(startup.applyNativeAuthSessionGenerations).toHaveBeenCalledOnce();
  });

  it('invalidates native session publication before rejecting a nonzero deletion receipt', async () => {
    startup.nativeBeginAccountMutation.mockResolvedValue({
      success: true,
      display_epoch: '18446744073709551615',
      zero_counts: {
        pending_count: 0,
        delivered_count: 1,
        foreground_banner_count: 0,
        registry_count: 0,
        inflight_count: 0,
      },
    });
    const { beginNativeAccountDeletionBarrier } = await import('./providers');

    await expect(beginNativeAccountDeletionBarrier()).rejects.toThrow(
      'Native notification privacy barrier did not acknowledge zero state.',
    );

    expect(startup.invalidateNativeAuthSessionForMutation).toHaveBeenCalledOnce();
    expect(startup.nativeBeginAccountMutation).toHaveBeenCalledWith('deletion');
    expect(
      startup.invalidateNativeAuthSessionForMutation.mock.invocationCallOrder[0],
    ).toBeLessThan(startup.nativeBeginAccountMutation.mock.invocationCallOrder[0]);
  });
  it('retires finalized deletion epochs and rejects delayed owners', async () => {
    startup.nativeBeginAccountMutation
      .mockResolvedValueOnce({
        ...startup.zeroMutationReceipt,
        display_epoch: '41',
      })
      .mockResolvedValueOnce({
        ...startup.zeroMutationReceipt,
        display_epoch: '42',
      });
    await renderProviders();
    expect(await screen.findByText('normal application content')).toBeVisible();
    const {
      ensureNativeAccountDeletionBarrier,
      finalizeNativeAccountDeletionBarrier,
    } = await import('./providers');

    const firstEpoch = await ensureNativeAccountDeletionBarrier();
    expect(firstEpoch).toBe('41');
    await finalizeNativeAccountDeletionBarrier('41');

    const secondEpoch = await ensureNativeAccountDeletionBarrier();
    expect(secondEpoch).toBe('42');
    await expect(finalizeNativeAccountDeletionBarrier('41')).rejects.toThrow(
      'Native deletion barrier owner did not match finalization.',
    );
    await finalizeNativeAccountDeletionBarrier('42');

    expect(startup.nativeBeginAccountMutation).toHaveBeenCalledTimes(2);
    expect(startup.nativeFinalizeAccountMutation).toHaveBeenNthCalledWith(
      1,
      'deletion',
      '41',
    );
    expect(startup.nativeFinalizeAccountMutation).toHaveBeenNthCalledWith(
      2,
      'deletion',
      '42',
    );
  });

  it('renders web guest children without native reconciliation', async () => {
    startup.native = false;

    await renderProviders();

    expect(await screen.findByText('normal application content')).toBeVisible();
    expect(startup.nativeInitialize).not.toHaveBeenCalled();
  });
});
describe('API refresh response handling', () => {
  it('rejects a truthy malformed refresh token without publishing or retrying it', async () => {
    startup.native = false;
    const previousApiAdapter = api.defaults.adapter;
    const previousAuthAdapter = authApi.defaults.adapter;
    const protectedRequest = vi.fn((config) => rejectUnauthorizedRequest(config));
    const refreshRequest = vi.fn(async (config) => ({
      config,
      data: {
        access_token: { value: 'truthy-but-not-a-token' },
        token_type: 'bearer',
      },
      headers: {},
      status: 200,
      statusText: 'OK',
    }));
    api.defaults.adapter = protectedRequest;
    authApi.defaults.adapter = refreshRequest;
    setAccessToken('current-access-token', { persistSessionHint: false });

    try {
      await expect(api.get('/protected')).rejects.toThrow('Web refresh response was invalid.');

      expect(protectedRequest).toHaveBeenCalledOnce();
      expect(refreshRequest).toHaveBeenCalledOnce();
      expect(getAccessToken()).toBeNull();
    } finally {
      api.defaults.adapter = previousApiAdapter;
      authApi.defaults.adapter = previousAuthAdapter;
      clearAccessToken();
    }
  });

  it('shares a failed refresh without emitting an unhandled rejection', async () => {
    startup.native = false;
    const previousApiAdapter = api.defaults.adapter;
    const previousAuthAdapter = authApi.defaults.adapter;
    const unhandledRejections: PromiseRejectionEvent[] = [];
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      unhandledRejections.push(event);
      event.preventDefault();
    };
    let rejectRefresh: ((reason: unknown) => void) | null = null;
    const protectedRequest = vi.fn((config) => rejectUnauthorizedRequest(config));
    const refreshRequest = vi.fn(
      () => new Promise<never>((_resolve, reject) => {
        rejectRefresh = reject;
      }),
    );
    api.defaults.adapter = protectedRequest;
    authApi.defaults.adapter = refreshRequest;
    setAccessToken('current-access-token', { persistSessionHint: false });
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    try {
      const requests = Promise.allSettled([
        api.get('/protected/one'),
        api.get('/protected/two'),
      ]);
      await flushNativeAsyncWork();

      expect(refreshRequest).toHaveBeenCalledOnce();
      const reject = rejectRefresh;
      if (!reject) {
        throw new Error('Refresh request did not begin.');
      }
      reject(new Error('refresh failed'));

      const results = await requests;
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 0);
      });

      expect(results).toHaveLength(2);
      expect(results.every((result) => result.status === 'rejected')).toBe(true);
      expect(protectedRequest).toHaveBeenCalledTimes(2);
      expect(unhandledRejections).toEqual([]);
      expect(getAccessToken()).toBeNull();
    } finally {
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      api.defaults.adapter = previousApiAdapter;
      authApi.defaults.adapter = previousAuthAdapter;
      clearAccessToken();
    }
  });
});
