# Native notification barrier v1

## Status and authority

This document defines the release evidence required by `mobile-release.v1`; it is not evidence that a candidate passed. The OpenAPI contract and native implementations are authoritative:

- Android: `android/app/src/main/java/kr/zerotime/app/NativeNotificationCoordinatorPlugin.java`
- iOS: `ios/App/App/NativeNotificationCoordinatorPlugin.swift`
- JavaScript adapter only: `app/_lib/native/notificationCoordinator.ts`

JavaScript may invoke the native API and relay opaque receipts, but it never owns admission, display authorization, epochs, notification text, registry state, or account-mutation barriers.

Remote push is strictly data-only. Application data contains exactly `delivery_id` and `notice_id`. It contains no title, body, deep link, subject, credential, session, generation, or notice content. The iOS transport envelope permits only silent `content-available`; `alert`, `sound`, and `badge` are forbidden. A provider receipt is never display authority.

## Durable native state

Both platforms persist the same privacy state in secure, non-backup storage before acknowledging a transition:

| Field | Contract |
|---|---|
| `installation_id` | Installation-local UUID. It is not an account identifier. |
| `display_epoch` | Canonical uint64 decimal string, monotonically incremented before an account/privacy cutoff. |
| `admission` | `open`, `closing`, or `closed`. Persisted `open` is never sufficient process-start authority. |
| `mutation_phase` / `mutation_reason` | Distinguishes bound, awaiting-finalize, dormant-rebind, account-switch/relogin, and terminal recovery states. |
| `session_marker` | Keyed local marker only; raw subject/session/token is forbidden in notification state. |
| `registry` / `inflight` | Deterministic notification ID, captured epoch, and phase only. No title or account data. |
| `next_launch_purge` | Requires purge and zero enumeration before content, binding, or display. |

A state write that is uncertain or fails produces `local_privacy_barrier_failed`; admission remains closed and success UI/account-B binding is forbidden.

## Process-start and runtime transitions

Process start, runtime readiness, and headless delivery are distinct transitions.

1. **UI cold launch:** native code installs a content gate before the WebView/bridge is exposed. It reloads durable state, increments the epoch, closes admission, drains/cancels stale work, purges ZeroTime banners and pending/delivered notifications, and verifies all five zero counts. An identifier-only launch tap may be quarantined in memory before the destructive purge; it is released only after verified fresh rebind.
2. **Runtime readiness:** after the one-time launch barrier succeeds, ordinary plugin calls and warm intents use an idempotent readiness check. They must not repeat launch reconciliation or advance the epoch.
3. **Headless data delivery:** a fresh Android service process first validates immutable embedded release provenance, quarantines only `{delivery_id, notice_id}`, and durably transitions any persisted bound state to closed `dormant_rebind` after purge. It never rotates credentials, reopens admission, authorizes display, or schedules a notification headlessly; a verified UI/bridge refresh and bind must complete first. iOS terminated data-only non-delivery is the accepted platform risk; any callback that does run still obeys this barrier.
4. **Dormant rebind:** process-death recovery may expose existing refresh/session credentials only to the crash-safe JavaScript recovery lane for server-verified rebind. Account-switch `ready_for_rebind` is a separate credential-empty state and cannot read the previous account's credentials.

Corrupt state, unknown phase, release-provenance mismatch, purge timeout, enumeration failure, network failure, or response mismatch fails closed.

## Native API and receipt continuity

The native plugin methods are:

- `getOrCreateInstallationId()`
- `initialize(coordinator_contract, release_manifest)`
- `bindSession(session_id, auth_version, binding_generation, token_generation, authorization_bearer)`
- `updateSessionGenerations(session_id, binding_generation, token_generation)`
- `beginDisplayAuthorization(delivery_id, notice_id)`
- `scheduleAuthorizedNotification(operation_id)` / `abortDisplayAuthorization(operation_id, reason)`
- `beginTapAuthorization(delivery_id, notice_id, display_epoch)`
- `completeTapAuthorization(operation_id)` / `abortTapAuthorization(operation_id, reason)`
- `beginAccountMutation(reason)`
- `finalizeAccountMutation(reason, display_epoch)`

A live native binding requires positive JavaScript-safe binding and token generations. Installation API responses may report token generation zero before token publication, but the coordinator remains closed/unbound until a positive generation is returned.

`beginAccountMutation(reason)` returns the caller-held exact `display_epoch`; `finalizeAccountMutation(reason, display_epoch)` must receive that same reason and epoch. The epoch cannot be recovered by starting or adopting another mutation. Every successful receipt includes:

```text
success
exact display_epoch
zero_counts.pending_count
zero_counts.delivered_count
zero_counts.foreground_banner_count
zero_counts.registry_count
zero_counts.inflight_count
```

All five counts must be zero before local completion is reported.

## Receive and local-display protocol

1. Inside the native serial gate, require `admission=open`, a current session marker, positive current generations, and clean durable state. Capture epoch `E`; create a deterministic ID and `authorizing` registry entry.
2. Outside the gate, call `POST /v1/push-deliveries/{delivery_id}/authorize-display` with the current bearer, installation/session/generations, notice ID, and `client_display_epoch=E`.
3. Re-enter the gate and require exact operation, epoch, marker, installation, generations, response schema, contract header, and authorization expiry. Every non-200 or mismatch drops the operation with no fallback content.
4. Foreground presentation registers its banner under the same deterministic ID and epoch. Background presentation persists `schedule_pending` before invoking the native scheduler while the schedule critical section remains serialized against mutation.
5. Immediately after native completion, recheck epoch/admission/session/generations. A mismatch or ambiguous completion removes the deterministic pending/delivered ID, clears registry state, and records no display success.
6. Authorization is single-use and expires within 30 seconds. Reuse, timeout, or expiry drops the operation.

