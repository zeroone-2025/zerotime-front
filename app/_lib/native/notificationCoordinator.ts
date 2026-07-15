import { registerPlugin } from '@capacitor/core';

import type {
  MobileReleaseBuildManifest,
  PushPermissionStatus,
} from './mobileRelease';

/**
 * Shared iOS/Android plugin protocol. Native owns installation identity,
 * authenticated display and tap authorization, epochs, in-flight operations,
 * notification scheduling, registry, and purge enumeration.
 */
export const NATIVE_NOTIFICATION_COORDINATOR_CONTRACT = 'native-notification-coordinator.v1';
export const NATIVE_NOTIFICATION_COORDINATOR_PROTOCOL_ERROR =
  'Native notification coordinator protocol error.';

export type AccountMutationReason = 'logout' | 'account_switch' | 'deletion';
export type NativeOperationAbortReason =
  | 'denied'
  | 'invalid_authorization'
  | 'expired_authorization'
  | 'transport_failed'
  | 'native_failed'
  | 'stale_operation';
type NativePluginPermission = PushPermissionStatus | 'prompt';

export interface DataOnlyPushPayload {
  readonly delivery_id: string;
  readonly notice_id: string;
}

export interface NativeNotificationPluginListenerHandle {
  remove(): Promise<void>;
}

export interface NativeZeroCounts {
  readonly pending_count: number;
  readonly delivered_count: number;
  readonly foreground_banner_count: number;
  readonly registry_count: number;
  readonly inflight_count: number;
}

export interface NativeMutationReceipt {
  readonly success: boolean;
  readonly display_epoch: string;
  readonly zero_counts: NativeZeroCounts;
}
export type AccountMutationPhase = 'awaiting_finalize' | 'completed';

export interface NativeAccountMutationLineage {
  readonly phase: AccountMutationPhase;
  readonly reason: AccountMutationReason;
  readonly display_epoch: string;
  readonly zero_counts: NativeZeroCounts;
}

interface ActiveAccountMutation {
  readonly reason: AccountMutationReason;
  readonly displayEpoch: string;
}
interface NativeOperationResult {
  readonly success: boolean;
  readonly display_epoch?: string;
}

type NativeAuthorizationBeginResult =
  | {
      readonly admitted: true;
      readonly operation_id: string;
    }
  | {
      readonly admitted: false;
    };

interface NativeInstallationIdentityResult {
  readonly installation_id: string;
}

