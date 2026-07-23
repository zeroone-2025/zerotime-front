import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  getVerifiedLinkAssets,
  APPLE_TEAM_ID_ENV,
  ANDROID_CERT_FINGERPRINTS_ENV,
} from "./generate-verified-links.mjs";

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const contractPath = resolve(rootDirectory, "contracts/mobile-release-v1.openapi.yaml");
const digestPath = resolve(rootDirectory, "contracts/mobile-release-v1.sha256");
const mobileReleaseClientPath = resolve(rootDirectory, "app/_lib/native/mobileRelease.ts");
const notificationCoordinatorClientPath = resolve(
  rootDirectory,
  "app/_lib/native/notificationCoordinator.ts",
);
const nativeAuthClientPath = resolve(
  rootDirectory,
  "app/_lib/native/nativeAuth.ts",
);
const providersPath = resolve(rootDirectory, "app/providers.tsx");
const accountDeletionPagePath = resolve(rootDirectory, "app/account-deletion/page.tsx");
const androidMainActivityPath = resolve(
  rootDirectory,
  "android/app/src/main/java/kr/zerotime/app/MainActivity.java",
);
const androidLaunchGatePath = resolve(
  rootDirectory,
  "android/app/src/main/java/kr/zerotime/app/LaunchGateActivity.java",
);
const androidCoordinatorPath = resolve(
  rootDirectory,
  "android/app/src/main/java/kr/zerotime/app/NativeNotificationCoordinatorPlugin.java",
);
const iosCoordinatorPath = resolve(
  rootDirectory,
  "ios/App/App/NativeNotificationCoordinatorPlugin.swift",
);
const iosPackageResolvedPath = resolve(
  rootDirectory,
  "ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved",
);
const iosProjectPath = resolve(
  rootDirectory,
  "ios/App/App.xcodeproj/project.pbxproj",
);
const iosAppDelegatePath = resolve(
  rootDirectory,
  "ios/App/App/AppDelegate.swift",
);
const evidenceSchemaPath = resolve(
  rootDirectory,
  "docs/release/evidence.schema.json",
);
const nativeBarrierPath = resolve(
  rootDirectory,
  "docs/release/native-notification-barrier.v1.md",
);
const verifiedLinksArgument = "--verified-links";
const nativeReleaseGateArgument = "--native-release-gate";
const buildGateArgument = "--build-gate";

async function readRequired(path, label) {
  try {
    const value = await readFile(path);

    if (value.length === 0) {
      throw new Error(`${label} is empty: ${path}`);
    }

    return value;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(`${label} is empty:`)) {
      throw error;
    }

    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new Error(`${label} is missing: ${path}`);
    }

    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read ${label.toLowerCase()} at ${path}: ${reason}`);
  }
}

function requiredSlice(source, start, end, label) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);

  if (startIndex < 0 || endIndex < 0) {
    throw new Error(`Unable to locate ${label}.`);
  }

  return source.slice(startIndex, endIndex);
}

function requireSourceInvariant(source, invariant, label) {
  if (!source.includes(invariant)) {
    throw new Error(`Native coordinator invariant is missing: ${label}.`);
  }
}

function forbidSourceInvariant(source, invariant, label) {
  if (source.includes(invariant)) {
    throw new Error(`Native coordinator invariant is violated: ${label}.`);
  }
}
function skipSourceTrivia(source, startIndex, nestedBlockComments) {
  let index = startIndex;
  while (index < source.length) {
    if (/\s/.test(source[index])) {
      index += 1;
      continue;
    }
    if (source.startsWith("//", index)) {
      const lineEndOffset = source.slice(index + 2).search(/[\r\n\u2028\u2029]/);
      index = lineEndOffset < 0 ? source.length : index + 3 + lineEndOffset;
      continue;
    }
    if (source.startsWith("/*", index)) {
      let depth = 1;
      index += 2;
      while (index < source.length && depth > 0) {
        if (nestedBlockComments && source.startsWith("/*", index)) {
          depth += 1;
          index += 2;
        } else if (source.startsWith("*/", index)) {
          depth -= 1;
          index += 2;
        } else {
          index += 1;
        }
      }
      continue;
    }
    break;
  }
  return index;
}

function skipSourceLiteral(source, startIndex) {
  const quote = source[startIndex];
  if (quote !== '"' && quote !== "'") return startIndex;
  const tripleQuoted = quote === '"' && source.startsWith('"""', startIndex);
  let index = startIndex + (tripleQuoted ? 3 : 1);
  while (index < source.length) {
    if (tripleQuoted && source.startsWith('"""', index)) {
      return index + 3;
    }
    if (!tripleQuoted && source[index] === quote) {
      return index + 1;
    }
    if (source[index] === "\\") {
      index += 2;
    } else {
      index += 1;
    }
  }
  return source.length;
}

function countCallExpressions(source, calleeName, nestedBlockComments) {
  source = source.replace(/\\u+([0-9A-Fa-f]{4})/g, (_match, codePoint) =>
    String.fromCharCode(Number.parseInt(codePoint, 16)));
  let count = 0;
  let index = 0;
  while (index < source.length) {
    index = skipSourceTrivia(source, index, nestedBlockComments);
    if (index >= source.length) break;
    if (source[index] === '"' || source[index] === "'") {
      index = skipSourceLiteral(source, index);
      continue;
    }
    if (source[index] === "`") {
      const end = source.indexOf("`", index + 1);
      if (end < 0) {
        index += 1;
        continue;
      }
      const identifier = source.slice(index + 1, end);
      const next = skipSourceTrivia(source, end + 1, nestedBlockComments);
      if (identifier === calleeName && source[next] === "(") {
        count += 1;
      }
      index = end + 1;
      continue;
    }
    if (/[A-Za-z_]/.test(source[index])) {
      let end = index + 1;
      while (end < source.length && /[A-Za-z0-9_]/.test(source[end])) {
        end += 1;
      }
      const identifier = source.slice(index, end);
      const next = skipSourceTrivia(source, end, nestedBlockComments);
      if (identifier === calleeName && source[next] === "(") {
        count += 1;
      }
      index = end;
      continue;
    }
    index += 1;
  }
  return count;
}

function compactSource(source, nestedBlockComments) {
  let compact = "";
  let index = 0;
  while (index < source.length) {
    const next = skipSourceTrivia(source, index, nestedBlockComments);
    if (next !== index) {
      index = next;
      continue;
    }
    if (source[index] === '"' || source[index] === "'") {
      const end = skipSourceLiteral(source, index);
      compact += source.slice(index, end);
      index = end;
      continue;
    }
    compact += source[index];
    index += 1;
  }
  return compact;
}
function compactJavaSource(source) {
  return compactSource(source, false);
}

function compactSwiftSource(source) {
  return compactSource(source, true);
}

if (
  compactSwiftSource('alpha /* outer /* nested */ outer */ beta "//not-comment"')
  !== 'alphabeta"//not-comment"'
  || compactJavaSource("alpha /* outer /* nested */ outer */ beta")
    !== "alphaouter*/beta"
  || compactJavaSource("alpha//comment\rbeta") !== "alphabeta"
  || compactSwiftSource("alpha//comment\u2028beta") !== "alphabeta"
) {
  throw new Error("Native coordinator source compactor failed its hostile lexical fixtures.");
}
if (
  countCallExpressions(
    "preflightLocked/* outer /* nested */ outer */ ( )",
    "preflightLocked",
    true,
  ) !== 1
  || countCallExpressions(
    '"preflightLocked()" /* preflightLocked() */',
    "preflightLocked",
    true,
  ) !== 0
  || countCallExpressions("bootstr\\u0061pLocked()", "bootstrapLocked", false) !== 1
  || countCallExpressions("self.`preflightLocked`()", "preflightLocked", true) !== 1
  || countCallExpressions(
    "/* /*\n*/ bootstrapLocked(); // */",
    "bootstrapLocked",
    false,
  ) !== 1
) {
  throw new Error("Native coordinator call-expression scanner failed its hostile lexical fixtures.");
}

function requireExactMembers(actual, expected, label) {
  if (
    !Array.isArray(actual) ||
    actual.length !== expected.length ||
    expected.some((member) => !actual.includes(member))
  ) {
    throw new Error(`${label} must contain exactly ${expected.join(", ")}.`);
  }
}

function requireOrderedInvariants(source, invariants, label) {
  let previousIndex = -1;

  for (const invariant of invariants) {
    const index = source.indexOf(invariant, previousIndex + 1);
    if (index < 0) {
      throw new Error(`Native coordinator invariant is missing or out of order: ${label}.`);
    }
    previousIndex = index;
  }
}

