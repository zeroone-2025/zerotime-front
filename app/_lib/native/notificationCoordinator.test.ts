import { describe, expect, it, vi } from 'vitest';

import type { MobileReleaseBuildManifest } from './mobileRelease';
import {
  createNativeNotificationCoordinatorAdapter,
  hasZeroNotificationCounts,
  NATIVE_NOTIFICATION_COORDINATOR_CONTRACT,
  NATIVE_NOTIFICATION_COORDINATOR_PROTOCOL_ERROR,
  type NativeNotificationCoordinatorPlugin,
} from './notificationCoordinator';

const INSTALLATION_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';
const DISPLAY_OPERATION_ID = '33333333-3333-4333-8333-333333333333';
const TAP_OPERATION_ID = '44444444-4444-4444-8444-444444444444';
const DELIVERY_ID = '55555555-5555-4555-8555-555555555555';
const UINT64_MAX = '18446744073709551615';
const BINDING_GENERATION = 7;
const TOKEN_GENERATION = 9;

const releaseManifest = {
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
} as MobileReleaseBuildManifest;

const zeroCounts = {
  pending_count: 0,
  delivered_count: 0,
  foreground_banner_count: 0,
  registry_count: 0,
  inflight_count: 0,
};


function createPluginFixture() {
  const listeners = new Map<string, (data: never) => void>();
  const listenerHandle = { remove: vi.fn().mockResolvedValue(undefined) };
  const pluginCalls = {
    getOrCreateInstallationId: vi.fn().mockResolvedValue({ installation_id: INSTALLATION_ID }),
    initialize: vi.fn().mockResolvedValue({ success: true }),
    bindSession: vi.fn().mockResolvedValue({ success: true }),
    updateSessionGenerations: vi.fn().mockResolvedValue({ success: true }),
    beginDisplayAuthorization: vi.fn().mockResolvedValue({
      admitted: true,
      operation_id: DISPLAY_OPERATION_ID,
    }),
    scheduleAuthorizedNotification: vi.fn().mockResolvedValue({ success: true }),
    abortDisplayAuthorization: vi.fn().mockResolvedValue({ success: true }),
    beginTapAuthorization: vi.fn().mockResolvedValue({
      admitted: true,
      operation_id: TAP_OPERATION_ID,
    }),
    completeTapAuthorization: vi.fn().mockResolvedValue({ success: true }),
    abortTapAuthorization: vi.fn().mockResolvedValue({ success: true }),
    beginAccountMutation: vi.fn().mockResolvedValue({
      success: true,
      display_epoch: UINT64_MAX,
      zero_counts: zeroCounts,
    }),
    finalizeAccountMutation: vi.fn().mockResolvedValue({
      success: true,
      display_epoch: UINT64_MAX,
      zero_counts: zeroCounts,
    }),
    getAccountMutationLineage: vi.fn().mockResolvedValue({
      available: true,
      active: false,
      phase: null,
      reason: null,
      display_epoch: UINT64_MAX,
      zero_counts: zeroCounts,
    }),
    getDisplayPermission: vi.fn().mockResolvedValue({ permission: 'granted' }),
    requestDisplayPermission: vi.fn().mockResolvedValue({ permission: 'granted' }),
    openNotificationSettings: vi.fn().mockResolvedValue({ success: true }),
    isSecureCredentialStorageAvailable: vi.fn().mockResolvedValue({ available: true }),
    getSecureCredential: vi.fn().mockResolvedValue({ value: null }),
    setSecureCredential: vi.fn().mockResolvedValue({ success: true }),
    deleteSecureCredential: vi.fn().mockResolvedValue({ success: true }),
    addListener: vi.fn().mockImplementation(async (event: string, listener: (data: never) => void) => {
      listeners.set(event, listener);
      return listenerHandle;
    }),
  };

  return {
    plugin: pluginCalls as unknown as NativeNotificationCoordinatorPlugin,
    pluginCalls,
    listeners,
    listenerHandle,
  };
}