export interface NativeNotificationCoordinatorPlugin {
  getOrCreateInstallationId(): Promise<NativeInstallationIdentityResult>;
  /**
   * Native validates its embedded manifest and cross-checks this Capacitor
   * manifest's platform, plane, API origin, and contract before admitting work.
   */
  initialize(options: {
    readonly coordinator_contract: typeof NATIVE_NOTIFICATION_COORDINATOR_CONTRACT;
    readonly release_manifest: MobileReleaseBuildManifest;
  }): Promise<NativeOperationResult>;
  bindSession(options: {
    readonly session_id: string;
    readonly auth_version: string;
    readonly binding_generation: number;
    readonly token_generation: number;
    readonly authorization_bearer: string;
  }): Promise<NativeOperationResult>;
  /**
   * Serialized native transition: close admission, persist both generations,
   * then reopen only for the updated bound session.
   */
  updateSessionGenerations(options: {
    readonly session_id: string;
    readonly binding_generation: number;
    readonly token_generation: number;
  }): Promise<NativeOperationResult>;
  beginDisplayAuthorization(options: DataOnlyPushPayload): Promise<NativeAuthorizationBeginResult>;
  scheduleAuthorizedNotification(options: {
    readonly operation_id: string;
  }): Promise<NativeOperationResult>;
  abortDisplayAuthorization(options: {
    readonly operation_id: string;
    readonly reason: NativeOperationAbortReason;
  }): Promise<NativeOperationResult>;
  beginTapAuthorization(options: {
    readonly delivery_id: string;
    readonly notice_id: string;
    readonly display_epoch: string;
  }): Promise<NativeAuthorizationBeginResult>;
  completeTapAuthorization(options: {
    readonly operation_id: string;
  }): Promise<NativeOperationResult>;
  abortTapAuthorization(options: {
    readonly operation_id: string;
    readonly reason: NativeOperationAbortReason;
  }): Promise<NativeOperationResult>;
  beginAccountMutation(options: { readonly reason: AccountMutationReason }): Promise<NativeMutationReceipt>;
  finalizeAccountMutation(options: {
    readonly reason: AccountMutationReason;
    readonly display_epoch: string;
  }): Promise<NativeMutationReceipt>;
  getAccountMutationLineage(): Promise<{
    readonly available: boolean;
    readonly active: boolean;
    readonly phase: AccountMutationPhase | null;
    readonly reason: AccountMutationReason | null;
    readonly display_epoch: string;
    readonly zero_counts: NativeZeroCounts;
  }>;
  getDisplayPermission(): Promise<{ readonly permission: NativePluginPermission }>;
  requestDisplayPermission(): Promise<{ readonly permission: NativePluginPermission }>;
  openNotificationSettings(): Promise<NativeOperationResult>;
  isSecureCredentialStorageAvailable(): Promise<{ readonly available: boolean }>;
  getSecureCredential(options: { readonly key: string }): Promise<{ readonly value: string | null }>;
  setSecureCredential(options: { readonly key: string; readonly value: string }): Promise<NativeOperationResult>;
  deleteSecureCredential(options: { readonly key: string }): Promise<NativeOperationResult>;
  addListener(
    event: 'dataOnlyPush',
    listener: (data: Readonly<Record<string, unknown>>) => void,
  ): Promise<NativeNotificationPluginListenerHandle>;
  addListener(
    event: 'notificationTap',
    listener: (data: {
      readonly delivery_id: string;
      readonly notice_id: string;
      readonly display_epoch: string;
    }) => void,
  ): Promise<NativeNotificationPluginListenerHandle>;
  addListener(
    event: 'fcmToken',
    listener: (data: { readonly token: string }) => void,
  ): Promise<NativeNotificationPluginListenerHandle>;
}

export const nativeNotificationCoordinatorPlugin =
  registerPlugin<NativeNotificationCoordinatorPlugin>('NativeNotificationCoordinator');

export interface NativeAuthorizationOperation {
  readonly operationId: string;
}

export interface NativeNotificationCoordinatorAdapter {
  getOrCreateInstallationId(): Promise<string>;
  initialize(manifest: MobileReleaseBuildManifest): Promise<boolean>;
  bindSession(binding: NotificationSessionBinding): Promise<boolean>;
  updateSessionGenerations(options: {
    readonly sessionId: string;
    readonly bindingGeneration: number;
    readonly tokenGeneration: number;
  }): Promise<boolean>;
  beginDisplayAuthorization(data: DataOnlyPushPayload): Promise<NativeAuthorizationOperation | null>;
  scheduleAuthorizedNotification(operationId: string): Promise<boolean>;
  abortDisplayAuthorization(operationId: string, reason: NativeOperationAbortReason): Promise<void>;
  beginTapAuthorization(data: NotificationTapPayload): Promise<NativeAuthorizationOperation | null>;
  completeTapAuthorization(operationId: string): Promise<boolean>;
  abortTapAuthorization(operationId: string, reason: NativeOperationAbortReason): Promise<void>;
  beginAccountMutation(reason: AccountMutationReason): Promise<NativeMutationReceipt>;
  finalizeAccountMutation(
    reason: AccountMutationReason,
    displayEpoch: string,
  ): Promise<NativeMutationReceipt>;
  getAccountMutationLineage(): Promise<NativeAccountMutationLineage | null>;
  getDisplayPermission(): Promise<PushPermissionStatus>;
  requestDisplayPermission(): Promise<PushPermissionStatus>;
  openNotificationSettings(): Promise<void>;
  addDataOnlyPushListener(
    listener: (data: DataOnlyPushPayload) => void,
  ): Promise<NativeNotificationPluginListenerHandle>;
  addNotificationTapListener(
    listener: (data: NotificationTapPayload) => void,
  ): Promise<NativeNotificationPluginListenerHandle>;
  addFcmTokenListener(
    listener: (data: { readonly token: string }) => void,
  ): Promise<NativeNotificationPluginListenerHandle>;
}