async function verifyNativeCoordinatorContract() {
  const [
    contract,
    mobileReleaseClient,
    notificationCoordinatorClient,
    nativeAuthClient,
    providers,
    accountDeletionPage,
    androidMainActivity,
    androidLaunchGate,
    androidCoordinator,
    iosCoordinator,
    iosPackageResolvedDocument,
    iosProject,
    iosAppDelegate,
    evidenceSchemaDocument,
    nativeBarrier,
  ] = await Promise.all([
    readRequired(contractPath, "Vendored contract").then((value) =>
      value.toString("utf8"),
    ),
    readRequired(mobileReleaseClientPath, "Mobile release client").then((value) =>
      value.toString("utf8"),
    ),
    readRequired(notificationCoordinatorClientPath, "Notification coordinator client").then(
      (value) => value.toString("utf8"),
    ),
    readRequired(nativeAuthClientPath, "Native auth client").then((value) =>
      value.toString("utf8"),
    ),
    readRequired(providersPath, "Native runtime provider").then((value) =>
      value.toString("utf8"),
    ),
    readRequired(accountDeletionPagePath, "Account deletion page").then((value) =>
      value.toString("utf8"),
    ),
    readRequired(androidMainActivityPath, "Android launch gate").then((value) =>
      value.toString("utf8"),
    ),
    readRequired(androidLaunchGatePath, "Android cold-launch gate").then((value) =>
      value.toString("utf8"),
    ),
    readRequired(androidCoordinatorPath, "Android native coordinator").then(
      (value) => value.toString("utf8"),
    ),
    readRequired(iosCoordinatorPath, "iOS native coordinator").then((value) =>
      value.toString("utf8"),
    ),
    readRequired(iosPackageResolvedPath, "iOS dependency lock").then((value) =>
      value.toString("utf8"),
    ),
    readRequired(iosProjectPath, "iOS project").then((value) =>
      value.toString("utf8"),
    ),
    readRequired(iosAppDelegatePath, "iOS launch gate").then((value) =>
      value.toString("utf8"),
    ),
    readRequired(evidenceSchemaPath, "Release evidence schema").then((value) =>
      value.toString("utf8"),
    ),
    readRequired(nativeBarrierPath, "Native notification barrier").then((value) =>
      value.toString("utf8"),
    ),
  ]);
  const canonicalContractDigest = createHash("sha256").update(contract).digest("hex");
  for (const [label, source, expectedDigest] of [
    [
      "Android native coordinator",
      androidCoordinator,
      "78f43b246cf5961114541369cbdf46f61fad41aa7ec8bcf0bd3da27e7be0ca11",
    ],
    [
      "iOS native coordinator",
      iosCoordinator,
      "cb9d106aeca38a43948890f58c841ee0ae855941f30493e489371997378c8345",
    ],
  ]) {
    const actualDigest = createHash("sha256").update(source).digest("hex");
    if (actualDigest !== expectedDigest) {
      throw new Error(
        `${label} changed outside the reviewed mobile-release.v1 source digest; explicit native protocol review is required.`,
      );
    }
  }
  forbidSourceInvariant(
    androidCoordinator,
    "\\u",
    "Android coordinator source must not use Java Unicode escapes",
  );
  requireSourceInvariant(
    contract,
    "finalizeAccountMutation(reason, display_epoch)",
    "the authoritative mutation finalize signature must require the caller's begin epoch",
  );
  requireSourceInvariant(
    nativeBarrier,
    "finalizeAccountMutation(reason, display_epoch)",
    "the native barrier must document the caller-owned finalize epoch",
  );
  const clientMutationFinalize = requiredSlice(
    notificationCoordinatorClient,
    "const finalizeAccountMutation = async (",
    "return {",
    "TypeScript mutation finalization",
  );
  requireOrderedInvariants(
    clientMutationFinalize,
    [
      "reason: AccountMutationReason",
      "displayEpoch: string",
      "!isEpoch(displayEpoch)",
      "activeMutation.reason !== reason",
      "activeMutation.displayEpoch !== displayEpoch",
      "plugin.finalizeAccountMutation({",
      "display_epoch: displayEpoch",
      "receipt.display_epoch !== displayEpoch",
    ],
    "TypeScript mutation finalization must preserve the caller-owned reason and begin epoch",
  );
  forbidSourceInvariant(
    clientMutationFinalize,
    "plugin.beginAccountMutation",
    "TypeScript mutation finalization must never create or adopt a replacement begin epoch",
  );
  const clientMutationCache = requiredSlice(
    notificationCoordinatorClient,
    "const getAccountMutationLineage = async (",
    "async updateSessionGenerations(options)",
    "TypeScript mutation cache lifecycle",
  );
  requireOrderedInvariants(
    clientMutationCache,
    [
      "activeAccountMutation = lineage.phase === 'awaiting_finalize'",
      "? {",
      ": null",
      "async bindSession(binding)",
      "runAccountMutationTransition(async () =>",
      "const bound = await requireSuccess(",
      "if (bound)",
      "activeAccountMutation = null",
    ],
    "TypeScript must cache only awaiting lineage and retire it after a serialized successful bind",
  );
  const deletionCredentialCleanup = requiredSlice(
    nativeAuthClient,
    "export async function clearNativeAuthSessionAfterAccountDeletionAcknowledgement(",
    "async function ensureAppUrlListener()",
    "native deletion credential cleanup",
  );
  requireOrderedInvariants(
    deletionCredentialCleanup,
    [
      "callerDisplayEpoch: string",
      "!isCanonicalUint64String(callerDisplayEpoch)",
      "const owner = nativeMutationOwner('deletion', callerDisplayEpoch)",
      "finalizeNativeMutationOwner(barrier, owner)",
      "clearNativeCredentials(storage, owner",
    ],
    "native deletion cleanup must require and finalize the caller-held begin epoch",
  );
  forbidSourceInvariant(
    deletionCredentialCleanup,
    "barrier.beginAccountMutation",
    "native deletion acknowledgement cleanup must never synthesize a replacement begin epoch",
  );
  const deletionLifecycle = requiredSlice(
    providers,
    "export async function ensureNativeAccountDeletionBarrier()",
    "export async function finalizeNativeAccountDeletionBarrier(",
    "native deletion lifecycle",
  );
  requireSourceInvariant(
    deletionLifecycle,
    "return requireNativeAccountDeletionBarrierEpoch()",
    "native deletion lifecycle must expose its authentic begin epoch",
  );
  const deletionFinalize = requiredSlice(
    providers,
    "export async function finalizeNativeAccountDeletionBarrier(",
    "/** @deprecated Use ensureNativeAccountDeletionBarrier",
    "native deletion finalization",
  );
  requireOrderedInvariants(
    deletionFinalize,
    [
      "callerDisplayEpoch: string",
      "const lifecycle = nativeAccountDeletionBarrier",
      "if (!lifecycle)",
      "lifecycle.displayEpoch !== callerDisplayEpoch",
      "const runtime = lifecycle.runtime",
      "runtime.native.finalizeAccountMutation(",
      "callerDisplayEpoch",
      "receipt.display_epoch !== callerDisplayEpoch",
      "nativeAccountDeletionBarrier = null",
    ],
    "native deletion finalization must require, consume, and retire the caller-held lifecycle epoch",
  );
  forbidSourceInvariant(
    deletionFinalize,
    "beginNativeAccountMutation",
    "native deletion finalization must never create or adopt a replacement begin epoch",
  );
  const accountDeletionLocalCleanup = requiredSlice(
    accountDeletionPage,
    "const finishLocalCleanup = async (",
    "const finishCancellationLocalCleanup = async (",
    "account deletion local cleanup",
  );
  requireOrderedInvariants(
    accountDeletionLocalCleanup,
    [
      "const displayEpoch = await ensureNativeAccountDeletionBarrier()",
      "if (!displayEpoch)",
      "clearNativeAuthSessionAfterAccountDeletionAcknowledgement(displayEpoch)",
    ],
    "account deletion cleanup must finalize the exact same-process begin epoch",
  );
  const nativeCorruptQuarantine = requiredSlice(
    nativeAuthClient,
    "async function establishNativeCorruptSessionRecovery(",
    "async function recoverNativeAuthCorruptSessionOnce(",
    "corrupt native-session quarantine",
  );
  requireOrderedInvariants(
    nativeCorruptQuarantine,
    [
      "const pendingMutation = extractCorruptPendingMutation(corruptSessionValue)",
      "const reason = pendingMutation?.reason ?? 'account_switch'",
      "invalidateNativeAuthSessionForMutation()",
      "clearAccessToken()",
      "const barrier = requireNotificationBarrier()",
      "const lineage = await barrier.getAccountMutationLineage()",
      "if (pendingMutation?.version === 4)",
      "if (pendingMutation.displayEpoch !== undefined)",
      "nativeMutationOwner(reason, pendingMutation.displayEpoch)",
      "requireExactNativeMutationLineage(lineage, owner)",
      "const intent: NativeCorruptSessionBeginIntent",
      "phase: 'native_begin_pending'",
      "await saveNativeCorruptSessionAudit(storage, intent)",
      "return completeNativeCorruptSessionBeginIntent(storage, intent)",
      "async function completeNativeCorruptSessionBeginIntent(",
      "const lineage = await barrier.getAccountMutationLineage()",
      "if (lineage === null)",
      "await barrier.beginAccountMutation(intent.reason)",
      "const auditedPendingMutation",
      "displayEpoch: owner.displayEpoch",
      "const audit: NativeCorruptSessionAudit",
      "await saveNativeCorruptSessionAudit(storage, audit)",
      "await markPrivacyBarrierFailure(storage, owner, { corruptSession: true })",
    ],
    "corrupt recovery must persist a begin intent before creating or rebinding its exact native epoch",
  );
  requireSourceInvariant(
    nativeCorruptQuarantine,
    "phase === 'refresh_recovery_pending'\n            ? 'refresh_recovery_pending'",
    "corrupt recovery must preserve the exact durable refresh-recovery phase",
  );
  forbidSourceInvariant(
    nativeCorruptQuarantine,
    "loadStoredSession(",
    "corrupt-session quarantine must not reread a credential after corruption was observed",
  );
  const nativeCorruptRecoveryEntry = requiredSlice(
    nativeAuthClient,
    "async function recoverNativeAuthCorruptSessionOnce(",
    "async function recoverExactNativeCorruptSession(",
    "corrupt native-session recovery entry",
  );
  requireOrderedInvariants(
    nativeCorruptRecoveryEntry,
    [
      "failure = await loadPrivacyBarrierFailure(storage)",
      "recoveryRecord = await loadNativeCorruptSessionAudit(storage)",
      "if (recoveryRecord?.version === 3)",
      "if (failure !== null)",
      "completeNativeCorruptSessionBeginIntent(",
      "const audit = recoveryRecord",
      "if (audit !== null && failure === null)",
      "if (failure !== null || audit !== null)",
      "const storedSession = await loadStoredSession(storage)",
      "storedSession.kind !== 'corrupt'",
      "establishNativeCorruptSessionRecovery(storage, storedSession.value)",
    ],
    "restart recovery must finish a durable begin intent or consume exact owned evidence before inspecting corrupt bytes",
  );
  forbidSourceInvariant(
    nativeCorruptRecoveryEntry,
    ".beginAccountMutation(",
    "restart corrupt recovery entry must never create a replacement mutation",
  );
  const nativeCorruptRecovery = requiredSlice(
    nativeAuthClient,
    "async function recoverExactNativeCorruptSession(",
    "async function saveNativeCorruptSessionAudit(",
    "exact corrupt native-session recovery",
  );
  requireOrderedInvariants(
    nativeCorruptRecovery,
    [
      "const owner = privacyBarrierFailureOwner(failure)",
      "audit.reason !== owner.reason",
      "audit.display_epoch !== owner.displayEpoch",
      "requireExactNativeMutationLineage(",
      "await barrier.getAccountMutationLineage()",
      "!audit.serverAcknowledged && lineage.phase !== 'awaiting_finalize'",
      "if (!acknowledgedAudit.serverAcknowledged)",
      "await storage.get(NATIVE_AUTH_REFRESH_STORAGE_KEY)",
      "nativePendingMutationPhase(pendingMutation) === 'refresh_recovery_pending'",
      "replayNativeRefreshRecovery(pendingMutation, refreshToken)",
      "await requestNativeLogout(",
      "phase: 'server_acknowledged'",
      "await requestNativeLogoutReconciliation(pendingMutation, refreshToken)",
      "serverAcknowledged: true",
      "await saveNativeCorruptSessionAudit(storage, acknowledgedAudit)",
      "await finalizeNativeMutationOwner(barrier, owner)",
      "await clearNativeCredentialsOnce(storage, owner, {",
      "allowCorruptSessionReconciliation: true",
      "corruptSessionRecovery: true",
    ],
    "exact corrupt recovery must replay a stable refresh subphase, durably record server acknowledgement, then finalize",
  );
  forbidSourceInvariant(
    nativeCorruptRecovery,
    ".beginAccountMutation(",
    "exact corrupt restart recovery must never create or adopt a replacement begin epoch",
  );
  const privacyFailureGuard = requiredSlice(
    nativeAuthClient,
    "async function requireNoPrivacyBarrierFailure(",
    "async function closeNativeAuthForCorruptStoredSession(",
    "privacy failure marker guard",
  );
  requireOrderedInvariants(
    privacyFailureGuard,
    [
      "failure = await loadPrivacyBarrierFailure(storage)",
      "} catch (error)",
      "privacyBarrierFailed = true",
      "invalidateNativeAuthSessionForMutation()",
      "clearAccessToken()",
      "throw asNativeAuthError(",
    ],
    "malformed privacy recovery evidence must fail closed without guessing a mutation owner",
  );
  forbidSourceInvariant(
    privacyFailureGuard,
    ".beginAccountMutation(",
    "malformed privacy evidence must not guess a replacement mutation",
  );
  const nativeCredentialCleanup = requiredSlice(
    nativeAuthClient,
    "async function clearNativeCredentialsOnce(",
    "async function removeNativeSessionCredentials(",
    "JavaScript native credential cleanup",
  );
  requireOrderedInvariants(
    nativeCredentialCleanup,
    [
      "if (!options.allowCorruptSessionReconciliation)",
      "const storedSessionState = await loadStoredSession(storage)",
      "await markPrivacyBarrierFailure(",
      "owner,",
      "options.corruptSessionRecovery ? { corruptSession: true } : {}",
      "const cleanupKeys = [",
      "options.corruptSessionRecovery",
      "await removeNativeSessionCredentials(",
      "cleanupKeys,",
      "await storage.remove(NATIVE_AUTH_PRIVACY_BARRIER_FAILED_STORAGE_KEY)",
      "if (options.corruptSessionRecovery)",
      "await storage.remove(NATIVE_AUTH_CORRUPT_SESSION_AUDIT_STORAGE_KEY)",
    ],
    "credential cleanup must retain corrupt audit evidence until the exact marker and authentication secrets are cleared",
  );
  requireSourceInvariant(
    nativeCredentialCleanup,
    "if (!options.allowCorruptSessionReconciliation) {\n    const storedSessionState = await loadStoredSession(storage);",
    "successful corrupt reconciliation cleanup must not perform a phase-gated stored-session read",
  );
  const nativeCredentialRemoval = requiredSlice(
    nativeAuthClient,
    "async function removeNativeSessionCredentials(",
    "async function clearInvalidNativeSession(",
    "JavaScript native credential removal",
  );
  requireOrderedInvariants(
    nativeCredentialRemoval,
    [
      "if (!options.allowCorruptSessionReconciliation)",
      "const storedSessionState = await loadStoredSession(storage)",
      "const cleanupErrors: unknown[] = []",
      "await storage.remove(key)",
    ],
    "corrupt reconciliation credential removal must bypass phase-gated session reads only after the normal fail-closed guard",
  );
  requireSourceInvariant(
    nativeCredentialRemoval,
    "if (!options.allowCorruptSessionReconciliation) {\n    const storedSessionState = await loadStoredSession(storage);",
    "corrupt reconciliation credential removal must not perform a phase-gated stored-session read",
  );
  const privacyFailureLoad = requiredSlice(
    nativeAuthClient,
    "async function loadPrivacyBarrierFailure(",
    "function toStoredSession(",
    "privacy failure marker loading",
  );
  requireSourceInvariant(
    privacyFailureLoad,
    "if (value === null)",
    "only an explicit null privacy failure marker may be absent",
  );
  forbidSourceInvariant(
    privacyFailureLoad,
    "if (!value)",
    "an empty privacy failure marker must remain malformed",
  );
  const clientMutationLineageParser = requiredSlice(
    notificationCoordinatorClient,
    "function requireAccountMutationLineage(",
    "function requirePermissionResponse(",
    "TypeScript native mutation lineage parser",
  );
  requireOrderedInvariants(
    clientMutationLineageParser,
    [
      "'available'",
      "'active'",
      "'phase'",
      "'reason'",
      "'display_epoch'",
      "'zero_counts'",
      "if (result.available === false)",
      "throw new Error('Native account mutation lineage was unavailable.')",
      "if (result.active === false)",
      "result.phase !== null || result.reason !== null",
      "!isAccountMutationPhase(result.phase)",
      "!isAccountMutationReason(result.reason)",
      "phase: result.phase",
      "display_epoch: result.display_epoch",
    ],
    "TypeScript must distinguish unavailable, inactive, awaiting, and completed exact native lineage",
  );
  const pendingMutationOwnerRecovery = requiredSlice(
    nativeAuthClient,
    "async function recoverPendingNativeMutationOwner(",
    "async function recoverPrivacyBarrierFailure(",
    "pending native mutation owner recovery",
  );
  requireOrderedInvariants(
    pendingMutationOwnerRecovery,
    [
      "pendingMutation.version !== 4",
      "let recoveryMutation = pendingMutation",
      "let phase = nativePendingMutationPhase(recoveryMutation)",
      "let lineage = await barrier.getAccountMutationLineage()",
      "recoveryMutation.displayEpoch !== undefined",
      "nativeMutationOwner(recoveryMutation.reason, recoveryMutation.displayEpoch)",
      "requireExactNativeMutationLineage(lineage, owner)",
      "if (phase === 'pre_begin')",
      "if (lineage !== null)",
      "persistPendingNativeMutationPhase(",
      "'native_begin_pending'",
      "if (phase === 'native_begin_pending')",
      "if (lineage === null)",
      "await barrier.beginAccountMutation(recoveryMutation.reason)",
      "lineage.phase !== 'awaiting_finalize'",
      "lineage.reason !== recoveryMutation.reason",
      "!hasExactZeroCounts(lineage.zero_counts)",
      "persistPendingNativeMutationDisplayEpoch(",
    ],
    "pending logout recovery must separate pre-begin intent, replay only a durable begin request, and preserve exact native lineage",
  );
  const refreshRotationRecovery = requiredSlice(
    nativeAuthClient,
    "async function resumePendingNativeMutation(",
    "async function recoverPendingNativeMutationOwner(",
    "refresh rotation recovery flow",
  );
  requireOrderedInvariants(
    refreshRotationRecovery,
    [
      "'refresh_recovery_pending'",
      "if (!refreshReplayRequired)",
      "requestNativeLogoutReconciliation(acknowledgedMutation, refreshToken)",
      "persistRefreshRecoveryIdempotencyKey(",
      "refreshReplayRequired = true",
      "if (refreshReplayRequired)",
      "replayNativeRefreshRecovery(",
      "persistRotatedPendingMutationRefresh(",
      "await requestNativeLogout(",
      "'server_acknowledged'",
    ],
    "refresh rotation recovery must persist and idempotently replay its post-rotation subphase",
  );
  const refreshRotationReplay = requiredSlice(
    nativeAuthClient,
    "async function replayNativeRefreshRecovery(",
    "async function recoverPendingNativeMutationOwner(",
    "refresh rotation replay validation",
  );
  requireOrderedInvariants(
    refreshRotationReplay,
    [
      "pendingMutation.refreshRecoveryIdempotencyKey",
      "pendingMutation.version !== 4",
      "nativePendingMutationPhase(pendingMutation) !== 'refresh_recovery_pending'",
      "!isCanonicalUint64String(pendingMutation.displayEpoch)",
      "!isUuid(refreshRecoveryIdempotencyKey)",
      "'/v1/native-auth/refresh'",
      "'Idempotency-Key': refreshRecoveryIdempotencyKey",
      "validateActiveSession(response.data, pendingMutation.installationId)",
      "session.sessionId !== pendingMutation.sessionId",
      "session.bindingGeneration !== pendingMutation.bindingGeneration",
    ],
    "refresh rotation replay must validate and reuse its exact durable owner and idempotency key",
  );
  const refreshRotationPersistence = requiredSlice(
    nativeAuthClient,
    "async function persistRefreshRecoveryIdempotencyKey(",
    "async function loadPrivacyBarrierFailure(",
    "refresh rotation durable journal",
  );
  requireOrderedInvariants(
    refreshRotationPersistence,
    [
      "phase: 'refresh_recovery_pending'",
      "NATIVE_AUTH_SESSION_STORAGE_KEY",
      "storedPhase !== 'server_acknowledged'",
      "storedPhase !== 'refresh_recovery_pending'",
    ],
    "refresh replay must journal before rotation and retain retry state on failure",
  );
  const rotatedRefreshReplayContext = requiredSlice(
    nativeAuthClient,
    "async function persistRotatedPendingMutationRefresh(",
    "async function requirePendingNativeMutationReconciliation(",
    "rotated refresh replay context",
  );
  requireSourceInvariant(
    rotatedRefreshReplayContext,
    "NATIVE_AUTH_SESSION_STORAGE_KEY",
    "refresh replay must persist non-secret session context before logout",
  );
  forbidSourceInvariant(
    rotatedRefreshReplayContext,
    "NATIVE_AUTH_REFRESH_STORAGE_KEY",
    "refresh replay must retain the original refresh credential as its exact idempotent replay input",
  );
  const nativeLogoutOwnerFlow = requiredSlice(
    nativeAuthClient,
    "export async function logoutNativeAuthSession(",
    "export async function clearNativeAuthSessionAfterAccountDeletionAcknowledgement(",
    "native logout exact owner flow",
  );
  requireOrderedInvariants(
    nativeLogoutOwnerFlow,
    [
      "savePendingNativeMutation(storage, reason)",
      "persistPendingNativeMutationPhase(",
      "'native_begin_pending'",
      "await barrier.beginAccountMutation(reason)",
      "const owner = nativeMutationOwner(reason, beginReceipt.display_epoch)",
      "persistPendingNativeMutationDisplayEpoch(",
      "await requestNativeLogout(",
      "persistPendingNativeMutationPhase(",
      "'server_acknowledged'",
      "finalizeNativeMutationOwner(barrier, owner)",
    ],
    "native logout must persist pre-begin intent, begin request, exact epoch, and server acknowledgement before finalization",
  );
  const privacyBarrierExactRecovery = requiredSlice(
    nativeAuthClient,
    "async function recoverPrivacyBarrierFailure(",
    "function requireNativeSessionPublicationOpen(",
    "exact privacy barrier recovery",
  );
  requireOrderedInvariants(
    privacyBarrierExactRecovery,
    [
      "const owner = privacyBarrierFailureOwner(failure)",
      "if (!owner)",
      "'LOCAL_PRIVACY_BARRIER_RECOVERY_UNOWNED'",
      "requireExactNativeMutationLineage(",
      "await barrier.getAccountMutationLineage()",
      "lineage.phase !== 'completed'",
      "finalizeNativeMutationOwner(barrier, owner)",
      "clearNativeCredentials(storage, owner)",
    ],
    "privacy marker recovery must require exact completed native lineage and never guess an owner",
  );
  forbidSourceInvariant(
    privacyBarrierExactRecovery,
    ".beginAccountMutation(",
    "privacy marker restart recovery must never begin a replacement mutation",
  );
  const terminalNativePreparation = requiredSlice(
    nativeAuthClient,
    "export async function prepareNativeTerminalRecovery()",
    "async function refreshNativeAuthSessionOnce(",
    "terminal native journal preparation",
  );
  requireOrderedInvariants(
    terminalNativePreparation,
    [
      "recoverNativeAuthCorruptSession()",
      "const storedSession = await requireUncorruptedStoredSession(",
      "const pendingMutation = storedSession?.pendingMutation ?? null",
      "if (pendingMutation)",
      "await resumePendingNativeMutation(storage, pendingMutation)",
      "return 'recovered'",
      "return 'journal_pending'",
      "if (storedSession)",
      "const privacyFailure = await loadPrivacyBarrierFailure(storage)",
      "const corruptAudit = await loadNativeCorruptSessionAudit(storage)",
      "await storage.get(NATIVE_AUTH_REFRESH_STORAGE_KEY)",
      "await storage.get(NATIVE_AUTH_TRANSIENT_STORAGE_KEY)",
      "'credential_free'",
    ],
    "terminal recovery must resume a durable journal before proving every credential class absent",
  );
  const terminalNativeRecovery = requiredSlice(
    providers,
    "async function closeNativeAdmissionForTerminalRecovery(",
    "function ensureTerminalNativeAdmissionRecovery(",
    "terminal native admission recovery",
  );
  requireOrderedInvariants(
    terminalNativeRecovery,
    [
      "candidate.phase !== 'completed'",
      "!hasZeroNativeNotificationCounts(candidate.zero_counts)",
      "native.finalizeAccountMutation(",
      "candidate.display_epoch",
      "preparation = await prepareNativeTerminalRecovery()",
      "if (preparation !== 'credential_free')",
      "await hasAuthoritativeDeletionRecoveryJournal(storage)",
      "lineage = await native.getAccountMutationLineage()",
      "if (lineage)",
      "finalizeCompletedLineage(lineage)",
      "persistNativeRecoveryRequiredMarker(storage, lineage)",
      "native.beginAccountMutation('logout')",
      "persistNativeRecoveryRequiredMarker(storage, {",
      "phase: 'awaiting_finalize'",
    ],
    "terminal recovery must replay authoritative journals before exact credential-free fallback and marker creation",
  );
  requireOrderedInvariants(
    requiredSlice(
      providers,
      "async function persistNativeRecoveryRequiredMarker(",
      "async function closeNativeAdmissionForTerminalRecovery(",
      "terminal recovery marker",
    ),
    [
      "storage: NativeAuthSecureStorageAdapter",
      "lineage: NativeAccountMutationLineage",
      "await storage.get(NATIVE_AUTH_RECOVERY_REQUIRED_MARKER_KEY)",
      "if (existingMarker !== null)",
      "return",
      "await storage.set(",
      "version: 2",
      "reason: lineage.reason",
      "display_epoch: lineage.display_epoch",
    ],
    "terminal recovery marker must preserve only exact owned lineage",
  );
  forbidSourceInvariant(
    requiredSlice(
      providers,
      "async function persistNativeRecoveryRequiredMarker(",
      "async function hasAuthoritativeDeletionRecoveryJournal(",
      "terminal exact recovery marker",
    ),
    "unowned",
    "terminal recovery must never synthesize an ownerless marker",
  );
  const terminalDependencyLifecycle = requiredSlice(
    providers,
    "function createTerminalNativeRecoveryDependencies(",
    "function isNativeRuntimeAdmissionOpen(",
    "terminal dependency lifecycle",
  );
  requireOrderedInvariants(
    terminalDependencyLifecycle,
    [
      "storage: createNativeAuthSecureStorageAdapter()",
      "setNativeAuthSecureStorageAdapter(dependencies.storage)",
      "setNativeAuthNotificationBarrier(dependencies.barrier)",
      "if (terminalNativeRecoveryDependencies)",
      "return",
      "setNativeAuthSecureStorageAdapter(null)",
      "setNativeAuthNotificationBarrier(null)",
    ],
    "terminal recovery must retain one explicit secure storage and barrier dependency set",
  );
  const terminalDependencyTeardown = requiredSlice(
    providers,
    "function enterTerminalNativeRecovery(",
    "function awaitNativeStartup",
    "terminal dependency teardown",
  );
  requireOrderedInvariants(
    terminalDependencyTeardown,
    [
      "setNativeAuthSessionBinder(null)",
      "createTerminalNativeRecoveryDependencies(",
      "await ensureTerminalNativeAdmissionRecovery(",
      "await disposeNativeNotificationRuntime(",
      "releaseTerminalNativeRecoveryDependencies(recoveryDependencies)",
      "zerotime:native-session-recovery-required",
    ],
    "terminal recovery must settle native admission recovery before releasing dependencies or notifying",
  );
  const deletionPrebindRecovery = requiredSlice(
    providers,
    "async function recoverNativeAccountDeletionBeforeSessionBind(",
    "async function bindNativeNotificationSession(",
    "native deletion prebind recovery",
  );
  requireOrderedInvariants(
    deletionPrebindRecovery,
    [
      "parseStoredDeletionOperationRecord(",
      "operation.phase === 'reauth_pending'",
      "operation.phase === 'native_begin_pending'",
      "operation.phase === 'sending' || operation.phase === 'outcome_unknown'",
      "operation.phase === 'server_acknowledged'",
      "operation.phase === 'local_cleanup_pending'",
      "operation.phase === 'local_complete'",
      "const requiresDeletionLifecycle",
      "runtime.native.getAccountMutationLineage()",
      "!lineage && isNativeBeginPendingDeletionJournal",
      "runtime.native.beginAccountMutation('deletion')",
      "!hasZeroNotificationCounts(receipt)",
      "phase: 'awaiting_finalize'",
      "if (requiresDeletionLifecycle)",
      "lineage.reason !== 'deletion'",
      "const preAcknowledgementLineageValid",
      "operation?.kind === 'cancel' && lineage.phase === 'completed'",
      "const lineageIsValid",
      "isNativeBeginPendingDeletionJournal && lineage.phase === 'awaiting_finalize'",
      "isPreAcknowledgementDeletionJournal && preAcknowledgementLineageValid",
      "isAcknowledgedDeletionJournal",
      "isRequestLocalComplete && lineage.phase === 'completed'",
      "isResolvedCancellation && lineage.phase === 'completed'",
      "if (isResolvedCancellation)",
      "releaseNativeAuthSessionAfterDeletionCancellation()",
      "return false",
      "if (isReauthPendingDeletionJournal)",
      "invalidateNativeAuthSessionForMutation()",
      "clearAccessToken()",
      "const recoveredLifecycle: NativeAccountDeletionBarrierLifecycle",
      "displayEpoch: lineage.display_epoch",
      "nativeAccountDeletionBarrier = recoveredLifecycle",
    ],
    "native deletion journals must reconstruct exact prebind lifecycle ownership without premature finalization",
  );
  forbidSourceInvariant(
    deletionPrebindRecovery,
    "finalizeAccountMutation(",
    "deletion prebind recovery must not finalize before server acknowledgement is proven",
  );
  const nativeStartupRecoveryOrder = requiredSlice(
    providers,
    "const reconcileNativeStartup = async () =>",
    "await awaitNativeStartup(",
    "native startup recovery authority order",
  );
  requireOrderedInvariants(
    nativeStartupRecoveryOrder,
    [
      "initializeNativeNotificationRuntime()",
      "prepareNativeTerminalRecovery()",
      "nativeAuthPreparation === 'journal_pending'",
      "recoverNativeAccountDeletionBeforeSessionBind(runtime)",
      "refreshNativeAuthSession()",
    ],
    "native-auth journal recovery must precede deletion lineage recovery and session publication",
  );
  const deletionBindFence = requiredSlice(
    providers,
    "async function bindNativeNotificationSession(",
    "async function beginNativeAccountMutation(",
    "native deletion bind fence",
  );
  requireOrderedInvariants(
    deletionBindFence,
    [
      "recoverNativeAccountDeletionBeforeSessionBind(runtime)",
      "return 'blocked'",
      "runtime.native.bindSession(",
    ],
    "native session bind must not overtake a durable deletion journal",
  );
  const nativeBinderPublicationFence = requiredSlice(
    nativeAuthClient,
    "async function commitStagedNativeAuthSession(",
    "async function purgeNativeSessionAfterGenerationPublicationFailure(",
    "native binder publication fence",
  );
  requireOrderedInvariants(
    nativeBinderPublicationFence,
    [
      "let bindResult: NativeAuthSessionBindResult = 'failed'",
      "bindResult = await binder.bindSession(staged.session)",
      "bindResult !== 'bound'",
      "if (bindResult === 'blocked')",
      "stagedSession = null",
      "return false",
      "await failStagedNativeSession(staged, true)",
    ],
    "a deletion-blocked binder must reject publication without synthesizing an unowned mutation",
  );
  const deletionRequestDispatch = requiredSlice(
    accountDeletionPage,
    "async function requestDeletion(",
    "const startRequestReauth = async (",
    "deletion request dispatch",
  );
  requireOrderedInvariants(
    deletionRequestDispatch,
    [
      "revalidateDispatchCapability(",
      "advanceDeletionOperation(existing, 'native_begin_pending')",
      "persistOperation(storage, nextOperation)",
      "ensureNativeAccountDeletionBarrier()",
      "advanceDeletionOperation(nextOperation, 'sending')",
      "persistOperation(storage, nextOperation)",
      "requestSent = true",
      "authApi.post<unknown>(",
      "'/v1/account-deletion/requests'",
    ],
    "deletion dispatch must persist reauth and native-begin boundaries before server send",
  );
  forbidSourceInvariant(
    deletionRequestDispatch,
    "finalizeNativeAccountDeletionBarrier(",
    "deletion request setup must never finalize native ownership before server acknowledgement",
  );
  const deletionReauthIntent = requiredSlice(
    accountDeletionPage,
    "const startRequestReauth = async (",
    "const startCancellationReauth = async (",
    "deletion reauthentication intent",
  );
  requireOrderedInvariants(
    deletionReauthIntent,
    [
      "createDeletionReauthOperation(createIdempotencyKey())",
      "persistOperation(storage, nextOperation)",
      "readReauthTransactionArtifact(storage)",
      "createReauthTransactionIntent(",
      "storeReauthTransactionIntent(storage, intent)",
      "'authorizationUrl' in reauthAttempt",
      "createCodeChallenge(reauthAttempt.codeVerifier)",
      "api.post<unknown>(",
      "'/v1/account-deletion/reauth/transactions'",
      "'Idempotency-Key': reauthAttempt.transactionIdempotencyKey",
      "storeReauthTransient(storage, transient)",
    ],
    "request reauthentication must persist and replay one exact pre-dispatch transaction owner",
  );
  forbidSourceInvariant(
    deletionReauthIntent,
    "clearReauthArtifacts(storage)",
    "an ambiguous request reauthentication dispatch must retain its exact durable transaction owner",
  );
  const deletionCancellationReauthIntent = requiredSlice(
    accountDeletionPage,
    "const startCancellationReauth = async (",
    "const localCleanupMessage",
    "deletion cancellation reauthentication intent",
  );
  requireOrderedInvariants(
    deletionCancellationReauthIntent,
    [
      "readReauthTransactionArtifact(storage)",
      "createReauthTransactionIntent(",
      "'cancel'",
      "storeReauthTransactionIntent(storage, intent)",
      "'authorizationUrl' in reauthAttempt",
      "createCodeChallenge(reauthAttempt.codeVerifier)",
      "authApi.post<unknown>(",
      "'/v1/account-deletion/reauth/transactions'",
      "'Idempotency-Key': reauthAttempt.transactionIdempotencyKey",
      "'X-Deletion-Status-Handle': storedStatus.statusHandle",
      "storeReauthTransient(storage, transient)",
    ],
    "cancellation reauthentication must persist and replay one exact pre-dispatch transaction owner",
  );
  forbidSourceInvariant(
    deletionCancellationReauthIntent,
    "clearReauthArtifacts(storage)",
    "an ambiguous cancellation reauthentication dispatch must retain its exact durable transaction owner",
  );
  requireSourceInvariant(
    nativeAuthClient,
    "export function releaseNativeAuthSessionAfterDeletionCancellation(): void",
    "completed cancellation must reopen native session publication in the same process",
  );

  requireSourceInvariant(
    contract,
    "public_title: {type: string, minLength: 1, maxLength: 512}",
    "the display title contract must remain 512 characters",
  );
  requireSourceInvariant(
    contract,
    "token_generation: {type: integer, minimum: 1, maximum: 9007199254740991}",
    "display authorization token generations must remain positive JavaScript-safe integers",
  );
  requireSourceInvariant(
    contract,
    "expected_token_generation: {type: integer, minimum: 0, maximum: 9007199254740991}",
    "installation token generations must remain nonnegative JavaScript-safe integers",
  );
  requireSourceInvariant(
    contract,
    "1844674407370955161[0-5])$",
    "display epochs must use the exact canonical uint64 range",
  );
  requireSourceInvariant(
    contract,
    "native_bound_session: positive JavaScript-safe integer; the coordinator remains closed while the API reports zero",
    "installation generation zero must not open native display authority",
  );

  const generationDefinitions =
    contract.match(/\b(?:expected_)?(?:binding|token)_generation: \{[^}\n]+\}/g) ?? [];
  if (
    generationDefinitions.length !== 17
    || generationDefinitions.some(
      (definition) =>
        !/minimum: [01], maximum: 9007199254740991\}$/.test(definition),
    )
  ) {
    throw new Error(
      "Every OpenAPI binding/token generation schema must use the JavaScript-safe maximum.",
    );
  }
  const contractEpochPatterns = [
    ...contract.matchAll(
      /client_display_epoch: \{type: string, pattern: '([^']+)'\}/g,
    ),
  ].map((match) => match[1]);
  if (
    contractEpochPatterns.length !== 2
    || contractEpochPatterns[0] !== contractEpochPatterns[1]
  ) {
    throw new Error(
      "OpenAPI request and response display epochs must share one exact schema.",
    );
  }

  const androidColdLaunchGate = requiredSlice(
    androidLaunchGate,
    "private void continueLaunch(Intent incoming)",
    "private void showRecovery()",
    "Android cold-launch activity",
  );
  requireOrderedInvariants(
    androidColdLaunchGate,
    [
      "MainActivity.sanitizedLaunchIntent",
      "NativeNotificationCoordinatorPlugin.quarantineColdNotificationTap",
      "NativeNotificationCoordinatorPlugin.runUiColdLaunchPreflight",
      "startActivity(sanitized)",
    ],
    "Android must quarantine taps and reconcile privacy before launching the bridge activity",
  );

  const androidOnCreate = requiredSlice(
    androidMainActivity,
    "public void onCreate(Bundle savedInstanceState)",
    "protected void onNewIntent(Intent intent)",
    "Android launch preflight",
  );
  requireOrderedInvariants(
    androidOnCreate,
    [
      "NativeNotificationCoordinatorPlugin.quarantineColdNotificationTap",
      "NativeNotificationCoordinatorPlugin.runUiColdLaunchPreflight",
      "registerPlugin(NativeNotificationCoordinatorPlugin.class)",
      "super.onCreate(savedInstanceState)",
    ],
    "Android must complete full UI cold-launch preflight before creating the WebView",
  );
  forbidSourceInvariant(
    androidOnCreate,
    "runStartupPreflight",
    "Android MainActivity must not use runtime-only launch preflight",
  );

  const androidNotificationPendingIntent = requiredSlice(
    androidCoordinator,
    "private void postNotification(int id, String title, String deliveryId, String noticeId, String displayEpoch)",
    "private void createNotificationChannel()",
    "Android notification PendingIntent",
  );
  requireOrderedInvariants(
    androidNotificationPendingIntent,
    [
      "new Intent(context, LaunchGateActivity.class)",
      "PendingIntent.getActivity(",
      ".setContentIntent(pendingIntent)",
    ],
    "Android notification taps must enter the cold-launch gate before the bridge",
  );
  forbidSourceInvariant(
    androidNotificationPendingIntent,
    "new Intent(context, MainActivity.class)",
    "Android notification PendingIntent must not bypass LaunchGateActivity",
  );

  const androidLaunchPreflight = requiredSlice(
    androidCoordinator,
    "private boolean launchPreflightLocked()",
    "private boolean bootstrapLocked()",
    "Android persisted-state launch preflight",
  );
  requireOrderedInvariants(
    androidLaunchPreflight,
    [
      "state = null;",
      "ensureLoadedLocked()",
      "reconcileLoadedStateLocked()",
      "uiColdLaunchReconciled = true;",
      "runtimeReady = true;",
    ],
    "Android must reload and reconcile persisted state before opening the bridge",
  );
  const androidMissingStateBootstrap = requiredSlice(
    androidCoordinator,
    "private boolean allAllowlistedCredentialsAbsentLocked()",
    "private void purgeCorruptStateLocked()",
    "Android missing-state credential guard",
  );
  requireOrderedInvariants(
    androidMissingStateBootstrap,
    [
      '"zerotime.native-auth.refresh.v1"',
      '"zerotime.native-auth.session.v1"',
      '"zerotime.native-auth.transient.v1"',
      '"zerotime.native-auth.privacy-barrier-failed.v1"',
      '"zerotime.native-auth.corrupt-session-audit.v1"',
      '"zerotime.account-deletion.status.v1"',
      '"zerotime.account-deletion.operation.v1"',
      '"zerotime.account-deletion.operation.audit.v1"',
      '"zerotime.account-deletion.native-reauth-handoff.v1"',
      "loaded.kind == StateLoadResult.MISSING && allAllowlistedCredentialsAbsentLocked()",
      "State.initial(",
      "State.corruptRecovery(",
      "purgeCorruptStateLocked()",
    ],
    "Android may initialize a fresh lineage only after proving every secure credential namespace absent",
  );

  const androidReconciliation = requiredSlice(
    androidCoordinator,
    "private boolean reconcileLoadedStateLocked()",
    "private boolean ensureLoadedLocked()",
    "Android next-launch reconciliation",
  );
  requireOrderedInvariants(
    androidReconciliation,
    [
      "closing.displayEpoch = incrementEpoch(closing.displayEpoch);",
      "closing.admission = State.ADMISSION_CLOSING;",
      "State.MUTATION_BOUND.equals(closing.mutationPhase)",
      "closing.mutationPhase = State.MUTATION_DORMANT_REBIND",
      "closing.mutationReason = null",
      "closing.nextLaunchPurge = true;",
      "persist(closing);",
      "purgeAndCloseLocked(closing, closing.mutationPhase, closing.mutationReason)",
      "zeroCountsLocked().isZero()",
    ],
    "Android must durably increment, close, purge, and verify zero at launch",
  );

  const androidRuntimeReadiness = requiredSlice(
    androidCoordinator,
    "private boolean ensureRuntimeReadinessLocked()",
    "private void invalidateBootstrapSuccessLocked()",
    "Android runtime readiness",
  );
  requireOrderedInvariants(
    androidRuntimeReadiness,
    [
      "if (runtimeReady)",
      "ensureLoadedLocked()",
      "pruneExpiredLocked(",
      "runtimeReady = true;",
    ],
    "Android warm runtime readiness must be idempotent",
  );
  forbidSourceInvariant(
    androidRuntimeReadiness,
    "reconcileLoadedStateLocked()",
    "Android warm runtime readiness must not repeat cold-launch reconciliation",
  );

  const androidGenerationRebound = requiredSlice(
    androidCoordinator,
    "JSObject updateSessionGenerations(JSObject input)",
    "JSObject beginDisplayAuthorization(JSObject input)",
    "Android generation rebound",
  );
  requireOrderedInvariants(
    androidGenerationRebound,
    [
      "closing.displayEpoch = incrementEpoch(closing.displayEpoch);",
      "closing.mutationPhase = State.MUTATION_DORMANT_REBIND;",
      "closing.mutationReason = null;",
      "persist(closing);",
      "purgeAndCloseLocked(closing, State.MUTATION_DORMANT_REBIND, null)",
      "rebound.admission = State.ADMISSION_OPEN;",
      "rebound.mutationPhase = State.MUTATION_BOUND;",
      "persist(rebound);",
      "activeSessionId = sessionId;",
    ],
    "Android generation updates must restore a fresh runtime binding",
  );
  forbidSourceInvariant(
    androidGenerationRebound,
    "purgeAndCloseLocked(closing, State.MUTATION_UNBOUND, null)",
    "Android generation recovery must not misclassify retained credentials as unbound",
  );
  forbidSourceInvariant(
    androidGenerationRebound,
    "invalidateBootstrapSuccessLocked()",
    "Android generation rebound must not invalidate runtime readiness",
  );

  const androidReceiveDataOnly = requiredSlice(
    androidCoordinator,
    "void receiveDataOnlyPush(Map<String, String> data)",
    "void handleNotificationTap(Intent intent)",
    "Android data-only receive",
  );
  requireOrderedInvariants(
    androidReceiveDataOnly,
    [
      "quarantineColdPayloadLocked(payload, QuarantinedPayload.KIND_DATA_ONLY);",
      "headlessFcmBootstrapLocked();",
    ],
    "Android killed-process data-only delivery must quarantine identifiers before bootstrap",
  );
  const androidHeadlessReceiveBranch = requiredSlice(
    androidReceiveDataOnly,
    "if (!uiColdLaunchReconciled && plugin.get() == null)",
    "if (!bootstrapLocked())",
    "Android headless data-only receive branch",
  );
  if (
    compactJavaSource(androidHeadlessReceiveBranch)
    !== compactJavaSource(`
      if (!uiColdLaunchReconciled && plugin.get() == null) {
        quarantineColdPayloadLocked(payload, QuarantinedPayload.KIND_DATA_ONLY);
        headlessFcmBootstrapLocked();
        return;
      }
    `)
  ) {
    throw new Error(
      "Native coordinator invariant is violated: Android headless receive branch must only quarantine identifiers and enter dormant bootstrap.",
    );
  }

  const androidHeadlessBootstrap = requiredSlice(
    androidCoordinator,
    "private boolean headlessFcmBootstrapLocked()",
    "private boolean enterDormantRebindForHeadlessPayloadLocked()",
    "Android headless FCM bootstrap",
  );
  requireOrderedInvariants(
    androidHeadlessBootstrap,
    [
      "ensureLoadedLocked()",
      "validatedEmbeddedReleaseApiOrigin()",
      "enterDormantRebindForHeadlessPayloadLocked()",
      "ready = isDormantRecoveryStateLocked()",
      "runtimeReady = true;",
      "headlessFcmBootstrapSucceeded = true;",
    ],
    "Android headless FCM must validate release trust and remain dormant until a verified UI bind",
  );
  if (
    compactJavaSource(androidHeadlessBootstrap)
    !== compactJavaSource(`
      private boolean headlessFcmBootstrapLocked() {
        if (headlessFcmBootstrapAttempted) {
          if (!headlessFcmBootstrapSucceeded) {
            clearColdPayloadQuarantineLocked();
          }
          return headlessFcmBootstrapSucceeded;
        }
        headlessFcmBootstrapAttempted = true;
        clearReleaseTrustAndCancelWorkLocked();
        if (!ensureLoadedLocked()) {
          clearColdPayloadQuarantineLocked();
          return false;
        }
        try {
          pruneExpiredLocked(System.currentTimeMillis());
          String apiOrigin = validatedEmbeddedReleaseApiOrigin();
          if (state == null || state.localPrivacyBarrierFailed || state.corruptState || apiOrigin == null) {
            clearColdPayloadQuarantineLocked();
            return false;
          }
          releaseValidated = true;
          validatedApiOrigin = apiOrigin;
          boolean ready;
          if (isPersistedAdmissionOpenLocked()) {
            ready = enterDormantRebindForHeadlessPayloadLocked();
          } else {
            ready = isDormantRecoveryStateLocked();
          }
          if (!ready) {
            clearColdPayloadQuarantineLocked();
            clearReleaseTrustAndCancelWorkLocked();
            return false;
          }
          runtimeReady = true;
          headlessFcmBootstrapSucceeded = true;
          return true;
        } catch (GeneralSecurityException | JSONException | IllegalStateException exception) {
          clearColdPayloadQuarantineLocked();
          failClosedLocked();
          return false;
        }
      }
    `)
  ) {
    throw new Error(
      "Native coordinator invariant is violated: Android headless bootstrap must match the reviewed dormant-only call structure.",
    );
  }
  const androidHeadlessDormantTransition = requiredSlice(
    androidCoordinator,
    "private boolean enterDormantRebindForHeadlessPayloadLocked()",
    "private boolean isDormantRecoveryStateLocked()",
    "Android headless dormant transition",
  );
  requireOrderedInvariants(
    androidHeadlessDormantTransition,
    [
      "closing.mutationPhase = State.MUTATION_DORMANT_REBIND",
      "persist(closing)",
      "purgeAndCloseLocked(closing, State.MUTATION_DORMANT_REBIND, null)",
      "return isDormantRecoveryStateLocked()",
    ],
    "Android headless recovery must persist and purge dormant state without rotating credentials",
  );
  if (
    compactJavaSource(androidHeadlessDormantTransition)
    !== compactJavaSource(`
      private boolean enterDormantRebindForHeadlessPayloadLocked()
          throws GeneralSecurityException, JSONException {
        if (state == null || state.displayEpoch.equals(MAX_UINT64.toString())) {
          return false;
        }
        State closing = state.copy();
        closing.displayEpoch = incrementEpoch(closing.displayEpoch);
        closing.admission = State.ADMISSION_CLOSING;
        closing.sessionMarker = null;
        closing.mutationPhase = State.MUTATION_DORMANT_REBIND;
        closing.mutationReason = null;
        closing.nextLaunchPurge = true;
        persist(closing);
        if (!purgeAndCloseLocked(closing, State.MUTATION_DORMANT_REBIND, null)) {
          return false;
        }
        return isDormantRecoveryStateLocked();
      }
    `)
  ) {
    throw new Error(
      "Native coordinator invariant is violated: Android headless dormant transition must match the reviewed close-persist-purge structure.",
    );
  }
  const androidAuthorizationCompletion = requiredSlice(
    androidCoordinator,
    "private void completeAuthorizationNetworkLocked(",
    "private AuthorizationResponse authorizeOperationOverNetwork(",
    "Android authorization completion",
  );
  requireOrderedInvariants(
    androidAuthorizationCompletion,
    [
      "RegistryEntry.PHASE_SCHEDULING",
      "persist(scheduling)",
      "postNotification(",
      "authorizationRequestMatchesSchedulingStateLocked(request)",
      "RegistryEntry.PHASE_SCHEDULED",
      "persist(scheduled)",
    ],
    "Android notification display sink must remain inside the admitted scheduling transaction",
  );
  for (const [callee, expected] of [
    ["postNotification", 2],
    ["notify", 1],
    ["authorizeOperationOverNetwork", 2],
    ["startAuthorizationNetworkLocked", 3],
    ["beginDisplayAuthorization", 3],
    ["scheduleAuthorizedNotification", 3],
    ["releaseColdPayloadAfterVerifiedRebindLocked", 3],
    ["bindSession", 3],
  ]) {
    const actual = countCallExpressions(androidCoordinator, callee, false);
    if (actual !== expected) {
      throw new Error(
        `Native coordinator invariant is violated: Android sensitive call ${callee} must appear exactly ${expected} times in its reviewed declaration/call sites, found ${actual}.`,
      );
    }
  }
  for (const forbidden of [
    "ColdRefreshRequest",
    "NativeRefreshResponse",
    '"/v1/native-auth/refresh"',
    "rotateRefreshCredential(",
  ]) {
    forbidSourceInvariant(
      androidCoordinator,
      forbidden,
      "Android headless recovery must leave credential refresh to the crash-safe JavaScript bind path",
    );
  }
  requireSourceInvariant(
    androidCoordinator,
    `"${canonicalContractDigest}"`,
    "Android embedded release trust pins the computed canonical contract digest",
  );
  requireSourceInvariant(
    iosCoordinator,
    `"${canonicalContractDigest}"`,
    "iOS embedded release trust pins the computed canonical contract digest",
  );
  requireSourceInvariant(
    iosProject,
    `MOBILE_RELEASE_CONTRACT_SHA256 = ${canonicalContractDigest};`,
    "iOS Release Info.plist embeds the computed canonical contract digest",
  );
  requireSourceInvariant(
    mobileReleaseClient,
    `'${canonicalContractDigest}'`,
    "JavaScript release manifest pins the computed canonical contract digest",
  );
  requireSourceInvariant(
    androidCoordinator,
    "State.MUTATION_DORMANT_REBIND.equals(state.mutationPhase)",
    "Android dormant rebind is distinct from credential-empty account switch",
  );

  const androidBindSession = requiredSlice(
    androidCoordinator,
    "JSObject bindSession(JSObject input)",
    "JSObject updateSessionGenerations(JSObject input)",
    "Android bound-session validation",
  );
  requireSourceInvariant(
    androidBindSession,
    'positiveJsSafeInteger(input.opt("token_generation"))',
    "Android bound sessions require a positive token generation",
  );
  requireOrderedInvariants(
    androidBindSession,
    [
      "if (reestablishingDormantBound)",
      "closing.admission = State.ADMISSION_CLOSING",
      "closing.mutationPhase = State.MUTATION_DORMANT_REBIND",
      "closing.mutationReason = null",
      "persist(closing)",
      "purgeAndCloseLocked(closing, State.MUTATION_DORMANT_REBIND, null)",
      "next.mutationPhase = State.MUTATION_BOUND",
      "persist(next)",
      "activeSessionId = sessionId",
      "authorizationBearer = bearer",
      "releaseColdPayloadAfterVerifiedRebindLocked()",
    ],
    "Android generic session reestablishment must retain dormant credential provenance until rebound",
  );

  const androidCredentialRead = requiredSlice(
    androidCoordinator,
    "String loadCredential(String key)",
    "void saveCredential(String key, String value)",
    "Android secure credential read",
  );
  requireOrderedInvariants(
    androidCredentialRead,
    [
      "bootstrapLocked()",
      "hasVerifiedCredentialAbsenceLocked(key)",
      "return null;",
      "canReadCredentialLocked(key)",
      "stateStore.loadCredential(key)",
    ],
    "Android account-switch reads must prove absence without loading stale credentials",
  );
  requireSourceInvariant(
    androidCoordinator,
    "State.MUTATION_READY_FOR_RELOGIN.equals(state.mutationPhase)\n                    || State.MUTATION_READY_FOR_REBIND.equals(state.mutationPhase)\n                    || State.MUTATION_TERMINAL.equals(state.mutationPhase)",
    "Android completed logout, switch, and cancelled-deletion states must admit a fresh OAuth transient read",
  );
  requireSourceInvariant(
    androidCoordinator,
    "State.MUTATION_READY_FOR_REBIND.equals(state.mutationPhase)\n                    || State.MUTATION_TERMINAL.equals(state.mutationPhase)) {\n                return isTransientCredential(key) || isPrivacyBarrierCredential(key);",
    "Android completed account switch and cancelled deletion must admit a fresh OAuth transient write",
  );
  const androidCredentialDelete = requiredSlice(
    androidCoordinator,
    "void deleteCredential(String key)",
    "private boolean credentialPhaseAvailableLocked()",
    "Android secure credential deletion",
  );
  requireOrderedInvariants(
    androidCredentialDelete,
    [
      "State.MUTATION_TERMINAL.equals(state.mutationPhase)",
      "isDeletionLifecycleCredential(key)",
      "stateStore.removeCredential(key)",
      "isTransientCredential(key)",
      "stateStore.removeCredential(key)",
      "isRefreshOrSessionCredential(key)",
      "stateStore.loadCredential(key) != null",
      'throw new GeneralSecurityException("Completed mutation retained a secure credential.")',
    ],
    "Android terminal cancellation must delete fresh OAuth transients while rejecting retained refresh or session credentials",
  );
  requireSourceInvariant(
    androidCoordinator,
    "credentialPhaseAvailableLocked() && isRefreshOrSessionCredential(key)\n                    && (State.MUTATION_UNBOUND.equals(state.mutationPhase)\n                    || State.isCompletedMutationPhase(state.mutationPhase))",
    "Android must verify refresh and session absence in credential-free unbound and completed phases",
  );
  const androidCredentialAccess = requiredSlice(
    androidCoordinator,
    "boolean credentialsAvailable()",
    "String displayPermission()",
    "Android recovery credential access",
  );
  requireOrderedInvariants(
    androidCredentialAccess,
    [
      "ensureLoadedLocked() && stateStore.markerStorageAvailable()",
      "if (isRecoveryCredential(key))",
      "stateStore.loadCredential(key)",
      "if (isRecoveryCredential(key))",
      "stateStore.saveCredential(key, value)",
      "if (isRecoveryCredential(key))",
      "stateStore.removeCredential(key)",
    ],
    "Android recovery evidence must remain accessible without exposing ordinary credentials",
  );
  for (const invariant of [
    '"zerotime.native-auth.privacy-barrier-failed.v1"',
    '"zerotime.native-auth.corrupt-session-audit.v1"',
    "return isPrivacyBarrierCredential(key) || isCorruptSessionAuditCredential(key)",
    "state != null && !state.localPrivacyBarrierFailed && !state.corruptState",
  ]) {
    requireSourceInvariant(
      androidCoordinator,
      invariant,
      "Android recovery keys and ordinary credential phase isolation",
    );
  }
  const androidBarrierRecovery = requiredSlice(
    androidCoordinator,
    "private boolean retryPrivacyBarrierRecoveryLocked()",
    "private boolean ensureLoadedLocked()",
    "Android failed privacy-barrier recovery",
  );
  requireOrderedInvariants(
    androidBarrierRecovery,
    [
      "state.localPrivacyBarrierFailed",
      "State.hasDurableMutationReceipt(state.mutationPhase, state.mutationReason)",
      "return resumeMutationReceiptRecoveryLocked()",
      "String mutationPhase = state.mutationPhase",
      "String mutationReason = state.mutationReason",
      "State.MUTATION_BOUND.equals(mutationPhase)",
      "mutationPhase = State.MUTATION_DORMANT_REBIND",
      "mutationReason = null",
      "String displayEpoch = state.displayEpoch",
      "purgeAndCloseLocked(closing, mutationPhase, mutationReason)",
      "State.ADMISSION_CLOSED.equals(state.admission)",
      "mutationPhase.equals(state.mutationPhase)",
      "displayEpoch.equals(state.displayEpoch)",
      "zeroCountsLocked().isZero()",
    ],
    "Android failed-barrier recovery must preserve lineage and prove durable five-zero closure",
  );

  const androidBarrierFailure = requiredSlice(
    androidCoordinator,
    "private void markBarrierFailureLocked()",
    "private void failClosedLocked()",
    "Android privacy-barrier failure persistence",
  );
  requireOrderedInvariants(
    androidBarrierFailure,
    [
      "State.MUTATION_BOUND.equals(failed.mutationPhase)",
      "failed.mutationPhase = State.MUTATION_DORMANT_REBIND",
      "failed.mutationReason = null",
      "failed.localPrivacyBarrierFailed = true",
      "persist(failed)",
    ],
    "Android generic barrier failure must not retain a bound mutation owner",
  );

  const androidAuthorization = requiredSlice(
    androidCoordinator,
    "static Receipt fromServer(JSONObject input)",
    "JSONObject toJson() throws JSONException",
    "Android display authorization receipt validation",
  );
  requireSourceInvariant(
    androidAuthorization,
    'positiveJsSafeInteger(installation.opt("token_generation"))',
    "Android authorization receipts require a positive token generation",
  );
  requireSourceInvariant(
    androidCoordinator,
    "if (++characterCount > 512)",
    "Android display titles accept the shared 512-character boundary",
  );

  const androidMutationBegin = requiredSlice(
    androidCoordinator,
    "JSObject beginAccountMutation(JSObject input)",
    "JSObject finalizeAccountMutation(JSObject input)",
    "Android account-mutation begin",
  );
  requireOrderedInvariants(
    androidMutationBegin,
    [
      "closing.displayEpoch = incrementEpoch(closing.displayEpoch);",
      "closing.admission = State.ADMISSION_CLOSING;",
      "closing.mutationPhase = State.MUTATION_AWAITING_FINALIZE;",
      "closing.mutationReason = reason;",
      "persist(closing);",
      "purgeAndCloseLocked(",
    ],
    "Android mutation begin must durably establish one awaiting-finalize epoch",
  );
  const androidMutationFinalize = requiredSlice(
    androidCoordinator,
    "JSObject finalizeAccountMutation(JSObject input)",
    "void receiveDataOnlyPush(Map<String, String> data)",
    "Android account-mutation finalize",
  );
  const androidMutationFinalizeBody = requiredSlice(
    androidMutationFinalize,
    "JSObject finalizeAccountMutation(JSObject input)",
    "private boolean ownsFinalizableMutationReceipt(",
    "Android account-mutation finalize body",
  );
  if (
    compactJavaSource(androidMutationFinalizeBody)
    !== compactJavaSource(`
      JSObject finalizeAccountMutation(JSObject input) {
        String reason = input == null ? null : mutationReason(input.opt("reason"));
        String displayEpoch = input == null ? null : canonicalUint64(input.opt("display_epoch"));
        if (input == null || !hasExactKeys(input, "reason", "display_epoch")
            || reason == null || displayEpoch == null) {
          return mutationResult(false);
        }
        State durable = state;
        if (durable == null) {
          StateLoadResult loaded = stateStore.loadReadOnly();
          durable = loaded.kind == StateLoadResult.VALID ? loaded.state : null;
        }
        if (!ownsFinalizableMutationReceipt(durable, reason, displayEpoch)
            || !bootstrapLocked() || !ownsFinalizableMutationReceipt(state, reason, displayEpoch)) {
          return mutationResult(false);
        }
        clearColdPayloadQuarantineLocked();
        clearVolatileSessionLocked();
        if (State.isCompletedMutationPhase(state.mutationPhase)) {
          try {
            cancelNetworkOperationsLocked();
            boolean replay = resumeMutationReceiptRecoveryLocked();
            if (!replay) {
              invalidateBootstrapSuccessLocked();
            }
            return mutationResult(replay);
          } catch (GeneralSecurityException | JSONException | IllegalStateException exception) {
            invalidateBootstrapSuccessLocked();
            markBarrierFailureLocked();
            return mutationResult(false);
          }
        }
        try {
          cancelNetworkOperationsLocked();
          State completed = state.copy();
          completed.admission = State.ADMISSION_CLOSING;
          completed.sessionMarker = null;
          completed.mutationReason = reason;
          completed.mutationPhase = State.REASON_ACCOUNT_SWITCH.equals(reason)
              ? State.MUTATION_READY_FOR_REBIND
              : "logout".equals(reason) ? State.MUTATION_READY_FOR_RELOGIN : State.MUTATION_TERMINAL;
          completed.nextLaunchPurge = true;
          persist(completed);
          boolean finalized = resumeMutationReceiptRecoveryLocked();
          if (!finalized) {
            invalidateBootstrapSuccessLocked();
          }
          return mutationResult(finalized);
        } catch (GeneralSecurityException | JSONException | IllegalStateException exception) {
          invalidateBootstrapSuccessLocked();
          markBarrierFailureLocked();
          return mutationResult(false);
        }
      }
    `)
  ) {
    throw new Error(
      "Native coordinator invariant is violated: Android mutation finalize must match the complete reviewed durable-owner transaction.",
    );
  }
  requireOrderedInvariants(
    androidMutationFinalize,
    [
      "State durable = state",
      "if (durable == null)",
      "stateStore.loadReadOnly()",
      "!ownsFinalizableMutationReceipt(durable, reason, displayEpoch)",
      "!bootstrapLocked()",
      "!ownsFinalizableMutationReceipt(state, reason, displayEpoch)",
      "return mutationResult(false)",
      "clearColdPayloadQuarantineLocked()",
      "clearVolatileSessionLocked()",
      "State.isCompletedMutationPhase(state.mutationPhase)",
      "resumeMutationReceiptRecoveryLocked()",
      "State completed = state.copy()",
      "completed.admission = State.ADMISSION_CLOSING",
      "completed.mutationReason = reason",
      "completed.mutationPhase =",
      "completed.nextLaunchPurge = true",
      "persist(completed)",
      "resumeMutationReceiptRecoveryLocked()",
    ],
    "Android mutation finalize must validate the exact owner before clearing volatile state and persist completion before credential wipe",
  );
  requireOrderedInvariants(
    androidMutationFinalize,
    [
      "private boolean ownsFinalizableMutationReceipt(",
      "State.ADMISSION_CLOSED.equals(candidate.admission)",
      "State.ADMISSION_CLOSING.equals(candidate.admission)",
      "State.hasDurableMutationReceipt(candidate.mutationPhase, candidate.mutationReason)",
      "reason.equals(candidate.mutationReason)",
      "displayEpoch.equals(candidate.displayEpoch)",
      "!candidate.localPrivacyBarrierFailed",
      "!candidate.corruptState",
    ],
    "Android mutation owner validation must authenticate exact durable phase, reason, and epoch",
  );
  requireSourceInvariant(
    androidMutationFinalize,
    'hasExactKeys(input, "reason", "display_epoch")',
    "Android mutation finalize must require the caller's begin epoch",
  );
  requireSourceInvariant(
    androidMutationFinalize,
    'canonicalUint64(input.opt("display_epoch"))',
    "Android mutation finalize must canonicalize the caller's epoch",
  );
  requireSourceInvariant(
    androidMutationFinalize,
    "displayEpoch.equals(candidate.displayEpoch)",
    "Android mutation finalize must authenticate the caller epoch against durable state",
  );
  forbidSourceInvariant(
    androidMutationFinalize,
    "incrementEpoch(",
    "Android mutation finalize must not advance the begin receipt epoch",
  );
  const androidFinalizeBootstrapCount =
    countCallExpressions(androidMutationFinalize, "bootstrapLocked", false);
  if (androidFinalizeBootstrapCount !== 1) {
    throw new Error(
      "Native coordinator invariant is violated: Android mutation finalize must bootstrap exactly once after durable owner validation.",
    );
  }
  const androidMutationRecovery = requiredSlice(
    androidCoordinator,
    "private boolean resumeMutationReceiptRecoveryLocked()",
    "private boolean retryPrivacyBarrierRecoveryLocked()",
    "Android durable mutation receipt recovery",
  );
  requireOrderedInvariants(
    androidMutationRecovery,
    [
      "String mutationPhase = state.mutationPhase",
      "String mutationReason = state.mutationReason",
      "String displayEpoch = state.displayEpoch",
      "persist(closing)",
      "stateStore.wipeAuthenticationCredentials()",
      "purgeAndCloseLocked(closing, mutationPhase, mutationReason)",
      "mutationPhase.equals(state.mutationPhase)",
      "mutationReason.equals(state.mutationReason)",
      "displayEpoch.equals(state.displayEpoch)",
      "zeroCountsLocked().isZero()",
    ],
    "Android completed recovery must wipe only authentication secrets and preserve exact five-zero lineage",
  );
  const androidMutationLineageQuery = requiredSlice(
    androidCoordinator,
    "JSObject getAccountMutationLineage()",
    "JSObject initialize(JSObject input)",
    "Android account-mutation lineage query",
  );
  for (const invariant of [
    "stateStore.loadReadOnly()",
    "boolean available = snapshot != null && displayEpoch != null",
    "State.hasDurableMutationReceipt(snapshot.mutationPhase, snapshot.mutationReason)",
    'result.put("available", available)',
    'result.put("active", active)',
    "State.MUTATION_AWAITING_FINALIZE.equals(snapshot.mutationPhase)",
    '? State.MUTATION_AWAITING_FINALIZE : "completed"',
    'result.put("reason", active ? snapshot.mutationReason : JSONObject.NULL)',
    'result.put("display_epoch", displayEpoch == null ? "0" : displayEpoch)',
    'result.put("zero_counts", counts.toJson())',
  ]) {
    requireSourceInvariant(
      androidMutationLineageQuery,
      invariant,
      "Android lineage query must distinguish unavailable, awaiting, completed, and proven no-owner state",
    );
  }
  requireSourceInvariant(
    androidCoordinator,
    'call.reject("Invalid account mutation lineage query.")',
    "Android lineage query must reject unexpected input",
  );
  const deletionCredentialKeys = [
    "zerotime.account-deletion.status.v1",
    "zerotime.account-deletion.operation.v1",
    "zerotime.account-deletion.operation.audit.v1",
    "zerotime.account-deletion.native-reauth-handoff.v1",
  ];
  const androidDeletionLifecycleClassifier = requiredSlice(
    androidCoordinator,
    "private static boolean isDeletionLifecycleCredential(String key)",
    "private static boolean isRecoveryCredential(String key)",
    "Android deletion lifecycle classifier",
  );
  requireExactMembers(
    [...androidDeletionLifecycleClassifier.matchAll(/"([^"]+)"\.equals\(key\)/g)]
      .map((match) => match[1]),
    deletionCredentialKeys,
    "Android deletion lifecycle classifier",
  );
  if (
    compactJavaSource(androidDeletionLifecycleClassifier)
    !== compactJavaSource(`
      private static boolean isDeletionLifecycleCredential(String key) {
        return "zerotime.account-deletion.status.v1".equals(key)
          || "zerotime.account-deletion.operation.v1".equals(key)
          || "zerotime.account-deletion.operation.audit.v1".equals(key)
          || "zerotime.account-deletion.native-reauth-handoff.v1".equals(key);
      }
    `)
  ) {
    throw new Error(
      "Native coordinator invariant is violated: Android deletion lifecycle classifier contains an extra active predicate.",
    );
  }
  const androidCredentialAllowlist = requiredSlice(
    androidCoordinator,
    "private static String secureCredentialKey(Object value)",
    "private static boolean isSecureCredentialValue(String value)",
    "Android secure credential allowlist",
  );
  requireExactMembers(
    [...androidCredentialAllowlist.matchAll(/"([^"]+)"\.equals\(key\)/g)]
      .map((match) => match[1]),
    [
      "zerotime.native-auth.transient.v1",
      "zerotime.native-auth.refresh.v1",
      "zerotime.native-auth.session.v1",
      "zerotime.native-auth.privacy-barrier-failed.v1",
      "zerotime.native-auth.corrupt-session-audit.v1",
      ...deletionCredentialKeys,
    ],
    "Android secure credential allowlist",
  );
  if (
    compactJavaSource(androidCredentialAllowlist)
    !== compactJavaSource(`
      private static String secureCredentialKey(Object value) {
        if (!(value instanceof String)) {
          return null;
        }
        String key = (String) value;
        return "zerotime.native-auth.transient.v1".equals(key)
          || "zerotime.native-auth.refresh.v1".equals(key)
          || "zerotime.native-auth.session.v1".equals(key)
          || "zerotime.native-auth.privacy-barrier-failed.v1".equals(key)
          || "zerotime.native-auth.corrupt-session-audit.v1".equals(key)
          || "zerotime.account-deletion.status.v1".equals(key)
          || "zerotime.account-deletion.operation.v1".equals(key)
          || "zerotime.account-deletion.operation.audit.v1".equals(key)
          || "zerotime.account-deletion.native-reauth-handoff.v1".equals(key)
          ? key : null;
      }
    `)
  ) {
    throw new Error(
      "Native coordinator invariant is violated: Android secure credential allowlist contains an extra active predicate.",
    );
  }
  requireSourceInvariant(
    androidCoordinator,
    "isDeletionLifecycleCredential(key)",
    "Android deletion lifecycle credentials must use normal phase policy",
  );
  const androidRecoveryLeafClassifiers = requiredSlice(
    androidCoordinator,
    "private static boolean isPrivacyBarrierCredential(String key)",
    "private static boolean isDeletionLifecycleCredential(String key)",
    "Android recovery leaf classifiers",
  );
  if (
    compactJavaSource(androidRecoveryLeafClassifiers)
    !== compactJavaSource(`
      private static boolean isPrivacyBarrierCredential(String key) {
        return "zerotime.native-auth.privacy-barrier-failed.v1".equals(key);
      }
      private static boolean isCorruptSessionAuditCredential(String key) {
        return "zerotime.native-auth.corrupt-session-audit.v1".equals(key);
      }
    `)
  ) {
    throw new Error(
      "Native coordinator invariant is violated: Android recovery leaf classifiers must be exact literal equality checks.",
    );
  }
  const androidRecoveryCredentialClassifier = requiredSlice(
    androidCoordinator,
    "private static boolean isRecoveryCredential(String key)",
    "String displayPermission()",
    "Android recovery-key classification",
  );
  if (
    compactJavaSource(androidRecoveryCredentialClassifier)
    !== "privatestaticbooleanisRecoveryCredential(Stringkey){returnisPrivacyBarrierCredential(key)||isCorruptSessionAuditCredential(key);}"
  ) {
    throw new Error(
      "Native coordinator invariant is violated: Android recovery-key classifier must contain exactly the two native recovery markers.",
    );
  }
  forbidSourceInvariant(
    androidRecoveryCredentialClassifier,
    "isDeletionLifecycleCredential",
    "Android deletion lifecycle credentials must never bypass failed-phase recovery policy",
  );
  const androidMutationReceiptState = requiredSlice(
    androidCoordinator,
    "private static final class State {",
    "private static final class StateLoadResult {",
    "Android durable completed mutation receipt",
  );
  requireOrderedInvariants(
    androidMutationReceiptState,
    [
      "String displayEpoch;",
      "String mutationPhase;",
      "String mutationReason;",
    ],
    "Android durable state must retain completed receipt epoch, phase, and reason",
  );
  requireSourceInvariant(
    androidMutationBegin,
    "State.isCompletedMutationPhase(state.mutationPhase)",
    "Android mutation begin must replay a completed durable receipt",
  );
  requireSourceInvariant(
    androidMutationFinalize,
    "State.isCompletedMutationPhase(state.mutationPhase)",
    "Android mutation finalize must replay a completed durable receipt",
  );
  requireSourceInvariant(
    androidMutationFinalize,
    "reason.equals(candidate.mutationReason)",
    "Android mutation replay must match the durable reason",
  );
  requireOrderedInvariants(
    androidBindSession,
    [
      "next.displayEpoch = incrementEpoch(next.displayEpoch);",
      "next.mutationPhase = State.MUTATION_BOUND;",
      "next.mutationReason = null;",
    ],
    "Android fresh bind must clear the completed receipt before reopening display",
  );

  const androidZeroCounts = requiredSlice(
    androidCoordinator,
    "private ZeroCounts zeroCountsForStateLocked(State source)",
    "private void compensateAmbiguousPostLocked()",
    "Android five-count enumeration",
  );
  for (const [invariant, label] of [
    ["source.pendingTaps.size() + source.handoffs.size()", "pending count"],
    ["activeZeroTimeNotificationCount()", "delivered count"],
    ["source.foregroundBannerCount", "foreground-banner count"],
    ["source.registry.size()", "registry count"],
    ["source.operations.size()", "inflight count"],
  ]) {
    requireSourceInvariant(androidZeroCounts, invariant, `Android ${label}`);
  }
  const androidAmbiguousPostRecovery = requiredSlice(
    androidCoordinator,
    "private void compensateAmbiguousPostLocked()",
    "private void discardOperationLocked(",
    "Android ambiguous-post recovery",
  );
  requireOrderedInvariants(
    androidAmbiguousPostRecovery,
    [
      "State.MUTATION_BOUND.equals(closing.mutationPhase)",
      "closing.mutationPhase = State.MUTATION_DORMANT_REBIND",
      "closing.mutationReason = null",
      "persist(closing)",
      "purgeAndCloseLocked(closing, closing.mutationPhase, closing.mutationReason)",
    ],
    "Android ambiguous generic recovery must preserve dormant credential provenance",
  );

  requireOrderedInvariants(
    iosAppDelegate,
    [
      "installLaunchGate()",
      "beginLaunchPreflight(",
      "NativeNotificationCoordinatorPlugin.runLaunchPreflight(",
      "self.window?.rootViewController = bridge",
    ],
    "iOS must keep the bridge behind native launch preflight",
  );

  const iosLaunchPreflight = requiredSlice(
    iosCoordinator,
    "private func preflightLocked() async -> Bool",
    "private func purgeAndCloseLocked(",
    "iOS persisted-state launch preflight",
  );
  requireOrderedInvariants(
    iosLaunchPreflight,
    [
      "let serialized = try stateStore.read()",
      "let ownerlessCredentialPhase",
      "credentialStore.hasRefreshOrSessionCredentials()",
      "let preservesCredentialRebindProvenance",
      "let needsDormantRebindCanonicalization",
      "|| needsDormantRebindCanonicalization",
      "current.displayEpoch += 1",
      "current.admission = .closing",
      "if preservesCredentialRebindProvenance",
      "current.mutationPhase = .dormantRebind",
      "current.mutationReason = nil",
      "current.nextLaunchPurge = true",
      "try persistLocked(current)",
      "purgeAndCloseLocked(phase: current.mutationPhase, reason: current.mutationReason)",
    ],
    "iOS must durably increment, close, and purge persisted dirty state before content",
  );
  const iosMissingStateCredentialGuard = requiredSlice(
    iosCoordinator,
    "func allAllowedCredentialsAreAbsent() throws -> Bool",
    "func read(key: String) throws -> String?",
    "iOS missing-state credential scan",
  );
  requireOrderedInvariants(
    iosMissingStateCredentialGuard,
    [
      "for key in Self.allowedKeys",
      "SecItemCopyMatching(query as CFDictionary, nil)",
      "status == errSecItemNotFound",
      "status == errSecSuccess",
      "throw KeychainCredentialError.read(status)",
    ],
    "iOS must query every allowlisted Keychain namespace before treating state as first install",
  );
  requireOrderedInvariants(
    iosLaunchPreflight,
    [
      "let serialized = try stateStore.read()",
      "} else {",
      "credentialStore.allAllowedCredentialsAreAbsent()",
      "NotificationDurableState.corruptRecovery()",
      "purgeAndCloseLocked(phase: .corruptFailure, reason: nil)",
      "return false",
      "NotificationDurableState.initial()",
    ],
    "iOS may initialize a fresh lineage only after proving every secure credential namespace absent",
  );

  const iosPurgeAndClose = requiredSlice(
    iosCoordinator,
    "private func purgeAndCloseLocked(",
    "private func zeroCountsLocked()",
    "iOS purge and zero barrier",
  );
  requireOrderedInvariants(
    iosPurgeAndClose,
    [
      "closing.admission = .closing",
      "closing.nextLaunchPurge = true",
      "try persistLocked(closing)",
      "removeRequestsAndVerify(",
      "purgeAllAppNotifications()",
      "cleared.admission = .closing",
      "cleared.nextLaunchPurge = true",
      "try persistLocked(cleared)",
      "guard (await zeroCountsLocked()).isZero",
      "closed.admission = .closed",
      "closed.nextLaunchPurge = false",
      "try persistLocked(closed)",
    ],
    "iOS purge must persist cleared state and verify all counts before durable close",
  );

  const iosZeroCounts = requiredSlice(
    iosCoordinator,
    "private func zeroCountsLocked() async -> ZeroCounts",
    "private func mutationResultLocked(",
    "iOS five-count enumeration",
  );
  for (const [invariant, label] of [
    ["pending: platform.pending", "pending count"],
    ["delivered: platform.delivered", "delivered count"],
    ["foreground: state.foregroundPresentationIDs.count", "foreground-banner count"],
    ["registry: state.registry.count", "registry count"],
    [
      "inflight: state.operations.count + state.handoffs.count + state.pendingTaps.count",
      "inflight count",
    ],
  ]) {
    requireSourceInvariant(iosZeroCounts, invariant, `iOS ${label}`);
  }
  requireSourceInvariant(
    iosCoordinator,
    "\n    }\n\n    private func dropReservationLocked(",
    "iOS tap-prune method must close before the next helper",
  );

  const iosBindSession = requiredSlice(
    iosCoordinator,
    "@objc func bindSession(_ call: CAPPluginCall)",
    "@objc func updateSessionGenerations(_ call: CAPPluginCall)",
    "iOS bound-session validation",
  );
  requireSourceInvariant(
    iosBindSession,
    'Self.positiveSafeInteger(call.options["token_generation"])',
    "iOS bound sessions require a positive token generation",
  );
  const iosFinalizePluginCall = requiredSlice(
    iosCoordinator,
    "@objc func finalizeAccountMutation(_ call: CAPPluginCall)",
    "@objc func getDisplayPermission(_ call: CAPPluginCall)",
    "iOS mutation-finalize plugin input",
  );
  requireOrderedInvariants(
    iosFinalizePluginCall,
    [
      'Self.hasExactlyKeys(call.options, ["reason", "display_epoch"])',
      'Self.canonicalDisplayEpoch(call.options["display_epoch"])',
      "finalizeAccountMutation(reason, displayEpoch: displayEpoch)",
    ],
    "iOS mutation finalize must pass the caller's canonical begin epoch to native",
  );

  const iosDurableBindSession = requiredSlice(
    iosCoordinator,
    "func bindSession(\n        sessionID: String,",
    "func updateSessionGenerations(",
    "iOS durable session binding",
  );
  requireOrderedInvariants(
    iosDurableBindSession,
    [
      "next.displayEpoch += 1",
      "next.mutationPhase = .bound",
      "next.mutationReason = nil",
      "try self.persistLocked(next)",
      "self.activeSessionID = sessionID",
      "self.authorizationBearer = authorizationBearer",
      "self.releaseColdPayloadAfterVerifiedRebindLocked()",
    ],
    "iOS fresh bind must clear the completed receipt before reopening display",
  );
  const iosColdPayloadRetention = requiredSlice(
    iosCoordinator,
    "private func retainColdPayloadOnlyWhileDormantRebindLocked() -> Bool",
    "private func releaseColdPayloadAfterVerifiedRebindLocked() -> Bool",
    "iOS cold payload dormant retention",
  );
  requireOrderedInvariants(
    iosColdPayloadRetention,
    [
      "state.mutationPhase == .dormantRebind",
      "isCleanClosedNonterminalStateLocked(state)",
      "clearColdPayloadQuarantine()",
      "pruneColdPayloadQuarantine(",
      "return coldPayloadQuarantine != nil",
    ],
    "iOS cold payload quarantine must survive only in clean closed dormant state",
  );
  const iosColdPayloadRelease = requiredSlice(
    iosCoordinator,
    "private func releaseColdPayloadAfterVerifiedRebindLocked() -> Bool",
    "private func isPersistedAdmissionOpenLocked() -> Bool",
    "iOS cold payload verified-bind release",
  );
  requireOrderedInvariants(
    iosColdPayloadRelease,
    [
      "takeColdPayloadQuarantine()",
      "isDisplayAdmittedLocked()",
      "next.admission == .open",
      "next.mutationPhase == .bound",
      "displayEpoch: next.displayEpoch",
      "try persistLocked(next)",
    ],
    "iOS cold payload quarantine must bind to the fresh persisted epoch only after verified UI bind",
  );
  const iosGenerationRecovery = requiredSlice(
    iosCoordinator,
    "func updateSessionGenerations(",
    "func receiveAPNSDataOnlyPayload(",
    "iOS generation recovery",
  );
  requireOrderedInvariants(
    iosGenerationRecovery,
    [
      "let authVersion = closing.authVersion",
      "closing.displayEpoch += 1",
      "closing.admission = .closing",
      "closing.mutationPhase = .dormantRebind",
      "closing.mutationReason = nil",
      "try self.persistLocked(closing)",
      "purgeAndCloseLocked(phase: .dormantRebind, reason: nil)",
      "rebound.admission = .open",
      "rebound.mutationPhase = .bound",
      "rebound.mutationReason = nil",
      "rebound.authVersion = authVersion",
      "try self.persistLocked(rebound)",
    ],
    "iOS generation recovery must retain dormant credential provenance until rebound",
  );
  forbidSourceInvariant(
    iosGenerationRecovery,
    "purgeAndCloseLocked(phase: .readyForRebind, reason: nil)",
    "iOS generation recovery must not misclassify retained credentials as ready-for-rebind",
  );

  const iosCredentialRead = requiredSlice(
    iosCoordinator,
    "func getSecureCredential(key: String) async -> [String: Any]",
    "func setSecureCredential(_ value: String, key: String) async -> [String: Any]",
    "iOS secure credential read",
  );
  requireOrderedInvariants(
    iosCredentialRead,
    [
      "preflightLocked()",
      "hasVerifiedCredentialAbsenceLocked(key: key)",
      'return ["value": NSNull()]',
      "credentialOperationPermittedLocked(key: key, operation: .read)",
      "credentialStore.read(key: key)",
    ],
    "iOS account-switch reads must prove absence without loading stale credentials",
  );
  requireSourceInvariant(
    iosCoordinator,
    "(state.mutationPhase == .unbound && state.mutationReason == nil)\n                    || (state.mutationPhase == .readyForRebind && state.mutationReason == nil)",
    "iOS must verify refresh and session absence in credential-free unbound and completed phases",
  );
  const iosCredentialAccess = requiredSlice(
    iosCoordinator,
    "func secureCredentialStorageAvailability() async -> [String: Any]",
    "private func preflightLocked() async -> Bool",
    "iOS recovery credential access",
  );
  requireOrderedInvariants(
    iosCredentialAccess,
    [
      '["available": NativeNotificationCoordinatorPlugin.credentialStore.isAvailable()]',
      "KeychainCredentialStore.isRecoveryKey(key)",
      "credentialStore.read(key: key)",
      "KeychainCredentialStore.isRecoveryKey(key)",
      "credentialStore.write(value, key: key)",
      "KeychainCredentialStore.isRecoveryKey(key)",
      "credentialStore.remove(key: key)",
    ],
    "iOS recovery evidence must remain accessible without exposing ordinary credentials",
  );
  for (const invariant of [
    '"zerotime.native-auth.privacy-barrier-failed.v1"',
    '"zerotime.native-auth.corrupt-session-audit.v1"',
    "isPrivacyBarrierFailureKey(key) || key == corruptSessionAuditKey",
    "!state.localPrivacyBarrierFailed",
    "!state.corruptState",
  ]) {
    requireSourceInvariant(
      iosCoordinator,
      invariant,
      "iOS recovery keys and ordinary credential phase isolation",
    );
  }
  const iosBarrierRecovery = requiredSlice(
    iosCoordinator,
    "private func recoverLocalPrivacyBarrierLocked() async -> Bool",
    "private func purgeAndCloseLocked(",
    "iOS failed privacy-barrier recovery",
  );
  requireOrderedInvariants(
    iosBarrierRecovery,
    [
      "failed.localPrivacyBarrierFailed",
      "!failed.corruptState",
      "ownedMutationReasonLocked(failed) != nil",
      "resumeOwnedMutationReceiptLocked()",
      "let ownerlessCredentialPhase",
      "credentialStore.hasRefreshOrSessionCredentials()",
      "let preservesCredentialRebindProvenance",
      "failed.mutationPhase == .bound",
      "failed.mutationPhase == .dormantRebind",
      "ownerlessCredentialPhase && (failed.authVersion != nil || hasOwnerlessSessionCredentials)",
      "let phase: MutationPhase",
      "if preservesCredentialRebindProvenance",
      "phase = .dormantRebind",
      "reason = nil",
      "let displayEpoch = failed.displayEpoch",
      "purgeAndCloseLocked(phase: phase, reason: reason)",
      "recovered.displayEpoch == displayEpoch",
      "recovered.mutationPhase == phase",
      "recovered.mutationReason == reason",
      "recovered.admission == .closed",
      "!recovered.nextLaunchPurge",
      "!recovered.localPrivacyBarrierFailed",
      "(await zeroCountsLocked()).isZero",
    ],
    "iOS failed-barrier recovery must preserve lineage and prove durable five-zero closure",
  );

  const iosMutationBegin = requiredSlice(
    iosCoordinator,
    "func beginAccountMutation(_ reason: AccountMutationReason)",
    "func finalizeAccountMutation(_ reason: AccountMutationReason",
    "iOS account-mutation begin",
  );
  requireOrderedInvariants(
    iosMutationBegin,
    [
      "closing.displayEpoch += 1",
      "closing.admission = .closing",
      "closing.mutationPhase = .awaitingFinalize",
      "closing.mutationReason = reason",
      "try self.persistLocked(closing)",
      "self.purgeAndCloseLocked(phase: .awaitingFinalize, reason: reason)",
    ],
    "iOS mutation begin must durably establish one awaiting-finalize epoch",
  );
  const iosMutationFinalize = requiredSlice(
    iosCoordinator,
    "func finalizeAccountMutation(_ reason: AccountMutationReason",
    "func operationResult(success: Bool)",
    "iOS account-mutation finalize",
  );
  if (
    compactSwiftSource(iosMutationFinalize)
    !== compactSwiftSource(`
      func finalizeAccountMutation(_ reason: AccountMutationReason, displayEpoch: String) async -> [String: Any] {
        await processor.submit {
          let durable = self.readOnlyDurableStateLocked()
          guard
            let durable,
            self.ownsFinalizableMutationReceiptLocked(
              durable,
              reason: reason,
              displayEpoch: displayEpoch
            )
          else {
            return await self.readOnlyMutationResultLocked(success: false, state: durable)
          }
          _ = await self.preflightLocked()
          guard
            let current = self.state,
            !current.localPrivacyBarrierFailed,
            current.admission == .closed,
            self.ownsFinalizableMutationReceiptLocked(
              current,
              reason: reason,
              displayEpoch: displayEpoch
            )
          else {
            return await self.mutationResultLocked(success: false)
          }
          self.authorizationBearer = nil
          self.pendingFCMTokens.removeAll()
          self.hasEmittedPendingFCMTokensForCurrentBinding = false
          self.clearColdPayloadQuarantine()
          return await self.mutationResultLocked(
            success: await self.completeOwnedMutationReceiptLocked(reason: reason, displayEpoch: displayEpoch)
          )
        }
      }
    `)
  ) {
    throw new Error(
      "Native coordinator invariant is violated: iOS mutation finalize must match the complete reviewed durable-owner transaction.",
    );
  }
  requireOrderedInvariants(
    iosMutationFinalize,
    [
      "let durable = self.readOnlyDurableStateLocked()",
      "self.ownsFinalizableMutationReceiptLocked(",
      "durable,",
      "return await self.readOnlyMutationResultLocked(success: false, state: durable)",
      "_ = await self.preflightLocked()",
      "let current = self.state",
      "!current.localPrivacyBarrierFailed",
      "current.admission == .closed",
      "self.ownsFinalizableMutationReceiptLocked(",
      "current,",
      "self.authorizationBearer = nil",
      "self.completeOwnedMutationReceiptLocked(reason: reason, displayEpoch: displayEpoch)",
    ],
    "iOS mutation finalize must authenticate durable ownership before preflight and revalidate before cleanup",
  );
  if (/\\#*\(/.test(iosMutationFinalize)) {
    throw new Error(
      "Native coordinator invariant is violated: iOS mutation finalize must not hide executable calls inside standard or raw string interpolation.",
    );
  }
  const iosFinalizePreflightCount =
    countCallExpressions(iosMutationFinalize, "preflightLocked", true);
  if (iosFinalizePreflightCount !== 1) {
    throw new Error(
      "Native coordinator invariant is violated: iOS mutation finalize must invoke preflight exactly once after durable owner validation.",
    );
  }
  const iosMutationOwnerPredicate = requiredSlice(
    iosCoordinator,
    "private func ownsFinalizableMutationReceiptLocked(",
    "private func ownedMutationReasonLocked(",
    "iOS mutation owner predicate",
  );
  requireOrderedInvariants(
    iosMutationOwnerPredicate,
    [
      "!candidate.corruptState",
      "candidate.admission == .closed || candidate.admission == .closing",
      "candidate.mutationReason == reason",
      "String(candidate.displayEpoch) == displayEpoch",
      "candidate.mutationPhase == .awaitingFinalize",
      "isCompletedMutationReceiptStateLocked(candidate)",
    ],
    "iOS mutation owner predicate must bind exact durable phase, reason, and epoch",
  );
  const iosBarrierFailure = requiredSlice(
    iosCoordinator,
    "private func markPurgeFailureLocked()",
    "private func failClosedLocked()",
    "iOS privacy-barrier failure persistence",
  );
  requireOrderedInvariants(
    iosBarrierFailure,
    [
      "next.mutationPhase == .bound",
      "next.mutationPhase = .dormantRebind",
      "next.mutationReason = nil",
      "next.localPrivacyBarrierFailed = true",
      "try persistLocked(next)",
    ],
    "iOS generic barrier failure must not retain a bound mutation owner",
  );
  requireSourceInvariant(
    iosMutationFinalize,
    "displayEpoch: String",
    "iOS mutation finalize must accept the caller's canonical begin epoch",
  );
  requireSourceInvariant(
    iosMutationOwnerPredicate,
    "String(candidate.displayEpoch) == displayEpoch",
    "iOS mutation finalize must compare the caller epoch with authoritative durable state",
  );
  requireSourceInvariant(
    iosMutationBegin,
    "self.isCompletedMutationReceiptStateLocked(closing)",
    "iOS mutation begin must replay a completed durable receipt",
  );
  requireOrderedInvariants(
    iosMutationBegin,
    [
      "self.isCompletedMutationReceiptStateLocked(closing) || closing.mutationPhase == .awaitingFinalize",
      "closing.mutationReason == reason",
      "self.hasHealthyClosedMutationReceiptInvariantLocked(closing)",
      "self.mutationResultLocked(success: healthy)",
    ],
    "iOS mutation-begin replay must fail closed unless the durable receipt remains healthy and closed",
  );
  requireSourceInvariant(
    iosMutationOwnerPredicate,
    "isCompletedMutationReceiptStateLocked(candidate)",
    "iOS mutation finalize must admit an exact completed durable receipt",
  );
  const iosCompletedMutationCleanup = requiredSlice(
    iosCoordinator,
    "private func completeOwnedMutationReceiptLocked(",
    "private func resumeOwnedMutationReceiptLocked()",
    "iOS completed mutation cleanup",
  );
  requireOrderedInvariants(
    iosCompletedMutationCleanup,
    [
      "current.mutationReason == reason",
      "String(current.displayEpoch) == displayEpoch",
      "prepareCompletedMutationReceiptLocked(reason: reason, displayEpoch: displayEpoch)",
      "wipeNativeAuthSecretsForCompletedReceiptLocked()",
      "purgeAndCloseLocked(phase: completedMutationPhase(for: reason), reason: reason)",
      "completed.displayEpoch == current.displayEpoch",
      "completed.mutationReason == reason",
      "isHealthyCompletedMutationReceiptStateLocked(completed)",
      "(await zeroCountsLocked()).isZero",
    ],
    "iOS finalization must persist completed lineage before secret wipe and prove exact five-zero closure",
  );
  const iosCompletedMutationPersistence = requiredSlice(
    iosCoordinator,
    "private func prepareCompletedMutationReceiptLocked(",
    "private func wipeNativeAuthSecretsForCompletedReceiptLocked()",
    "iOS completed mutation persistence",
  );
  requireOrderedInvariants(
    iosCompletedMutationPersistence,
    [
      "String(next.displayEpoch) == displayEpoch",
      "next.mutationReason == reason",
      "next.mutationPhase == .awaitingFinalize",
      "completedMutationPhase(for: reason)",
      "next.admission = .closing",
      "next.mutationPhase = completedMutationPhase(for: reason)",
      "next.mutationReason = reason",
      "next.sessionMarker = nil",
      "next.authVersion = nil",
      "next.nextLaunchPurge = true",
      "try persistLocked(next)",
      "return true",
    ],
    "iOS completed mutation owner must be durably persisted before credential wipe",
  );
  forbidSourceInvariant(
    iosMutationFinalize,
    "displayEpoch += 1",
    "iOS mutation finalize must not advance the begin receipt epoch",
  );
  const iosMutationRecovery = requiredSlice(
    iosCoordinator,
    "private func resumeOwnedMutationReceiptLocked()",
    "private func hasHealthyClosedMutationReceiptInvariantLocked(",
    "iOS durable mutation receipt recovery",
  );
  requireOrderedInvariants(
    iosMutationRecovery,
    [
      "let reason = ownedMutationReasonLocked(current)",
      "let displayEpoch = current.displayEpoch",
      "prepareCompletedMutationReceiptLocked(reason: reason, displayEpoch: canonicalEpoch)",
      "wipeNativeAuthSecretsForCompletedReceiptLocked()",
      "purgeAndCloseLocked(phase: phase, reason: reason)",
      "recovered.displayEpoch == displayEpoch",
      "recovered.mutationPhase == phase",
      "recovered.mutationReason == reason",
      "(await zeroCountsLocked()).isZero",
    ],
    "iOS interrupted awaiting/completed recovery must preserve exact reason and epoch",
  );
  const iosMutationLineageQuery = requiredSlice(
    iosCoordinator,
    "func getAccountMutationLineage() async -> [String: Any]",
    "func initialize(contract: String, manifest: [String: Any])",
    "iOS account-mutation lineage query",
  );
  for (const invariant of [
    "readOnlyDurableStateLocked()",
    "ownedMutationReasonLocked($0)",
    'phase = "awaiting_finalize"',
    'phase = "completed"',
    "readOnlyZeroCountsLocked(state: current)",
    '"available": current != nil',
    '"active": phase != nil',
    '"phase": NativeNotificationCoordinatorPlugin.nullable(phase)',
    '"reason": NativeNotificationCoordinatorPlugin.nullable(reason?.rawValue)',
    '"display_epoch": String(current?.displayEpoch ?? 0)',
    '"zero_counts": counts.dictionary',
  ]) {
    requireSourceInvariant(
      iosMutationLineageQuery,
      invariant,
      "iOS lineage query must distinguish unavailable, awaiting, completed, and proven no-owner state",
    );
  }
  const iosStateJournalRecovery = requiredSlice(
    iosCoordinator,
    "func read() throws -> Data?",
    "func readOnly() throws -> Data?",
    "iOS durable state journal recovery",
  );
  requireOrderedInvariants(
    iosStateJournalRecovery,
    [
      "readItem(account: journalAccount)",
      "Self.isValidDurableState(journal.data)",
      "replace(journal.data, account: stateAccount)",
      "primaryMatchesCanonical(journal.data)",
      "remove(account: journalAccount)",
      "return journal.data",
    ],
    "iOS mutating state read must recover authoritative valid journal bytes before clearing the journal",
  );
  const iosStateJournalReadOnly = requiredSlice(
    iosCoordinator,
    "func readOnly() throws -> Data?",
    "private static func isValidDurableState(",
    "iOS read-only state journal query",
  );
  requireOrderedInvariants(
    iosStateJournalReadOnly,
    [
      "readItem(account: journalAccount)",
      "Self.isValidDurableState(journal.data)",
      "return journal.data",
      "readItem(account: stateAccount)?.data",
    ],
    "iOS read-only lineage query must prefer authoritative valid journal bytes without mutation",
  );
  for (const forbidden of ["replace(", "remove("]) {
    forbidSourceInvariant(
      iosStateJournalReadOnly,
      forbidden,
      "iOS read-only journal query must not repair or delete durable state",
    );
  }
  const iosDeletionCredentialDefinitions = requiredSlice(
    iosCoordinator,
    "static let privacyBarrierFailureKey",
    "private static let allowedKeys: Set<String> = [",
    "iOS deletion credential constants",
  );
  const compactIosCredentialDefinitions = compactSwiftSource(iosDeletionCredentialDefinitions);
  for (const [constantName, literalValue] of [
    ["privacyBarrierFailureKey", "zerotime.native-auth.privacy-barrier-failed.v1"],
    ["corruptSessionAuditKey", "zerotime.native-auth.corrupt-session-audit.v1"],
    ["deletionStatusKey", "zerotime.account-deletion.status.v1"],
    ["deletionOperationKey", "zerotime.account-deletion.operation.v1"],
    ["deletionOperationAuditKey", "zerotime.account-deletion.operation.audit.v1"],
    ["deletionNativeReauthHandoffKey", "zerotime.account-deletion.native-reauth-handoff.v1"],
  ]) {
    const activeDefinition = `staticlet${constantName}="${literalValue}"`;
    if (!compactIosCredentialDefinitions.includes(activeDefinition)) {
      throw new Error(
        `Native coordinator invariant is violated: iOS ${constantName} literal is missing from active source.`,
      );
    }
  }
  const iosDeletionLifecycleClassifier = requiredSlice(
    iosCoordinator,
    "static func isDeletionLifecycleKey(_ key: String) -> Bool",
    "func isAvailable() -> Bool",
    "iOS deletion lifecycle classifier",
  );
  requireExactMembers(
    [...iosDeletionLifecycleClassifier.matchAll(/key == ([A-Za-z][A-Za-z0-9]*)/g)]
      .map((match) => match[1]),
    [
      "deletionStatusKey",
      "deletionOperationKey",
      "deletionOperationAuditKey",
      "deletionNativeReauthHandoffKey",
    ],
    "iOS deletion lifecycle classifier",
  );
  if (
    compactSwiftSource(iosDeletionLifecycleClassifier)
    !== compactSwiftSource(`
      static func isDeletionLifecycleKey(_ key: String) -> Bool {
        key == deletionStatusKey
          || key == deletionOperationKey
          || key == deletionOperationAuditKey
          || key == deletionNativeReauthHandoffKey
      }
    `)
  ) {
    throw new Error(
      "Native coordinator invariant is violated: iOS deletion lifecycle classifier contains an extra active predicate.",
    );
  }
  const iosCredentialAllowlist = requiredSlice(
    iosCoordinator,
    "private static let allowedKeys: Set<String> = [",
    "static func isAllowedKey(_ key: String) -> Bool",
    "iOS secure credential allowlist",
  );
  requireExactMembers(
    [...iosCredentialAllowlist.matchAll(/^\s*(?:"([^"]+)"|([A-Za-z][A-Za-z0-9]*)),\s*$/gm)]
      .map((match) => match[1] ?? match[2]),
    [
      "zerotime.native-auth.transient.v1",
      "zerotime.native-auth.refresh.v1",
      "zerotime.native-auth.session.v1",
      "privacyBarrierFailureKey",
      "corruptSessionAuditKey",
      "deletionStatusKey",
      "deletionOperationKey",
      "deletionOperationAuditKey",
      "deletionNativeReauthHandoffKey",
    ],
    "iOS secure credential allowlist",
  );
  const iosAllowedKeyPredicate = requiredSlice(
    iosCoordinator,
    "static func isAllowedKey(_ key: String) -> Bool",
    "static func isPrivacyBarrierFailureKey(_ key: String) -> Bool",
    "iOS allowed-key predicate",
  );
  if (
    compactSwiftSource(iosAllowedKeyPredicate)
    !== "staticfuncisAllowedKey(_key:String)->Bool{allowedKeys.contains(key)}"
  ) {
    throw new Error(
      "Native coordinator invariant is violated: iOS allowed-key predicate must be exact set membership.",
    );
  }
  requireSourceInvariant(
    iosCoordinator,
    "KeychainCredentialStore.isDeletionLifecycleKey(key)",
    "iOS deletion lifecycle credentials must use normal phase policy",
  );
  const iosRecoveryLeafClassifier = requiredSlice(
    iosCoordinator,
    "static func isPrivacyBarrierFailureKey(_ key: String) -> Bool",
    "static func isRecoveryKey(_ key: String) -> Bool",
    "iOS recovery leaf classifier",
  );
  if (
    compactSwiftSource(iosRecoveryLeafClassifier)
    !== "staticfuncisPrivacyBarrierFailureKey(_key:String)->Bool{key==privacyBarrierFailureKey}"
  ) {
    throw new Error(
      "Native coordinator invariant is violated: iOS privacy recovery leaf must be exact literal-key equality.",
    );
  }
  const iosRecoveryKeyClassifier = requiredSlice(
    iosCoordinator,
    "static func isRecoveryKey(_ key: String) -> Bool",
    "static func isDeletionLifecycleKey(_ key: String) -> Bool",
    "iOS recovery-key classification",
  );
  if (
    compactSwiftSource(iosRecoveryKeyClassifier)
    !== "staticfuncisRecoveryKey(_key:String)->Bool{isPrivacyBarrierFailureKey(key)||key==corruptSessionAuditKey}"
  ) {
    throw new Error(
      "Native coordinator invariant is violated: iOS recovery-key classifier must contain exactly the two native recovery markers.",
    );
  }
  forbidSourceInvariant(
    iosRecoveryKeyClassifier,
    "isDeletionLifecycleKey",
    "iOS deletion lifecycle credentials must never bypass failed-phase recovery policy",
  );
  const iosCredentialOperationPolicy = requiredSlice(
    iosCoordinator,
    "private func credentialOperationPermittedLocked(key: String, operation: CredentialOperation) -> Bool",
    "private func finishNetworkAuthorizationLocked",
    "iOS credential operation policy",
  );
  if (
    compactSwiftSource(iosCredentialOperationPolicy)
    !== compactSwiftSource(`
      private func credentialOperationPermittedLocked(key: String, operation: CredentialOperation) -> Bool {
        guard KeychainCredentialStore.isAllowedKey(key) else { return false }
        if KeychainCredentialStore.isRecoveryKey(key) {
          return true
        }
        guard
          let state,
          !state.localPrivacyBarrierFailed,
          !state.corruptState
        else {
          return false
        }
        if KeychainCredentialStore.isDeletionLifecycleKey(key) {
          return true
        }
        if
          operation == .delete,
          state.mutationPhase != .awaitingFinalize,
          state.mutationPhase != .dormantRebind
        {
          return true
        }
        switch state.mutationPhase {
        case .unbound, .readyForRebind:
          return key == "zerotime.native-auth.transient.v1"
        case .dormantRebind:
          return operation == .read
            && (
              key == "zerotime.native-auth.refresh.v1"
                || key == "zerotime.native-auth.session.v1"
            )
        case .bound:
          if key == "zerotime.native-auth.transient.v1" {
            return operation == .delete
          }
          return key == "zerotime.native-auth.refresh.v1" || key == "zerotime.native-auth.session.v1"
        case .awaitingFinalize:
          return operation == .read
            && (key == "zerotime.native-auth.refresh.v1" || key == "zerotime.native-auth.session.v1")
        case .terminal:
          return key == "zerotime.native-auth.transient.v1"
        case .corruptFailure:
          return false
        }
      }
    `)
  ) {
    throw new Error(
      "Native coordinator invariant is violated: iOS credential operation policy must match the complete reviewed phase matrix.",
    );
  }
  const iosLaunchMutationRecovery = requiredSlice(
    iosCoordinator,
    "private func preflightLocked() async -> Bool",
    "private func recoverLocalPrivacyBarrierLocked() async -> Bool",
    "iOS launch mutation recovery",
  );
  requireOrderedInvariants(
    iosLaunchMutationRecovery,
    [
      "if ownedMutationReasonLocked(current) != nil",
      "resumeOwnedMutationReceiptLocked()",
      "if current.localPrivacyBarrierFailed",
      "if dirty",
      "current.displayEpoch += 1",
    ],
    "iOS launch recovery must resume owned lineage before generic epoch rotation",
  );
  const iosMutationReceiptState = requiredSlice(
    iosCoordinator,
    "private struct NotificationDurableState: Codable {",
    "private final class KeychainNotificationStateStore",
    "iOS durable completed mutation receipt",
  );
  requireOrderedInvariants(
    iosMutationReceiptState,
    [
      "var displayEpoch: UInt64",
      "var mutationPhase: MutationPhase",
      "var mutationReason: AccountMutationReason?",
    ],
    "iOS durable state must retain completed receipt epoch, phase, and reason",
  );
  requireSourceInvariant(
    iosMutationReceiptState,
    "let hasCompletedMutationReceipt =",
    "iOS durable state must recognize completed mutation receipts",
  );
  for (const invariant of [
    "bindingGeneration <= 9_007_199_254_740_991",
    "tokenGeneration <= 9_007_199_254_740_991",
    "mutationPhase == .bound && (bindingGeneration <= 0 || tokenGeneration <= 0)",
    "operation.bindingGeneration <= 9_007_199_254_740_991",
    "operation.tokenGeneration <= 9_007_199_254_740_991",
    "receipt.bindingGeneration <= 9_007_199_254_740_991",
    "receipt.tokenGeneration <= 9_007_199_254_740_991",
  ]) {
    requireSourceInvariant(
      iosMutationReceiptState,
      invariant,
      "iOS durable state must reject unsafe or nonpositive bound generations",
    );
  }
  const iosHealthyMutationStructure = requiredSlice(
    iosCoordinator,
    "private func hasClosedFiveZeroStateStructureLocked(",
    "private func isHealthyCompletedMutationReceiptStateLocked(",
    "iOS healthy completed-mutation structure",
  );
  for (const invariant of [
    "candidate.admission == .closed",
    "!candidate.nextLaunchPurge",
    "!candidate.localPrivacyBarrierFailed",
    "!candidate.corruptState",
    "candidate.sessionMarker == nil",
    "candidate.authVersion == nil",
    "candidate.registry.isEmpty",
    "candidate.handoffs.isEmpty",
    "candidate.pendingTaps.isEmpty",
    "candidate.operations.isEmpty",
  ]) {
    requireSourceInvariant(
      iosHealthyMutationStructure,
      invariant,
      "iOS completed receipt replay must require a healthy durable structure",
    );
  }
  const iosHealthyMutationReceipt = requiredSlice(
    iosCoordinator,
    "private func hasHealthyClosedMutationReceiptInvariantLocked(",
    "private func isCleanClosedNonterminalStateLocked(",
    "iOS healthy completed-mutation receipt",
  );
  requireOrderedInvariants(
    iosHealthyMutationReceipt,
    [
      "hasClosedFiveZeroStateStructureLocked(candidate)",
      "(await zeroCountsLocked()).isZero",
    ],
    "iOS completed receipt replay must require a healthy durable five-zero barrier",
  );

  const iosAuthorization = requiredSlice(
    iosCoordinator,
    "private struct ServerAuthorization",
    "private struct NotificationDurableState",
    "iOS display authorization response validation",
  );
  requireSourceInvariant(
    iosAuthorization,
    "title.count <= 512",
    "iOS display titles accept the shared 512-character boundary",
  );
  requireSourceInvariant(
    iosAuthorization,
    'positiveSafeInteger(installation["token_generation"])',
    "iOS authorization receipts require a positive token generation",
  );
  requireSourceInvariant(
    androidCoordinator,
    'setRequestProperty("Content-Type", "application/json; charset=utf-8")',
    "Android authorization requests use the canonical JSON media type",
  );
  requireSourceInvariant(
    iosCoordinator,
    'request.setValue("application/json; charset=utf-8", forHTTPHeaderField: "Content-Type")',
    "iOS authorization requests use the canonical JSON media type",
  );
  requireSourceInvariant(
    iosCoordinator,
    'normalized == "application/json" || normalized == "application/json; charset=utf-8"',
    "iOS and Android enforce the same JSON response content types",
  );

  let iosPackageResolved;
  try {
    iosPackageResolved = JSON.parse(iosPackageResolvedDocument);
  } catch {
    throw new Error("iOS dependency lock is not valid JSON.");
  }
  const firebasePin = iosPackageResolved.pins?.find(
    (pin) => pin.identity === "firebase-ios-sdk",
  );
  if (
    firebasePin?.kind !== "remoteSourceControl" ||
    firebasePin.location !== "https://github.com/firebase/firebase-ios-sdk.git" ||
    firebasePin.state?.version !== "12.0.0" ||
    firebasePin.state.revision !==
      "4e62da1e5e6baf61674d3f5ae23d6d60c19f9c4a"
  ) {
    throw new Error(
      "iOS dependency lock must pin the official Firebase iOS SDK 12.0.0 revision.",
    );
  }

  const firebasePackageReference = requiredSlice(
    iosProject,
    'XCRemoteSwiftPackageReference "firebase-ios-sdk" */ = {',
    "/* End XCRemoteSwiftPackageReference section */",
    "iOS Firebase package reference",
  );
  requireOrderedInvariants(
    firebasePackageReference,
    [
      'repositoryURL = "https://github.com/firebase/firebase-ios-sdk.git";',
      "kind = exactVersion;",
      "version = 12.0.0;",
    ],
    "iOS project must require the exact official Firebase iOS SDK version",
  );

  let evidenceSchema;
  try {
    evidenceSchema = JSON.parse(evidenceSchemaDocument);
  } catch {
    throw new Error("Release evidence schema is not valid JSON.");
  }
  const requiredEvidenceSections = [
    "provenance",
    "manual_execution",
    "notification_deliveries",
    "race_matrix",
    "crash_recovery",
    "deletion_evidence",
    "release_decision",
  ];
  for (const section of requiredEvidenceSections) {
    if (
      !evidenceSchema.required?.includes(section)
      || evidenceSchema.properties?.[section] === undefined
    ) {
      throw new Error(`Release evidence schema must require ${section}.`);
    }
  }

  const appContractDigest =
    evidenceSchema.properties?.provenance?.properties?.app?.properties
      ?.contract_sha256?.const;
  const backendContractDigest =
    evidenceSchema.properties?.provenance?.properties?.backend?.properties
      ?.openapi_sha256?.const;
  if (
    appContractDigest !== canonicalContractDigest
    || backendContractDigest !== canonicalContractDigest
  ) {
    throw new Error(
      "App and backend release evidence must pin the computed canonical OpenAPI digest.",
    );
  }
  const evidenceEpochPattern = evidenceSchema.$defs?.uint64?.pattern;
  const epochValidator =
    typeof evidenceEpochPattern === "string"
      ? new RegExp(evidenceEpochPattern)
      : null;
  if (
    evidenceEpochPattern !== contractEpochPatterns[0]
    || !epochValidator?.test("0")
    || !epochValidator.test("18446744073709551615")
    || epochValidator.test("00")
    || epochValidator.test("18446744073709551616")
  ) {
    throw new Error(
      "OpenAPI and evidence display epochs must share the exact canonical uint64 boundary.",
    );
  }
  if (
    evidenceSchema.properties?.release_decision?.properties?.status?.const !== "ready"
  ) {
    throw new Error("Release evidence schema must fail closed until a ready decision.");
  }

  requireExactMembers(
    evidenceSchema.properties?.race_matrix?.required,
    ["foreground_receive", "background_receive", "tap"],
    "Release race flows",
  );
  requireExactMembers(
    evidenceSchema.$defs?.raceFlow?.required,
    [
      "authorization_registered",
      "authorization_response_before_gate",
      "pre_schedule_or_banner_commit",
      "native_schedule_pending",
      "native_schedule_completed_before_recheck",
      "purge_after_epoch_increment",
      "server_ack",
      "account_b_binding",
    ],
    "Release race pause points",
  );
  requireExactMembers(
    evidenceSchema.$defs?.pauseMutations?.required,
    ["logout", "account_switch", "app_delete"],
    "Release race mutation reasons",
  );
  requireExactMembers(
    evidenceSchema.$defs?.raceReceipt?.required,
    [
      "mutation_transaction",
      "old_work_cancelled_or_drained",
      "completed_schedule_absent_or_purged",
      "deterministic_removal_confirmed",
      "post_epoch_display_or_open_denied",
      "server_ack_before_success_or_binding",
      "success_or_binding_after_zero",
      "account_b_denied_account_a_delivery",
      "artifact_refs",
    ],
    "Release race receipt",
  );
  requireExactMembers(
    evidenceSchema.$defs?.mutationTransaction?.required,
    ["reason", "display_epoch", "begin_receipt", "finalize_receipt"],
    "Release mutation transaction",
  );
  requireExactMembers(
    evidenceSchema.$defs?.beginMutationReceipt?.required,
    ["phase", "success", "zero_counts"],
    "Release begin receipt",
  );
  requireExactMembers(
    evidenceSchema.$defs?.finalizeMutationReceipt?.required,
    ["phase", "success", "zero_counts"],
    "Release finalize receipt",
  );
  for (const outcome of [
    "old_work_cancelled_or_drained",
    "completed_schedule_absent_or_purged",
    "deterministic_removal_confirmed",
    "post_epoch_display_or_open_denied",
    "server_ack_before_success_or_binding",
    "success_or_binding_after_zero",
    "account_b_denied_account_a_delivery",
  ]) {
    if (evidenceSchema.$defs?.raceReceipt?.properties?.[outcome]?.const !== true) {
      throw new Error(`Release race receipt must require ${outcome}.`);
    }
  }
  const reasonSpecificRaces = [
    ["logout", "logoutRaceReceipt", "logoutMutationTransaction"],
    ["account_switch", "accountSwitchRaceReceipt", "accountSwitchMutationTransaction"],
    ["app_delete", "deletionRaceReceipt", "deletionMutationTransaction"],
  ];
  for (const [member, receiptDefinition, transactionDefinition] of reasonSpecificRaces) {
    if (
      evidenceSchema.$defs?.pauseMutations?.properties?.[member]?.$ref
        !== `#/$defs/${receiptDefinition}`
      || evidenceSchema.$defs?.[receiptDefinition]?.allOf?.[1]?.properties
        ?.mutation_transaction?.$ref !== `#/$defs/${transactionDefinition}`
    ) {
      throw new Error(
        "Release race cells must use reason-specific authoritative mutation transactions.",
      );
    }
  }
  requireExactMembers(
    evidenceSchema.$defs?.zeroCounts?.required,
    [
      "pending_count",
      "delivered_count",
      "foreground_banner_count",
      "registry_count",
      "inflight_count",
    ],
    "Native zero-count receipt",
  );
  requireExactMembers(
    evidenceSchema.properties?.crash_recovery?.required,
    [
      "after_epoch_persist",
      "after_schedule_completion",
      "after_purge",
      "before_server_ack",
    ],
    "Release crash recovery cases",
  );

  requireExactMembers(
    evidenceSchema.properties?.deletion_evidence?.oneOf?.map(
      (variant) => variant.$ref,
    ),
    [
      "#/$defs/appLocalDeletionEvidence",
      "#/$defs/publicWebDeletionEvidence",
      "#/$defs/otherDeviceDeletionEvidence",
    ],
    "Release deletion entrypoint variants",
  );
  requireExactMembers(
    evidenceSchema.$defs?.appLocalDeletionEvidence?.required,
    [
      "deletion_request_reference",
      "entrypoint",
      "account_wide_authorization_fence",
      "initiating_device_barrier",
      "offline_next_launch",
    ],
    "App-local deletion evidence",
  );
  requireExactMembers(
    evidenceSchema.$defs?.publicWebDeletionEvidence?.required,
    [
      "deletion_request_reference",
      "entrypoint",
      "account_wide_authorization_fence",
      "running_device_next_contact",
      "offline_next_launch",
    ],
    "Public-web deletion evidence",
  );
  requireExactMembers(
    evidenceSchema.$defs?.otherDeviceDeletionEvidence?.required,
    [
      "deletion_request_reference",
      "entrypoint",
      "account_wide_authorization_fence",
      "deleting_device_barrier",
      "offline_next_launch",
    ],
    "Other-device deletion evidence",
  );
  requireExactMembers(
    evidenceSchema.$defs?.accountWideDeletion?.required,
    [
      "status",
      "server_acknowledged_at",
      "revocation_receipt_reference",
      "old_delivery_denials",
      "artifact_refs",
    ],
    "Account-wide deletion receipt",
  );
  const oldDeliveryDenials =
    evidenceSchema.$defs?.accountWideDeletion?.properties?.old_delivery_denials;
  if (
    oldDeliveryDenials?.type !== "object"
    || oldDeliveryDenials.minProperties !== 2
    || oldDeliveryDenials.propertyNames?.$ref !== "#/$defs/nonSecretReference"
    || oldDeliveryDenials.additionalProperties?.$ref !== "#/$defs/oldDeliveryDenial"
  ) {
    throw new Error(
      "Account-wide deletion must key typed old-delivery denials by distinct device references.",
    );
  }
  requireExactMembers(
    evidenceSchema.$defs?.oldDeliveryDenial?.required,
    [
      "old_delivery_reference",
      "post_revocation_observed_at",
      "display_authorization_denied",
      "notice_open_denied",
      "artifact_refs",
    ],
    "Old-delivery denial receipt",
  );
  requireExactMembers(
    evidenceSchema.$defs?.reachableDeletion?.required,
    [
      "status",
      "device_reference",
      "pre_display_epoch",
      "epoch_increment_confirmed",
      "mutation_transaction",
      "purge_before_content",
      "old_work_cancelled_or_drained",
      "deterministic_removal_confirmed",
      "authorization_denied",
      "open_denied",
      "zero_counts",
      "artifact_refs",
    ],
    "Reachable deletion receipt",
  );
  requireExactMembers(
    evidenceSchema.$defs?.remoteNextContactDeletion?.required,
    [
      "status",
      "device_reference",
      "pre_display_epoch",
      "post_display_epoch",
      "epoch_increment_confirmed",
      "purge_before_content",
      "old_work_cancelled_or_drained",
      "deterministic_removal_confirmed",
      "authorization_denied",
      "open_denied",
      "zero_counts",
      "artifact_refs",
    ],
    "Remote next-contact deletion receipt",
  );
  requireExactMembers(
    evidenceSchema.$defs?.offlineDeletion?.required,
    [
      "status",
      "device_reference",
      "server_revoked_at",
      "prior_entry_seeded",
      "next_launch_required",
      "purge_before_content",
      "authorization_denied",
      "open_denied",
      "zero_counts",
      "artifact_refs",
    ],
    "Offline deletion receipt",
  );
  requireExactMembers(
    evidenceSchema.properties?.release_decision?.properties?.approvals?.required,
    ["architect", "backend_owner", "mobile_owner", "privacy_owner", "release_owner"],
    "Release approvals",
  );
  for (const [invariant, label] of [
    ["beginDisplayAuthorization", "display authorization begin"],
    ["beginAccountMutation", "account mutation begin"],
    ["finalizeAccountMutation", "account mutation finalize"],
    ["zero_counts.pending_count", "pending zero count"],
    ["zero_counts.delivered_count", "delivered zero count"],
    ["zero_counts.foreground_banner_count", "foreground-banner zero count"],
    ["zero_counts.registry_count", "registry zero count"],
    ["zero_counts.inflight_count", "inflight zero count"],
    ["authorization response received before gate re-entry", "authorization pause point"],
    ["native schedule completed before epoch recheck", "schedule-completion pause point"],
    ["account_wide_authorization_fence", "account-wide deletion evidence"],
    ["reachable_installation_barrier", "reachable-installation deletion evidence"],
    ["offline_next_launch", "offline next-launch deletion evidence"],
    ["never rotates credentials", "headless dormant credential boundary"],
  ]) {
    requireSourceInvariant(nativeBarrier, invariant, label);
  }
  console.log("Native notification coordinator contract verified.");
}