## Tap protocol

A tap is captured as opaque delivery/notice ID plus the notification epoch. It enters the same serial gate, must match the registry/current session, and performs a fresh server authorization. Only after the response recheck may the app fetch/open notice content. Denied or stale taps remove the deterministic ID and expose no title/detail.

Cold-tap quarantine release and callback capture are idempotent: an exactly matching existing pending tap is one logical event and emits at most once; any mismatch is purged.

## Account-mutation privacy barrier

Logout, account switch, and app-local deletion begin with the same native sequence:

1. Persist `admission=closing`, increment `display_epoch`, record the mutation reason/phase, and set `next_launch_purge` before changing web/session state.
2. Cancel old authorization/tap work. A schedule critical section already in progress completes before the barrier and is then caught by purge.
3. Drain old-epoch work; remove foreground banners and every ZeroTime pending/delivered local notification by registry plus category/channel namespace.
4. Enumerate platform state and verify all five zero counts. Failure leaves `local_privacy_barrier_failed` and blocks success UI, server-success claims, and account-B OAuth/binding.
5. Perform the server logout/deletion request only after the local cutoff. A retryable server failure leaves admission closed and resumes through the same mutation phase.
6. After server acknowledgement, run final purge/enumeration and call `finalizeAccountMutation` with the exact begin reason and epoch.
7. Logout/deletion purge credentials/cache and remain closed. Account switch may start B OAuth only after A's local barrier and server logout acknowledgement. B binding stores a new marker/generations, increments the epoch again, verifies zero state, then opens admission.

Crash/restart in any mutation phase resumes closed and purges before content, OAuth callback handling, B binding, notification handling, or API-driven navigation.

## Remote/public deletion reconciliation

Server deletion acknowledgement increments auth version, revokes sessions, unlinks every installation generation, and makes old display authorization fail account-wide. A reachable installation runs the native barrier at its next revocation/auth failure. An offline installation is not claimed to be instantly clean: its earliest launch, callback, handler, tap, or API attempt must close admission, increment epoch, purge, verify zero, and reconcile server denial before content.

## Required pause-point race matrix

Evidence records all combinations of operation (`foreground_receive`, `background_receive`, `tap`), mutation (`logout`, `account_switch`, `app_delete`), and these eight pause points:

1. authorization request registered;
2. authorization response received before gate re-entry;
3. pre-schedule/banner commit;
4. native schedule pending;
5. native schedule completed before epoch recheck;
6. purge after epoch increment;
7. server logout/deletion acknowledgement;
8. account-B binding requested/bound.

Every cell records one authoritative mutation identity (reason plus exact `display_epoch`), separate successful begin/finalize zero receipts bound to that identity, cancellation/drain and deterministic-removal results, post-epoch display/open denial, server-ack ordering, account-B isolation, and all five zero counts. Required outcomes:

- the first durable mutation event is close plus epoch increment;
- old work is cancelled or drained;
- a schedule completed before the barrier is purged;
- completion after epoch change removes the deterministic ID and records no display/open;
- success UI and B binding never precede zero enumeration and server acknowledgement;
- B cannot authorize or open A's delivery.

Crash/restart variants are required after epoch persistence, schedule completion, purge, and before server acknowledgement. Each must demonstrate purge-before-content and closed admission until verified recovery.

## Deletion evidence classes

The three classes remain distinct and bind to one deletion request/candidate:

| Class | Required proof | Explicit limit |
|---|---|---|
| `account_wide_authorization_fence` | Server acknowledgement, auth-version/generation revocation receipt, and old-delivery denial on multiple installations. | Does not prove a powered-off device has run local purge. |
| `reachable_installation_barrier` | Opaque QA device reference, pre/post epoch, mutation receipts, drain/removal results, and five zero counts. | Applies only to a device that reported local completion. |
| `offline_next_launch` | Seeded prior entry, server revocation time, next-contact purge-before-content, zero counts, and authorization/open denial. | Before next contact it is an obligation, never immediate-global-zero proof. |

App-local evidence uses `initiating_device_barrier` and requires all three classes. Public-web evidence instead uses `running_device_next_contact` with purge-before-content plus authorization/open denial; the closed schema forbids a fictitious initiating-device receipt. Other-device evidence uses `deleting_device_barrier` only for a native device that actually ran the coordinator. Every entrypoint still requires the account-wide fence and offline-next-launch class.

## Manual release gate

For each signed beta/prod candidate, the operator records exact app/backend provenance, intercepted data-only payload shape, one admitted foreground/background-handler lifecycle, the complete race matrix, crash variants, and entrypoint-specific deletion classes in `evidence.schema.json` format. Missing rows, nonzero counts, stale content, cross-plane identity, unclassified deletion evidence, or provenance drift blocks release.

Minimum-OS push E2E, automatic upload, KPI/SLO observation, device exactly-once, and iOS terminated delivery reliability remain out of scope. Those exclusions never waive startup purge, account isolation, or visible-content privacy.