export interface NotificationSessionBinding {
  readonly sessionId: string;
  readonly authVersion: string;
  readonly bindingGeneration: number;
  readonly tokenGeneration: number;
  /** Full `Authorization` header value; never persisted by JavaScript. */
  readonly authorizationBearer: string;
}

export interface NotificationTapPayload extends DataOnlyPushPayload {
  readonly displayEpoch: string;
}

export function createNativeNotificationCoordinatorAdapter(
  plugin: NativeNotificationCoordinatorPlugin = nativeNotificationCoordinatorPlugin,
): NativeNotificationCoordinatorAdapter {
  let activeAccountMutation: ActiveAccountMutation | null = null;
  let accountMutationLane: Promise<void> = Promise.resolve();

  const runAccountMutationTransition = <T>(
    transition: () => Promise<T>,
  ): Promise<T> => {
    const task = accountMutationLane.then(transition, transition);
    accountMutationLane = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  };

  const beginAccountMutation = async (
    reason: AccountMutationReason,
  ): Promise<NativeMutationReceipt> => {
    if (!isAccountMutationReason(reason)) {
      throw new Error('Native account mutation reason was malformed.');
    }
    if (activeAccountMutation) {
      throw new Error('Native account mutation is already active.');
    }

    const receipt = requireMutationReceipt(await plugin.beginAccountMutation({ reason }));
    if (!hasZeroNotificationCounts(receipt)) {
      throw new Error('Native account mutation begin did not acknowledge zero state.');
    }

    activeAccountMutation = {
      reason,
      displayEpoch: receipt.display_epoch,
    };
    return receipt;
  };

  const finalizeAccountMutation = async (
    reason: AccountMutationReason,
    displayEpoch: string,
  ): Promise<NativeMutationReceipt> => {
    if (!isAccountMutationReason(reason)) {
      throw new Error('Native account mutation finalization reason was malformed.');
    }
    if (!isEpoch(displayEpoch)) {
      throw new Error('Native account mutation finalization epoch was malformed.');
    }
    const activeMutation = activeAccountMutation;
    if (
      activeMutation
      && (
        activeMutation.reason !== reason
        || activeMutation.displayEpoch !== displayEpoch
      )
    ) {
      throw new Error('Native account mutation finalization did not match begin.');
    }

    const receipt = requireMutationReceipt(
      await plugin.finalizeAccountMutation({
        reason,
        display_epoch: displayEpoch,
      }),
    );
    if (
      !hasZeroNotificationCounts(receipt)
      || receipt.display_epoch !== displayEpoch
    ) {
      throw new Error('Native account mutation finalization did not acknowledge the active zero state.');
    }

    if (activeMutation) {
      activeAccountMutation = null;
    }
    return receipt;
  };
  const getAccountMutationLineage = async (): Promise<NativeAccountMutationLineage | null> => {
    const lineage = requireAccountMutationLineage(
      await plugin.getAccountMutationLineage(),
    );
    const activeMutation = activeAccountMutation;
    if (lineage === null) {
      if (activeMutation) {
        throw new Error('Native account mutation lineage was unexpectedly cleared.');
      }
      return null;
    }

    if (
      activeMutation
      && (
        activeMutation.reason !== lineage.reason
        || activeMutation.displayEpoch !== lineage.display_epoch
      )
    ) {
      throw new Error('Native account mutation lineage did not match begin.');
    }

    activeAccountMutation = lineage.phase === 'awaiting_finalize'
      ? {
          reason: lineage.reason,
          displayEpoch: lineage.display_epoch,
        }
      : null;
    return lineage;
  };


  return {
    async getOrCreateInstallationId() {
      const result = await plugin.getOrCreateInstallationId();
      if (
        !hasExactOwnKeys(result, ['installation_id'])
        || !isUuid(result.installation_id)
      ) {
        throw new Error('Native installation identity was not acknowledged.');
      }
      return result.installation_id;
    },
    async initialize(manifest) {
      return requireSuccess(
        plugin.initialize({
          coordinator_contract: NATIVE_NOTIFICATION_COORDINATOR_CONTRACT,
          release_manifest: manifest,
        }),
        'Native notification coordinator initialization was not acknowledged.',
      );
    },
    async bindSession(binding) {
      requireSessionBinding(binding);
      return runAccountMutationTransition(async () => {
        const bound = await requireSuccess(
          plugin.bindSession({
            session_id: binding.sessionId,
            auth_version: binding.authVersion,
            binding_generation: binding.bindingGeneration,
            token_generation: binding.tokenGeneration,
            authorization_bearer: binding.authorizationBearer,
          }),
          'Native notification session binding was not acknowledged.',
        );
        if (bound) {
          activeAccountMutation = null;
        }
        return bound;
      });
    },
    async updateSessionGenerations(options) {
      if (
        !isUuid(options.sessionId) ||
        !isPositiveGeneration(options.bindingGeneration) ||
        !isTokenGeneration(options.tokenGeneration)
      ) {
        throw new Error('Native notification session generations were malformed.');
      }
      return requireSuccess(
        plugin.updateSessionGenerations({
          session_id: options.sessionId,
          binding_generation: options.bindingGeneration,
          token_generation: options.tokenGeneration,
        }),
        'Native notification session generations were not acknowledged.',
      );
    },
    async beginDisplayAuthorization(data) {
      return toAuthorizationOperation(
        await plugin.beginDisplayAuthorization(data),
        (operationId) =>
          requireSuccess(
            plugin.abortDisplayAuthorization({
              operation_id: operationId,
              reason: 'invalid_authorization',
            }),
            'Native display authorization abort was not acknowledged.',
          ),
      );
    },
    async scheduleAuthorizedNotification(operationId) {
      if (!isUuid(operationId)) {
        throw new Error('Native display authorization operation was malformed.');
      }
      return requireSuccess(
        plugin.scheduleAuthorizedNotification({ operation_id: operationId }),
        'Native authorized notification scheduling was not acknowledged.',
      );
    },
    async abortDisplayAuthorization(operationId, reason) {
      await requireSuccess(
        plugin.abortDisplayAuthorization({ operation_id: operationId, reason }),
        'Native display authorization abort was not acknowledged.',
      );
    },
    async beginTapAuthorization(data) {
      return toAuthorizationOperation(
        await plugin.beginTapAuthorization({
          delivery_id: data.delivery_id,
          notice_id: data.notice_id,
          display_epoch: data.displayEpoch,
        }),
        (operationId) =>
          requireSuccess(
            plugin.abortTapAuthorization({
              operation_id: operationId,
              reason: 'invalid_authorization',
            }),
            'Native tap authorization abort was not acknowledged.',
          ),
      );
    },
    async completeTapAuthorization(operationId) {
      if (!isUuid(operationId)) {
        throw new Error('Native tap authorization operation was malformed.');
      }
      return requireSuccess(
        plugin.completeTapAuthorization({ operation_id: operationId }),
        'Native tap authorization completion was not acknowledged.',
      );
    },
    async abortTapAuthorization(operationId, reason) {
      await requireSuccess(
        plugin.abortTapAuthorization({ operation_id: operationId, reason }),
        'Native tap authorization abort was not acknowledged.',
      );
    },
    beginAccountMutation(reason) {
      return runAccountMutationTransition(() => beginAccountMutation(reason));
    },
    finalizeAccountMutation(reason, displayEpoch) {
      return runAccountMutationTransition(() => finalizeAccountMutation(reason, displayEpoch));
    },
    getAccountMutationLineage() {
      return runAccountMutationTransition(getAccountMutationLineage);
    },
    async getDisplayPermission() {
      return requirePermissionResponse(await plugin.getDisplayPermission());
    },
    async requestDisplayPermission() {
      return requirePermissionResponse(await plugin.requestDisplayPermission());
    },
    async openNotificationSettings() {
      await requireSuccess(
        plugin.openNotificationSettings(),
        'Native notification settings navigation was not acknowledged.',
      );
    },
    addDataOnlyPushListener(listener) {
      return plugin.addListener('dataOnlyPush', (data) => {
        const payload = parseDataOnlyPushPayload(data);
        if (payload) {
          listener(payload);
        }
      });
    },
    addNotificationTapListener(listener) {
      return plugin.addListener('notificationTap', (data) => {
        if (!hasExactOwnKeys(data, ['delivery_id', 'notice_id', 'display_epoch'])) {
          return;
        }
        const payload = parseDataOnlyPushPayload({
          delivery_id: data.delivery_id,
          notice_id: data.notice_id,
        });
        if (!payload || !isEpoch(data.display_epoch)) {
          return;
        }
        listener({ ...payload, displayEpoch: data.display_epoch });
      });
    },
    addFcmTokenListener(listener) {
      return plugin.addListener('fcmToken', (data) => {
        if (
          !hasExactOwnKeys(data, ['token'])
          || typeof data.token !== 'string'
          || !data.token.trim()
        ) {
          return;
        }
        listener({ token: data.token });
      });
    },
  };
}