async function verifyMobileReleaseContract() {
  const [contract, expectedDigestFile] = await Promise.all([
    readRequired(contractPath, "Vendored contract"),
    readRequired(digestPath, "Committed digest"),
  ]);
  const expectedDigestText = expectedDigestFile.toString("utf8");

  if (!/^[0-9a-f]{64}\n?$/.test(expectedDigestText)) {
    throw new Error(
      `Committed digest is malformed: ${digestPath}. Expected exactly 64 lowercase hexadecimal characters, optionally followed by one newline.`,
    );
  }

  const expectedDigest = expectedDigestText.endsWith("\n")
    ? expectedDigestText.slice(0, -1)
    : expectedDigestText;
  const actualDigest = createHash("sha256").update(contract).digest("hex");

  if (actualDigest !== expectedDigest) {
    throw new Error(
      `Vendored contract digest mismatch. Expected ${expectedDigest} from ${digestPath}, computed ${actualDigest} from ${contractPath}.`,
    );
  }
  console.log(`Mobile release contract verified: ${actualDigest}`);
  await verifyNativeCoordinatorContract();
}

async function verifyVerifiedLinks() {
  const assets = getVerifiedLinkAssets();

  await Promise.all(
    assets.map(async ({ label, path, content }) => {
      const actual = await readRequired(path, label);

      if (actual.toString("utf8") !== content) {
        throw new Error(
          `${label} is inconsistent with ${APPLE_TEAM_ID_ENV} and ${ANDROID_CERT_FINGERPRINTS_ENV}: ${path}. Regenerate it with npm run verified-links:generate.`,
        );
      }
    }),
  );

  console.log("Verified-link assets verified.");
}

async function main() {
  const arguments_ = process.argv.slice(2);

  if (arguments_.length === 0) {
    await verifyMobileReleaseContract();
    return;
  }

  if (arguments_.length === 1 && arguments_[0] === verifiedLinksArgument) {
    await verifyVerifiedLinks();
    return;
  }

  if (arguments_.length === 1 && arguments_[0] === nativeReleaseGateArgument) {
    await verifyMobileReleaseContract();
    await verifyVerifiedLinks();
    return;
  }

  if (arguments_.length === 1 && arguments_[0] === buildGateArgument) {
    await verifyMobileReleaseContract();
    if (process.env.CAPACITOR_BUILD === "true") {
      await verifyVerifiedLinks();
    }
    return;
  }

  throw new Error(
    `Unsupported arguments. Use no arguments to verify the mobile release contract, ${verifiedLinksArgument} to verify public verified-link assets, ${nativeReleaseGateArgument} for an unconditional native release preflight, or ${buildGateArgument} as the platform-aware npm build hook.`,
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Mobile release verification failed: ${message}`);
  process.exitCode = 1;
});