describe('NativeNotificationCoordinator v1 adapter', () => {
  it('passes the volatile bearer and only an opaque display operation to native', async () => {
    const { plugin, pluginCalls } = createPluginFixture();
    const adapter = createNativeNotificationCoordinatorAdapter(plugin);

    await expect(adapter.initialize(releaseManifest)).resolves.toBe(true);
    await expect(adapter.bindSession({
      sessionId: SESSION_ID,
      authVersion: 'auth-version',
      bindingGeneration: BINDING_GENERATION,
      tokenGeneration: TOKEN_GENERATION,
      authorizationBearer: 'Bearer access-token',
    })).resolves.toBe(true);

    const operation = await adapter.beginDisplayAuthorization({
      delivery_id: DELIVERY_ID,
      notice_id: '42',
    });

    expect(pluginCalls.initialize).toHaveBeenCalledWith({
      coordinator_contract: NATIVE_NOTIFICATION_COORDINATOR_CONTRACT,
      release_manifest: releaseManifest,
    });
    expect(pluginCalls.bindSession).toHaveBeenCalledWith({
      session_id: SESSION_ID,
      auth_version: 'auth-version',
      binding_generation: BINDING_GENERATION,
      token_generation: TOKEN_GENERATION,
      authorization_bearer: 'Bearer access-token',
    });
    expect(operation).toEqual({ operationId: DISPLAY_OPERATION_ID });

    await expect(adapter.scheduleAuthorizedNotification(operation!.operationId)).resolves.toBe(true);
    expect(pluginCalls.scheduleAuthorizedNotification).toHaveBeenCalledWith({
      operation_id: DISPLAY_OPERATION_ID,
    });

    await expect(adapter.abortDisplayAuthorization(DISPLAY_OPERATION_ID, 'transport_failed')).resolves.toBeUndefined();
    expect(pluginCalls.abortDisplayAuthorization).toHaveBeenCalledWith({
      operation_id: DISPLAY_OPERATION_ID,
      reason: 'transport_failed',
    });
  });
  it('replaces the full bearer on every bind without reusing or appending the prior value', async () => {
    const { plugin, pluginCalls } = createPluginFixture();
    const adapter = createNativeNotificationCoordinatorAdapter(plugin);
    const priorBearer = 'Bearer prior.access.token';
    const rotatedBearer = 'Bearer rotated.access.token';

    await expect(adapter.bindSession({
      sessionId: SESSION_ID,
      authVersion: 'auth-version-1',
      bindingGeneration: 1,
      tokenGeneration: 1,
      authorizationBearer: priorBearer,
    })).resolves.toBe(true);
    await expect(adapter.bindSession({
      sessionId: SESSION_ID,
      authVersion: 'auth-version-2',
      bindingGeneration: 2,
      tokenGeneration: 2,
      authorizationBearer: rotatedBearer,
    })).resolves.toBe(true);

    expect(pluginCalls.bindSession).toHaveBeenNthCalledWith(1, expect.objectContaining({
      authorization_bearer: priorBearer,
    }));
    expect(pluginCalls.bindSession).toHaveBeenNthCalledWith(2, expect.objectContaining({
      authorization_bearer: rotatedBearer,
    }));
    expect(pluginCalls.bindSession.mock.calls.map(
      ([options]) => options.authorization_bearer,
    )).toEqual([priorBearer, rotatedBearer]);
  });

  it('passes only the opaque operation ID to native tap authorization completion', async () => {
    const { plugin, pluginCalls } = createPluginFixture();
    const adapter = createNativeNotificationCoordinatorAdapter(plugin);
    const tap = {
      delivery_id: DELIVERY_ID,
      notice_id: '42',
      displayEpoch: UINT64_MAX as never,
    };

    const operation = await adapter.beginTapAuthorization(tap);

    expect(pluginCalls.beginTapAuthorization).toHaveBeenCalledWith({
      delivery_id: DELIVERY_ID,
      notice_id: '42',
      display_epoch: UINT64_MAX,
    });
    expect(operation).toEqual({ operationId: TAP_OPERATION_ID });

    await expect(adapter.completeTapAuthorization(operation!.operationId)).resolves.toBe(true);
    expect(pluginCalls.completeTapAuthorization).toHaveBeenCalledWith({
      operation_id: TAP_OPERATION_ID,
    });

    await expect(adapter.abortTapAuthorization(TAP_OPERATION_ID, 'invalid_authorization')).resolves.toBeUndefined();
    expect(pluginCalls.abortTapAuthorization).toHaveBeenCalledWith({
      operation_id: TAP_OPERATION_ID,
      reason: 'invalid_authorization',
    });
  });
  it('fails closed when native rejects stale display or unknown tap operation IDs', async () => {
    const { plugin, pluginCalls } = createPluginFixture();
    const adapter = createNativeNotificationCoordinatorAdapter(plugin);
    const staleDisplayOperationId = '66666666-6666-4666-8666-666666666666';
    const unknownTapOperationId = '77777777-7777-4777-8777-777777777777';

    pluginCalls.scheduleAuthorizedNotification.mockResolvedValueOnce({ success: false });
    await expect(adapter.scheduleAuthorizedNotification(staleDisplayOperationId)).rejects.toThrow(
      'not acknowledged',
    );
    expect(pluginCalls.scheduleAuthorizedNotification).toHaveBeenCalledWith({
      operation_id: staleDisplayOperationId,
    });

    pluginCalls.completeTapAuthorization.mockResolvedValueOnce({ success: false });
    await expect(adapter.completeTapAuthorization(unknownTapOperationId)).rejects.toThrow(
      'not acknowledged',
    );
    expect(pluginCalls.completeTapAuthorization).toHaveBeenCalledWith({
      operation_id: unknownTapOperationId,
    });
  });
  it('requires exact success acknowledgements and rejects truthy bridge values', async () => {
    const { plugin, pluginCalls } = createPluginFixture();
    const adapter = createNativeNotificationCoordinatorAdapter(plugin);

    pluginCalls.initialize.mockResolvedValueOnce({ success: 'true' } as never);
    await expect(adapter.initialize(releaseManifest)).rejects.toThrow('not acknowledged');

    pluginCalls.bindSession.mockResolvedValueOnce({ success: 1 } as never);
    await expect(adapter.bindSession({
      sessionId: SESSION_ID,
      authVersion: 'auth-version',
      bindingGeneration: BINDING_GENERATION,
      tokenGeneration: TOKEN_GENERATION,
      authorizationBearer: 'Bearer access-token',
    })).rejects.toThrow('not acknowledged');

    const truthyReceipt = {
      success: 'true',
      display_epoch: UINT64_MAX,
      zero_counts: zeroCounts,
    } as never;
    pluginCalls.beginAccountMutation.mockResolvedValueOnce(truthyReceipt);
    await expect(adapter.beginAccountMutation('logout')).rejects.toThrow('malformed');
    expect(hasZeroNotificationCounts(truthyReceipt)).toBe(false);
  });
  it('treats exact explicit native authorization denials as normal drops', async () => {
    const { plugin, pluginCalls } = createPluginFixture();
    const adapter = createNativeNotificationCoordinatorAdapter(plugin);

    pluginCalls.beginDisplayAuthorization.mockResolvedValueOnce({ admitted: false });
    pluginCalls.beginTapAuthorization.mockResolvedValueOnce({ admitted: false });

    await expect(adapter.beginDisplayAuthorization({
      delivery_id: DELIVERY_ID,
      notice_id: '42',
    })).resolves.toBeNull();
    await expect(adapter.beginTapAuthorization({
      delivery_id: DELIVERY_ID,
      notice_id: '42',
      displayEpoch: UINT64_MAX,
    })).resolves.toBeNull();

    expect(pluginCalls.abortDisplayAuthorization).not.toHaveBeenCalled();
    expect(pluginCalls.abortTapAuthorization).not.toHaveBeenCalled();
  });
  it('rejects missing and wrong-typed native authorization replies as protocol failures', async () => {
    const { plugin, pluginCalls } = createPluginFixture();
    const adapter = createNativeNotificationCoordinatorAdapter(plugin);

    for (const malformedResult of [
      undefined,
      null,
      {},
      { admitted: 'false' },
      { admitted: true },
      { admitted: true, operation_id: 1 },
    ]) {
      pluginCalls.beginDisplayAuthorization.mockResolvedValueOnce(malformedResult as never);
      await expect(adapter.beginDisplayAuthorization({
        delivery_id: DELIVERY_ID,
        notice_id: '42',
      })).rejects.toThrow(NATIVE_NOTIFICATION_COORDINATOR_PROTOCOL_ERROR);
    }

    pluginCalls.beginTapAuthorization.mockResolvedValueOnce({
      admitted: 1,
      operation_id: TAP_OPERATION_ID,
    } as never);
    await expect(adapter.beginTapAuthorization({
      delivery_id: DELIVERY_ID,
      notice_id: '42',
      displayEpoch: UINT64_MAX,
    })).rejects.toThrow(NATIVE_NOTIFICATION_COORDINATOR_PROTOCOL_ERROR);

    expect(pluginCalls.abortDisplayAuthorization).not.toHaveBeenCalled();
    expect(pluginCalls.abortTapAuthorization).toHaveBeenCalledWith({
      operation_id: TAP_OPERATION_ID,
      reason: 'invalid_authorization',
    });
  });
  it('aborts recoverable malformed authorization operations without masking protocol failure', async () => {
    const { plugin, pluginCalls } = createPluginFixture();
    const adapter = createNativeNotificationCoordinatorAdapter(plugin);

    pluginCalls.beginDisplayAuthorization.mockResolvedValueOnce({
      admitted: true,
      operation_id: DISPLAY_OPERATION_ID,
      extra: true,
    } as never);
    await expect(adapter.beginDisplayAuthorization({
      delivery_id: DELIVERY_ID,
      notice_id: '42',
    })).rejects.toThrow(NATIVE_NOTIFICATION_COORDINATOR_PROTOCOL_ERROR);
    expect(pluginCalls.abortDisplayAuthorization).toHaveBeenCalledWith({
      operation_id: DISPLAY_OPERATION_ID,
      reason: 'invalid_authorization',
    });

    pluginCalls.beginTapAuthorization.mockResolvedValueOnce({
      admitted: false,
      operation_id: TAP_OPERATION_ID,
    } as never);
    pluginCalls.abortTapAuthorization.mockRejectedValueOnce(new Error('abort send failed'));
    await expect(adapter.beginTapAuthorization({
      delivery_id: DELIVERY_ID,
      notice_id: '42',
      displayEpoch: UINT64_MAX,
    })).rejects.toThrow(NATIVE_NOTIFICATION_COORDINATOR_PROTOCOL_ERROR);
    expect(pluginCalls.abortTapAuthorization).toHaveBeenCalledWith({
      operation_id: TAP_OPERATION_ID,
      reason: 'invalid_authorization',
    });
  });
  it('propagates thrown native authorization sends for bounded runtime recovery', async () => {
    const { plugin, pluginCalls } = createPluginFixture();
    const adapter = createNativeNotificationCoordinatorAdapter(plugin);

    pluginCalls.beginDisplayAuthorization.mockRejectedValueOnce(new Error('bridge send failed'));
    await expect(adapter.beginDisplayAuthorization({
      delivery_id: DELIVERY_ID,
      notice_id: '42',
    })).rejects.toThrow('bridge send failed');

    expect(pluginCalls.abortDisplayAuthorization).not.toHaveBeenCalled();
  });

  it('normalizes legacy plugin prompt permissions to not_determined', async () => {
    const { plugin, pluginCalls } = createPluginFixture();
    const adapter = createNativeNotificationCoordinatorAdapter(plugin);

    pluginCalls.getDisplayPermission.mockResolvedValueOnce({ permission: 'prompt' });
    pluginCalls.requestDisplayPermission.mockResolvedValueOnce({ permission: 'prompt' });

    await expect(adapter.getDisplayPermission()).resolves.toBe('not_determined');
    await expect(adapter.requestDisplayPermission()).resolves.toBe('not_determined');
  });

  it('enforces positive JS-safe bound-session generations before native display authority can open', async () => {
    const { plugin, pluginCalls } = createPluginFixture();
    const adapter = createNativeNotificationCoordinatorAdapter(plugin);
    const maxSafeGeneration = Number.MAX_SAFE_INTEGER;
    const unsafeGeneration = maxSafeGeneration + 1;

    await expect(adapter.bindSession({
      sessionId: SESSION_ID,
      authVersion: 'auth-version',
      bindingGeneration: maxSafeGeneration,
      tokenGeneration: maxSafeGeneration,
      authorizationBearer: 'Bearer access-token',
    })).resolves.toBe(true);
    await expect(adapter.updateSessionGenerations({
      sessionId: SESSION_ID,
      bindingGeneration: maxSafeGeneration,
      tokenGeneration: maxSafeGeneration,
    })).resolves.toBe(true);
    await expect(adapter.bindSession({
      sessionId: SESSION_ID,
      authVersion: 'auth-version',
      bindingGeneration: 1,
      tokenGeneration: 1,
      authorizationBearer: 'Bearer access-token',
    })).resolves.toBe(true);
    await expect(adapter.updateSessionGenerations({
      sessionId: SESSION_ID,
      bindingGeneration: 1,
      tokenGeneration: 1,
    })).resolves.toBe(true);

    expect(pluginCalls.bindSession).toHaveBeenNthCalledWith(1, expect.objectContaining({
      binding_generation: maxSafeGeneration,
      token_generation: maxSafeGeneration,
    }));
    expect(pluginCalls.updateSessionGenerations).toHaveBeenNthCalledWith(1, {
      session_id: SESSION_ID,
      binding_generation: maxSafeGeneration,
      token_generation: maxSafeGeneration,
    });
    expect(pluginCalls.bindSession).toHaveBeenNthCalledWith(2, expect.objectContaining({
      binding_generation: 1,
      token_generation: 1,
    }));
    expect(pluginCalls.updateSessionGenerations).toHaveBeenNthCalledWith(2, {
      session_id: SESSION_ID,
      binding_generation: 1,
      token_generation: 1,
    });

    for (const bindingGeneration of [0, -1, 1.5, unsafeGeneration]) {
      await expect(adapter.bindSession({
        sessionId: SESSION_ID,
        authVersion: 'auth-version',
        bindingGeneration,
        tokenGeneration: 1,
        authorizationBearer: 'Bearer access-token',
      })).rejects.toThrow('malformed');
      await expect(adapter.updateSessionGenerations({
        sessionId: SESSION_ID,
        bindingGeneration,
        tokenGeneration: 1,
      })).rejects.toThrow('malformed');
    }
    for (const tokenGeneration of [0, -1, 1.5, unsafeGeneration]) {
      await expect(adapter.bindSession({
        sessionId: SESSION_ID,
        authVersion: 'auth-version',
        bindingGeneration: 1,
        tokenGeneration,
        authorizationBearer: 'Bearer access-token',
      })).rejects.toThrow('malformed');
      await expect(adapter.updateSessionGenerations({
        sessionId: SESSION_ID,
        bindingGeneration: 1,
        tokenGeneration,
      })).rejects.toThrow('malformed');
    }

    expect(pluginCalls.bindSession).toHaveBeenCalledTimes(2);
    expect(pluginCalls.updateSessionGenerations).toHaveBeenCalledTimes(2);
  });

  it('accepts only canonical uint64 decimal display epochs from native notification taps', async () => {
    const { plugin, listeners, listenerHandle } = createPluginFixture();
    const adapter = createNativeNotificationCoordinatorAdapter(plugin);
    const received: unknown[] = [];
    const epochCases = [
      { value: '0', accepted: true },
      { value: UINT64_MAX, accepted: true },
      { value: 1, accepted: false },
      { value: '+1', accepted: false },
      { value: '-1', accepted: false },
      { value: '1.0', accepted: false },
      { value: ' 1 ', accepted: false },
      { value: '', accepted: false },
      { value: 'epoch', accepted: false },
      { value: '01', accepted: false },
      { value: '18446744073709551616', accepted: false },
    ] as const;

    await expect(adapter.addNotificationTapListener((payload) => received.push(payload))).resolves.toBe(listenerHandle);

    for (const { value, accepted } of epochCases) {
      const receivedCount = received.length;
      listeners.get('notificationTap')?.({
        delivery_id: DELIVERY_ID,
        notice_id: '42',
        display_epoch: value,
      } as never);
      expect(received).toHaveLength(receivedCount + (accepted ? 1 : 0));
    }

    expect(received).toEqual([
      {
        delivery_id: DELIVERY_ID,
        notice_id: '42',
        displayEpoch: '0',
      },
      {
        delivery_id: DELIVERY_ID,
        notice_id: '42',
        displayEpoch: UINT64_MAX,
      },
    ]);
  });
  it('accepts only exact own-key native event envelopes', async () => {
    const { plugin, listeners } = createPluginFixture();
    const adapter = createNativeNotificationCoordinatorAdapter(plugin);
    const pushes: unknown[] = [];
    const taps: unknown[] = [];
    const tokens: unknown[] = [];

    await adapter.addDataOnlyPushListener((payload) => pushes.push(payload));
    await adapter.addNotificationTapListener((payload) => taps.push(payload));
    await adapter.addFcmTokenListener((payload) => tokens.push(payload));

    const inheritedPush = Object.create({
      delivery_id: DELIVERY_ID,
      notice_id: '42',
    });
    const pushWithInheritedExtra = Object.assign(Object.create({ extra: true }), {
      delivery_id: DELIVERY_ID,
      notice_id: '42',
    });
    const inheritedTap = Object.create({
      delivery_id: DELIVERY_ID,
      notice_id: '42',
      display_epoch: UINT64_MAX,
    });
    const inheritedToken = Object.create({ token: 'fcm-token' });

    for (const value of [
      null,
      [],
      inheritedPush,
      pushWithInheritedExtra,
      { delivery_id: DELIVERY_ID, notice_id: '42', extra: true },
    ]) {
      listeners.get('dataOnlyPush')?.(value as never);
    }
    for (const value of [
      null,
      [],
      inheritedTap,
      {
        delivery_id: DELIVERY_ID,
        notice_id: '42',
        display_epoch: UINT64_MAX,
        extra: true,
      },
    ]) {
      listeners.get('notificationTap')?.(value as never);
    }
    for (const value of [
      null,
      [],
      inheritedToken,
      { token: 'fcm-token', extra: true },
    ]) {
      listeners.get('fcmToken')?.(value as never);
    }

    expect(pushes).toEqual([]);
    expect(taps).toEqual([]);
    expect(tokens).toEqual([]);

    listeners.get('dataOnlyPush')?.({
      delivery_id: DELIVERY_ID,
      notice_id: '42',
    } as never);
    listeners.get('notificationTap')?.({
      delivery_id: DELIVERY_ID,
      notice_id: '42',
      display_epoch: UINT64_MAX,
    } as never);
    listeners.get('fcmToken')?.({ token: 'fcm-token' } as never);

    expect(pushes).toEqual([{ delivery_id: DELIVERY_ID, notice_id: '42' }]);
    expect(taps).toEqual([{
      delivery_id: DELIVERY_ID,
      notice_id: '42',
      displayEpoch: UINT64_MAX,
    }]);
    expect(tokens).toEqual([{ token: 'fcm-token' }]);
  });

  it('reads only exact available active native account mutation lineages and carries their phase', async () => {
    const { plugin, pluginCalls } = createPluginFixture();
    const activeLineages = [
      { reason: 'logout', phase: 'awaiting_finalize' },
      { reason: 'account_switch', phase: 'completed' },
      { reason: 'deletion', phase: 'awaiting_finalize' },
    ] as const;

    for (const { reason, phase } of activeLineages) {
      const adapter = createNativeNotificationCoordinatorAdapter(plugin);
      const lineage = {
        available: true,
        active: true,
        phase,
        reason,
        display_epoch: UINT64_MAX,
        zero_counts: zeroCounts,
      };
      pluginCalls.getAccountMutationLineage.mockResolvedValueOnce(lineage);

      await expect(adapter.getAccountMutationLineage()).resolves.toEqual({
        phase,
        reason,
        display_epoch: UINT64_MAX,
        zero_counts: zeroCounts,
      });
    }

    expect(pluginCalls.beginAccountMutation).not.toHaveBeenCalled();
    expect(pluginCalls.getAccountMutationLineage).toHaveBeenCalledTimes(3);
    expect(pluginCalls.getAccountMutationLineage.mock.calls).toEqual([[], [], []]);
  });
  it('retires completed and rebound lineage cache before the next mutation', async () => {
    const { plugin, pluginCalls } = createPluginFixture();
    const adapter = createNativeNotificationCoordinatorAdapter(plugin);
    pluginCalls.getAccountMutationLineage
      .mockResolvedValueOnce({
        available: true,
        active: true,
        phase: 'completed',
        reason: 'logout',
        display_epoch: UINT64_MAX,
        zero_counts: zeroCounts,
      })
      .mockResolvedValueOnce({
        available: true,
        active: true,
        phase: 'awaiting_finalize',
        reason: 'account_switch',
        display_epoch: UINT64_MAX,
        zero_counts: zeroCounts,
      });

    await expect(adapter.getAccountMutationLineage()).resolves.toMatchObject({
      phase: 'completed',
      reason: 'logout',
    });
    await expect(adapter.beginAccountMutation('logout')).resolves.toMatchObject({
      display_epoch: UINT64_MAX,
    });
    await expect(adapter.finalizeAccountMutation('logout', UINT64_MAX)).resolves.toMatchObject({
      display_epoch: UINT64_MAX,
    });

    await expect(adapter.getAccountMutationLineage()).resolves.toMatchObject({
      phase: 'awaiting_finalize',
      reason: 'account_switch',
    });
    await expect(adapter.bindSession({
      sessionId: SESSION_ID,
      authVersion: 'auth-version',
      bindingGeneration: BINDING_GENERATION,
      tokenGeneration: TOKEN_GENERATION,
      authorizationBearer: 'Bearer rebound-access-token',
    })).resolves.toBe(true);
    await expect(adapter.beginAccountMutation('account_switch')).resolves.toMatchObject({
      display_epoch: UINT64_MAX,
    });

    expect(pluginCalls.bindSession).toHaveBeenCalledOnce();
    expect(pluginCalls.beginAccountMutation).toHaveBeenCalledTimes(2);
  });

  it('fails closed when native account mutation lineage availability is unavailable', async () => {
    const { plugin, pluginCalls } = createPluginFixture();
    const adapter = createNativeNotificationCoordinatorAdapter(plugin);

    pluginCalls.getAccountMutationLineage.mockResolvedValueOnce({
      available: false,
      active: false,
      phase: null,
      reason: null,
      display_epoch: UINT64_MAX,
      zero_counts: zeroCounts,
    });

    await expect(adapter.getAccountMutationLineage()).rejects.toThrow(
      'Native account mutation lineage was unavailable.',
    );
    expect(pluginCalls.beginAccountMutation).not.toHaveBeenCalled();
  });

  it('rejects malformed native account mutation lineage envelopes without treating them as absent', async () => {
    const { plugin, pluginCalls } = createPluginFixture();
    const adapter = createNativeNotificationCoordinatorAdapter(plugin);
    const activeLineage = {
      available: true,
      active: true,
      phase: 'awaiting_finalize',
      reason: 'logout',
      display_epoch: UINT64_MAX,
      zero_counts: zeroCounts,
    };
    const unavailableLineage = {
      available: false,
      active: false,
      phase: null,
      reason: null,
      display_epoch: UINT64_MAX,
      zero_counts: zeroCounts,
    };
    const unsafeCountLineages = [
      'pending_count',
      'delivered_count',
      'foreground_banner_count',
      'registry_count',
      'inflight_count',
    ].map((count) => ({
      ...activeLineage,
      zero_counts: {
        ...zeroCounts,
        [count]: Number.MAX_SAFE_INTEGER + 1,
      },
    }));
    const malformedLineages = [
      null,
      {},
      { ...activeLineage, available: 'true' },
      { ...unavailableLineage, active: true },
      { ...unavailableLineage, phase: 'awaiting_finalize' },
      { ...unavailableLineage, reason: 'logout' },
      { ...activeLineage, active: false, phase: 'completed', reason: null },
      { ...activeLineage, active: false, phase: null, reason: 'logout' },
      { ...activeLineage, phase: null },
      { ...activeLineage, reason: null },
      { ...activeLineage, phase: 'unknown_phase' },
      { ...activeLineage, reason: 'unknown_reason' },
      { ...activeLineage, display_epoch: '01' },
      { ...activeLineage, display_epoch: '18446744073709551616' },
      { ...activeLineage, zero_counts: { ...zeroCounts, inflight_count: -1 } },
      { ...unavailableLineage, zero_counts: { ...zeroCounts, pending_count: Number.MAX_SAFE_INTEGER + 1 } },
      ...unsafeCountLineages,
      { ...activeLineage, extra: true },
    ];

    for (const lineage of malformedLineages) {
      pluginCalls.getAccountMutationLineage.mockResolvedValueOnce(lineage as never);
      await expect(adapter.getAccountMutationLineage()).rejects.toThrow(
        'Native account mutation lineage was malformed.',
      );
    }

    expect(pluginCalls.beginAccountMutation).not.toHaveBeenCalled();
  });

  it('retains exact in-memory mutation identity across cleared and conflicting queried lineages', async () => {
    const { plugin, pluginCalls } = createPluginFixture();
    const adapter = createNativeNotificationCoordinatorAdapter(plugin);

    await adapter.beginAccountMutation('deletion');
    pluginCalls.getAccountMutationLineage.mockResolvedValueOnce({
      available: true,
      active: false,
      phase: null,
      reason: null,
      display_epoch: UINT64_MAX,
      zero_counts: zeroCounts,
    });
    await expect(adapter.getAccountMutationLineage()).rejects.toThrow(
      'Native account mutation lineage was unexpectedly cleared.',
    );
    pluginCalls.getAccountMutationLineage.mockResolvedValueOnce({
      available: true,
      active: true,
      phase: 'awaiting_finalize',
      reason: 'account_switch',
      display_epoch: UINT64_MAX,
      zero_counts: zeroCounts,
    });

    await expect(adapter.getAccountMutationLineage()).rejects.toThrow(
      'Native account mutation lineage did not match begin.',
    );
    expect(pluginCalls.finalizeAccountMutation).not.toHaveBeenCalled();

    pluginCalls.getAccountMutationLineage.mockResolvedValueOnce({
      available: true,
      active: true,
      phase: 'completed',
      reason: 'deletion',
      display_epoch: UINT64_MAX,
      zero_counts: zeroCounts,
    });
    await expect(adapter.getAccountMutationLineage()).resolves.toEqual({
      phase: 'completed',
      reason: 'deletion',
      display_epoch: UINT64_MAX,
      zero_counts: zeroCounts,
    });
    await expect(adapter.finalizeAccountMutation('deletion', UINT64_MAX)).resolves.toEqual({
      success: true,
      display_epoch: UINT64_MAX,
      zero_counts: zeroCounts,
    });
  });

  it('returns null only for an exact available inactive native account mutation lineage', async () => {
    const { plugin, pluginCalls } = createPluginFixture();
    const adapter = createNativeNotificationCoordinatorAdapter(plugin);

    await expect(adapter.getAccountMutationLineage()).resolves.toBeNull();
    expect(pluginCalls.beginAccountMutation).not.toHaveBeenCalled();
  });

  it('enforces same-process mutation reason and caller-owned epoch continuity', async () => {
    const { plugin, pluginCalls } = createPluginFixture();
    const adapter = createNativeNotificationCoordinatorAdapter(plugin);

    const begin = adapter.beginAccountMutation('deletion');
    const overlappingBegin = adapter.beginAccountMutation('logout');
    const beginReceipt = await begin;
    expect(pluginCalls.beginAccountMutation).toHaveBeenCalledWith({ reason: 'deletion' });
    expect(beginReceipt).toEqual({
      success: true,
      display_epoch: UINT64_MAX,
      zero_counts: zeroCounts,
    });

    await expect(overlappingBegin).rejects.toThrow('already active');
    expect(pluginCalls.beginAccountMutation).toHaveBeenCalledTimes(1);

    await expect(adapter.finalizeAccountMutation('logout', UINT64_MAX)).rejects.toThrow(
      'did not match begin',
    );
    await expect(adapter.finalizeAccountMutation('deletion', '0')).rejects.toThrow(
      'did not match begin',
    );
    await expect(adapter.finalizeAccountMutation('deletion', '00')).rejects.toThrow('malformed');
    expect(pluginCalls.finalizeAccountMutation).not.toHaveBeenCalled();

    pluginCalls.finalizeAccountMutation.mockResolvedValueOnce({
      success: true,
      display_epoch: '0',
      zero_counts: zeroCounts,
    });
    await expect(
      adapter.finalizeAccountMutation('deletion', UINT64_MAX),
    ).rejects.toThrow('active zero state');
    expect(pluginCalls.finalizeAccountMutation).toHaveBeenLastCalledWith({
      reason: 'deletion',
      display_epoch: UINT64_MAX,
    });

    pluginCalls.finalizeAccountMutation.mockResolvedValueOnce({
      success: true,
      display_epoch: UINT64_MAX,
      zero_counts: { ...zeroCounts, inflight_count: 1 },
    });
    await expect(
      adapter.finalizeAccountMutation('deletion', UINT64_MAX),
    ).rejects.toThrow('active zero state');
    expect(pluginCalls.finalizeAccountMutation).toHaveBeenLastCalledWith({
      reason: 'deletion',
      display_epoch: UINT64_MAX,
    });
    expect(pluginCalls.beginAccountMutation).toHaveBeenCalledTimes(1);

    const finalizeReceipt = await adapter.finalizeAccountMutation('deletion', UINT64_MAX);
    expect(pluginCalls.finalizeAccountMutation).toHaveBeenLastCalledWith({
      reason: 'deletion',
      display_epoch: UINT64_MAX,
    });
    expect(finalizeReceipt).toEqual(beginReceipt);
    expect(hasZeroNotificationCounts(finalizeReceipt)).toBe(true);

    pluginCalls.beginAccountMutation.mockResolvedValueOnce({
      success: true,
      display_epoch: '2',
      zero_counts: zeroCounts,
    });
    await adapter.beginAccountMutation('deletion');
    await expect(adapter.finalizeAccountMutation('deletion', UINT64_MAX)).rejects.toThrow(
      'did not match begin',
    );

    pluginCalls.finalizeAccountMutation.mockResolvedValueOnce({
      success: true,
      display_epoch: '2',
      zero_counts: zeroCounts,
    });
    await expect(adapter.finalizeAccountMutation('deletion', '2')).resolves.toEqual({
      success: true,
      display_epoch: '2',
      zero_counts: zeroCounts,
    });
  });

  it('finalizes an existing durable receipt only with an explicit caller epoch', async () => {
    const { plugin, pluginCalls } = createPluginFixture();
    const adapter = createNativeNotificationCoordinatorAdapter(plugin);
    const durableReceipt = {
      success: true,
      display_epoch: UINT64_MAX,
      zero_counts: zeroCounts,
    };

    await expect(
      adapter.finalizeAccountMutation('account_switch', UINT64_MAX),
    ).resolves.toEqual(durableReceipt);
    expect(pluginCalls.beginAccountMutation).not.toHaveBeenCalled();
    expect(pluginCalls.finalizeAccountMutation).toHaveBeenNthCalledWith(1, {
      reason: 'account_switch',
      display_epoch: UINT64_MAX,
    });

    await expect(
      adapter.finalizeAccountMutation('account_switch', UINT64_MAX),
    ).resolves.toEqual(durableReceipt);
    expect(pluginCalls.beginAccountMutation).not.toHaveBeenCalled();
    expect(pluginCalls.finalizeAccountMutation).toHaveBeenNthCalledWith(2, {
      reason: 'account_switch',
      display_epoch: UINT64_MAX,
    });
  });
});