export function parseDataOnlyPushPayload(data: unknown): DataOnlyPushPayload | null {
  if (!hasExactOwnKeys(data, ['delivery_id', 'notice_id'])) {
    return null;
  }

  const deliveryId = data.delivery_id;
  const noticeId = data.notice_id;
  if (
    typeof deliveryId !== 'string' ||
    typeof noticeId !== 'string' ||
    !isUuid(deliveryId) ||
    !/^[1-9][0-9]*$/.test(noticeId)
  ) {
    return null;
  }

  return { delivery_id: deliveryId, notice_id: noticeId };
}

export function hasZeroNotificationCounts(receipt: NativeMutationReceipt): boolean {
  if (
    !isOwnRecord(receipt)
    || !hasOwnKey(receipt, 'success')
    || receipt.success !== true
    || !hasOwnKey(receipt, 'zero_counts')
    || !isZeroCounts(receipt.zero_counts)
  ) {
    return false;
  }

  return hasZeroNativeNotificationCounts(receipt.zero_counts);
}
export function hasZeroNativeNotificationCounts(counts: NativeZeroCounts): boolean {
  return (
    isZeroCounts(counts)
    && counts.pending_count === 0
    && counts.delivered_count === 0
    && counts.foreground_banner_count === 0
    && counts.registry_count === 0
    && counts.inflight_count === 0
  );
}


/**
 * Pure test fixture/model only. Production code must use the native coordinator
 * adapter above and must never construct this class.
 */
export class NotificationCoordinator {
  readonly kind = 'pure-fixture-model' as const;

  constructor(readonly installationId: string) {
    if (!isUuid(installationId)) {
      throw new Error('A fixture NotificationCoordinator requires a UUID installation ID.');
    }
  }

  accepts(data: Readonly<Record<string, unknown>>): boolean {
    return parseDataOnlyPushPayload(data) !== null;
  }
}

async function toAuthorizationOperation(
  result: unknown,
  abortMalformedOperation: (operationId: string) => Promise<boolean>,
): Promise<NativeAuthorizationOperation | null> {
  if (hasExactOwnKeys(result, ['admitted']) && result.admitted === false) {
    return null;
  }

  if (
    hasExactOwnKeys(result, ['admitted', 'operation_id'])
    && result.admitted === true
    && isUuid(result.operation_id)
  ) {
    return { operationId: result.operation_id };
  }

  const operationId = getMalformedAuthorizationOperationId(result);
  if (operationId) {
    try {
      await abortMalformedOperation(operationId);
    } catch {
      // Native retains bounded recovery evidence when the abort send fails.
    }
  }

  throw new Error(NATIVE_NOTIFICATION_COORDINATOR_PROTOCOL_ERROR);
}

function getMalformedAuthorizationOperationId(result: unknown): string | null {
  if (
    !isOwnRecord(result)
    || !hasOwnKey(result, 'operation_id')
    || !isUuid(result.operation_id)
  ) {
    return null;
  }

  return result.operation_id;
}

async function requireSuccess(
  result: Promise<NativeOperationResult>,
  message: string,
): Promise<boolean> {
  const acknowledgement = await result;
  if (
    !isOwnRecord(acknowledgement)
    || !hasOwnKey(acknowledgement, 'success')
    || acknowledgement.success !== true
  ) {
    throw new Error(message);
  }
  return true;
}

function requireMutationReceipt(result: NativeMutationReceipt): NativeMutationReceipt {
  if (
    !isOwnRecord(result)
    || !hasOwnKey(result, 'success')
    || result.success !== true
    || !hasOwnKey(result, 'display_epoch')
    || !isEpoch(result.display_epoch)
    || !hasOwnKey(result, 'zero_counts')
    || !isZeroCounts(result.zero_counts)
  ) {
    throw new Error('Native account mutation receipt was malformed.');
  }
  return result;
}
function requireAccountMutationLineage(
  result: unknown,
): NativeAccountMutationLineage | null {
  if (
    !hasExactOwnKeys(result, [
      'available',
      'active',
      'phase',
      'reason',
      'display_epoch',
      'zero_counts',
    ])
    || typeof result.available !== 'boolean'
    || typeof result.active !== 'boolean'
    || !isEpoch(result.display_epoch)
    || !isZeroCounts(result.zero_counts)
  ) {
    throw new Error('Native account mutation lineage was malformed.');
  }

  if (result.available === false) {
    if (
      result.active !== false
      || result.phase !== null
      || result.reason !== null
    ) {
      throw new Error('Native account mutation lineage was malformed.');
    }
    throw new Error('Native account mutation lineage was unavailable.');
  }

  if (result.active === false) {
    if (result.phase !== null || result.reason !== null) {
      throw new Error('Native account mutation lineage was malformed.');
    }
    return null;
  }

  if (
    !isAccountMutationPhase(result.phase)
    || !isAccountMutationReason(result.reason)
  ) {
    throw new Error('Native account mutation lineage was malformed.');
  }

  return {
    phase: result.phase,
    reason: result.reason,
    display_epoch: result.display_epoch,
    zero_counts: result.zero_counts,
  };
}


function requirePermissionResponse(response: unknown): PushPermissionStatus {
  if (!hasExactOwnKeys(response, ['permission'])) {
    throw new Error('Native notification permission response was malformed.');
  }
  return requirePermission(response.permission);
}

function requirePermission(permission: unknown): PushPermissionStatus {
  if (permission === 'prompt') {
    return 'not_determined';
  }
  if (
    permission !== 'not_determined' &&
    permission !== 'denied' &&
    permission !== 'granted' &&
    permission !== 'provisional' &&
    permission !== 'ephemeral'
  ) {
    throw new Error('Native notification permission was malformed.');
  }
  return permission;
}

function isZeroCounts(value: unknown): value is NativeZeroCounts {
  return (
    hasExactOwnKeys(value, [
      'pending_count',
      'delivered_count',
      'foreground_banner_count',
      'registry_count',
      'inflight_count',
    ])
    && isCount(value.pending_count)
    && isCount(value.delivered_count)
    && isCount(value.foreground_banner_count)
    && isCount(value.registry_count)
    && isCount(value.inflight_count)
  );
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isEpoch(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^(0|[1-9][0-9]{0,19})$/.test(value) &&
    BigInt(value) <= BigInt('18446744073709551615')
  );
}
function isAccountMutationReason(value: unknown): value is AccountMutationReason {
  return value === 'logout' || value === 'account_switch' || value === 'deletion';
}

function isAccountMutationPhase(value: unknown): value is AccountMutationPhase {
  return value === 'awaiting_finalize' || value === 'completed';
}

function isPositiveGeneration(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
}

function isTokenGeneration(value: unknown): value is number {
  return isPositiveGeneration(value);
}

function requireSessionBinding(binding: NotificationSessionBinding): void {
  if (
    !isUuid(binding.sessionId) ||
    !isNonEmptyString(binding.authVersion) ||
    !isPositiveGeneration(binding.bindingGeneration) ||
    !isTokenGeneration(binding.tokenGeneration) ||
    !/^Bearer [^\s]+$/.test(binding.authorizationBearer)
  ) {
    throw new Error('Native notification session binding was malformed.');
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
function isOwnRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOwnKey(
  value: Record<string, unknown>,
  key: string,
): boolean {
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

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
