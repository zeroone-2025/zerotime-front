# Mobile release runbook (`mobile-release.v1`)

## Purpose and hard boundaries

This runbook is a human-operated beta/prod release procedure for the Capacitor app. It records what must be proven before a person manually uploads an artifact; it does not automate upload, submission, rollout, or store metadata changes.

Do not treat a successful archive as push readiness. The native notification barrier in `native-notification-barrier.v1.md`, the recorded evidence validated by `evidence.schema.json`, and the privacy/store crosswalk are separate required release inputs.

Out of scope for this runbook:

- automatic upload or automatic store-track promotion;
- KPI/SLO collection or release-go/no-go based on an aggregate metric;
- minimum-OS push end-to-end testing;
- automatic OS notification display from a provider payload.

## 1. Freeze the build identity before building

For every candidate, the release owner creates one human-readable identity record containing:

| Field | Required value/source | Rule |
|---|---|---|
| Release plane | `beta` or `prod` | A beta artifact must use beta API and beta push credentials; a prod artifact must use prod API and prod push credentials. |
| App commit and artifact digest | Exact source commit and final IPA/AAB hash | Never reuse an evidence record for a rebuilt artifact. |
| API origin | `https://beta-api.zerotime.kr` or `https://api.zerotime.kr` | Captured at web-asset build time through `NEXT_PUBLIC_API_BASE_URL_NATIVE`. |
| Contract digest | Exact SHA-256 of `mobile-release-v1.openapi.yaml` in the app manifest, app evidence, backend evidence, and `/health/release` | All four values must equal the committed sidecar digest; a literal or mutable evidence reference is not a substitute. |
| iOS identity | Bundle ID, marketing version, build number, signing team, APNs environment/key reference | Record references/identifiers, never private key material. |
| Android identity | application ID, version name/code, signing certificate fingerprint reference, Firebase project/sender reference | A higher `versionCode` is required for each Play upload. |
| Push identity | Firebase project, FCM sender/project reference, APNs environment/key reference, installation generation contract version | The tuple must belong to the same release plane as the API origin. |
| Evidence provenance | `mobile-release.v1` record ID | It must identify the exact app and backend deployment. |

### Current source-derived identities

The following are facts from the current source, not a declaration that the necessary store/provider registrations already exist.

| Platform/variant | Current code identity | Release implication |
|---|---|---|
| iOS | `kr.zerotime.app`; `MARKETING_VERSION = 1.0`; `CURRENT_PROJECT_VERSION = 1`; iOS deployment target 15.0 (`ios/App/App.xcodeproj/project.pbxproj`) | The project has no separate iOS beta bundle/configuration. TestFlight beta therefore shares this bundle identity unless a reviewed native configuration adds a distinct one. Do not claim isolated beta identity merely because it points at a beta API. |
| Android `dev` flavor | `kr.zerotime.app.dev`, version-name suffix `-dev` (`android/app/build.gradle`) | This is a distinct package and must have its own approved Firebase Android app/configuration if it receives FCM. It is not automatically a Play beta artifact. |
| Android `beta` flavor | `kr.zerotime.app`, version-name suffix `-beta` (`android/app/build.gradle`) | Uses the production package identity for a Play internal/beta track; it must still use a distinct beta Firebase project and must never be uploaded as the production candidate. |
| Android `prod` flavor | `kr.zerotime.app`, current `versionName 1.0`, `versionCode 1` (`android/app/build.gradle`) | Use for a production-identity Play artifact only after the version code and signing identity are manually set and recorded. |
| Native API selection | `run-ios.sh beta` injects `https://beta-api.zerotime.kr`; `run-ios.sh prod` injects `https://api.zerotime.kr` and enables the fail-closed embedded provenance gate | The operator must supply the remaining `NEXT_PUBLIC_MOBILE_RELEASE_*` identity values; missing or cross-plane values stop the build before compilation. |

The Android project conditionally applies Google Services only when `android/app/google-services.json` is present; that file is ignored. No credential, Firebase project, APNs key, or Google Services file is evidence of readiness merely because it exists on a release Mac. The operator must record the non-secret configuration references in the identity record.
### Verified-link asset release gate

The public association assets are generated only from real release-owner inputs. They have no checked-in defaults, placeholders, or fallback identities.

| Environment variable | Required exact format |
|---|---|
| `MOBILE_RELEASE_APPLE_TEAM_ID` | The actual Apple Developer Team ID: exactly 10 uppercase letters or digits. |
| `MOBILE_RELEASE_ANDROID_CERT_SHA256_FINGERPRINTS` | One or more actual Android signing-certificate SHA-256 fingerprints, comma-separated with no whitespace; every fingerprint is uppercase colon-delimited byte pairs. |

In the release shell, set both variables from the approved Apple Developer and Play Console signing records, then run:

```bash
npm run verified-links:generate
npm run verified-links:check
```

Generation writes `public/.well-known/apple-app-site-association` and `public/.well-known/assetlinks.json`. The checker recreates their expected bytes from the current environment and fails for absent or malformed inputs, missing files, or any mismatch. The assets bind only `kr.zerotime.app` to `/auth/native/callback/`; they contain no wildcard, bearer, or query callback association. The Android document supplies the exact dynamic App Link component rule, while the native intent filter remains the exact-path fence on earlier Android releases.

`public/` is copied unchanged into the static export, so run the checker after generation and again from the release environment before deploying the static assets. Do not add either identity as a source default or substitute a sample value.

## 2. Separate Firebase, FCM, and APNs by plane

A push plane is the ordered tuple:

```
(release plane, app package/bundle, API origin, Firebase project, FCM sender/project,
 APNs environment and key reference, signing identity, installation generation)
```

Rules:

1. Beta and prod use separate Firebase project/sender credentials and separately approved APNs configuration references. Firebase service credentials never cross planes. An APNs key may serve both release planes only when the Apple team policy explicitly approves that shared key; the evidence record still identifies the exact key and environment used by each artifact.
2. Each Firebase app registration must exactly match the signed Android application ID or iOS bundle ID. Android `dev` and `prod` are distinct application IDs; do not reuse an Android config merely because the display name is similar.
3. The iOS APNs environment must match the signing/export path: development-signed builds use the sandbox environment, while TestFlight and App Store distribution use the production environment. Record the Apple key ID/team reference, not the `.p8` contents.
4. FCM is transport only. The backend constructs the v1 data-only payload and the client coordinator determines whether a local display is allowed. Firebase Console notification-composer alerts are prohibited for this flow.
5. Installation generations are server-controlled. A re-registration, account switch, logout, or deletion must not let an earlier generation authorize display. Never place a generation, subject, or auth version in the push payload.
6. Store Firebase/APNs secrets in the approved secret manager or developer portal only. They are never committed, copied to reviewer notes, attached to evidence, or placed in this runbook.

If any member of the tuple is unknown, cross-plane, or cannot be evidenced, stop before upload and correct the configuration; do not “test with prod” as a substitute.

## 3. Build and native preflight (manual)

1. Release owner selects `beta` or `prod`, fills the identity record, and obtains the matching backend deployment/OpenAPI provenance.
2. A macOS operator exports the required `NEXT_PUBLIC_MOBILE_RELEASE_*` provenance values and runs `run-ios.sh beta|prod`; the helper enables `CAPACITOR_BUILD=true`, validates the tuple, builds static assets, and synchronizes Capacitor. Android operators perform the equivalent validated static build, `cap sync android`, and selected Gradle flavor/release build.
2a. On the release Mac, resolve Swift packages and verify `firebase-ios-sdk` is locked to exact `12.0.0` in `ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved`. A missing Firebase pin, a different version, or an unresolved package graph blocks archive approval.
3. Before OAuth QA, set the two verified-link environment variables from the real signing records, run `npm run verified-links:generate` followed by `npm run verified-links:check`, then deploy and fetch both documents over public HTTPS without authentication: `https://zerotime.kr/.well-known/apple-app-site-association` must name the real Apple Team ID plus `kr.zerotime.app`, and `https://zerotime.kr/.well-known/assetlinks.json` must name `kr.zerotime.app` plus the actual release signing-certificate SHA-256 fingerprint. Both must restrict handling to `/auth/native/callback/`. These identity values are external and intentionally are not fabricated in source; their absence is an upload blocker.
4. In Xcode, verify target `App` bundle ID/version/build number, release signing team, distribution profile, production APNs entitlement, associated-domain entitlement, and the matching `GoogleService-Info.plist`. Increment the build number before each upload.
5. In Android Studio/Gradle signing configuration, verify application ID, `versionCode`, `versionName`, upload/signing identity, App Links verification, and the selected Firebase configuration reference. Increment `versionCode` before each upload.
6. Confirm the candidate has no local/test API URL, cleartext transport, broad navigation allowlist, custom-scheme bearer callback, diagnostic authentication bypass, developer signing, or credentials embedded in the web export or native resources.
7. Confirm the installed artifact exposes the same embedded frontend/backend SHA, backend image/deployment, contract hash, API origin, Firebase project, app version/build, and bundle/package ID recorded by `/health/release` and the release identity.
8. Run only the human scenarios recorded in the evidence contract: data-only delivery lifecycle, account-mutation races, and deletion evidence classes. This runbook does not authorize a minimum-OS push E2E claim.
9. Attach the schema-valid evidence record, privacy crosswalk review, verified-link fetches, and release identity record to the manual release change/review.

## 4. Signing recovery

### Apple

For “no profile,” expired certificate, or team mismatch:

1. Stop the archive/upload attempt and capture the exact Xcode/Organizer message in the release record without credentials or provisioning profile contents.
2. Confirm the intended bundle ID (`kr.zerotime.app` for the current target), Apple Developer team, distribution method, and desired APNs environment. Do not change the bundle ID to make signing succeed.
3. In Apple Developer, inventory existing certificates/profiles first. Revoke only a confirmed-unused certificate/profile according to the team’s access policy; a revocation can break another maintainer’s build.
4. Create or refresh the matching Apple Distribution certificate and App Store provisioning profile, or restore automatic signing only after confirming it selects the same team and App ID. Keep private keys in approved key storage.
5. Re-open the project, verify Signing & Capabilities has no unresolved warning, archive again, and record the new non-secret certificate/profile references.

### Android

For missing, invalid, or changed upload key:

1. Stop before creating a new key. Compare the intended upload certificate fingerprint to the Play Console app-signing record.
2. Restore the approved upload key from controlled secret storage. If it is unavailable, use the Play Console upload-key reset/recovery process; do not replace the production signing identity ad hoc.
3. Verify the signed AAB package name and certificate reference, increase `versionCode`, and record the recovery event and new accepted fingerprint reference.
4. A debug key, `dev` package, or locally generated replacement key is not a recovery for a production artifact.

## 5. Manual distribution tracks

### TestFlight internal testing (beta)

1. In Xcode Organizer, archive the signed candidate and manually choose **Distribute App -> App Store Connect -> Upload**.
2. In App Store Connect, wait for processing, select the exact build identity record, complete export-compliance prompts truthfully, and assign only the designated **internal** TestFlight tester group.
3. Record the App Store Connect build number and tester-group reference in the evidence provenance. Do not enable external testing or App Store release from this procedure.

### Google Play internal testing (beta)

1. Manually upload the exact signed AAB to **Testing -> Internal testing** for the matching Play application ID.
2. Verify the displayed package/version code and internal tester list against the identity record before saving/publishing the internal track.
3. Record the Play release/version code and tester-list reference. Do not promote the artifact to closed, open, or production tracks from this procedure.

### Production submission

Production submission remains a manual store-owner action after the prod identity, evidence, metadata, and privacy review are all complete. The person performing it explicitly chooses the release/rollout state in each console. This document provides no automatic promotion path.

## 6. Store listing, privacy, and reviewer information

### Metadata checklist

The store owner manually verifies and records each item against the finished prod artifact:

| Item | Required review |
|---|---|
| App name and bundle/package identity | Match current signed artifact; source display name is `제로타임 - 전북대 공지 알리미` in Capacitor/iOS source, while Android flavor resources may differ. |
| Description, category, age rating, support URL, marketing URL, screenshots, preview media | Current Korean user-facing material; no test data, staging URL, or unsupported push claim. |
| Privacy policy and account deletion URL | Match the approved backend canonical inventory and `privacy-store-crosswalk.yaml`; deletion URL is `https://zerotime.kr/account-deletion/`. |
| Apple Privacy Nutrition Label / PrivacyInfo | Reconcile with the crosswalk and the shipped `PrivacyInfo.xcprivacy`; do not rely on an empty manifest as a statement about backend collection. |
| Google Data safety | Reconcile with the same inventory/crosswalk by data category, purpose, sharing, encryption, and deletion behavior. |
| Push and login disclosures | State only the data-only/locally admitted behavior that the reviewed artifact implements; list all available OAuth providers accurately. |

### Reviewer notes and sample access

The review-notes owner enters current, revocable reviewer access directly in App Store Connect/Play Console. Credentials, tokens, private keys, and a real reviewer account are never stored in this repository or release evidence.

Required reviewer-note content:

- app purpose and Korean/English navigation context;
- every available OAuth route: Google, Apple, Naver, and Kakao;
- an active reviewer test-account path or a truthful explanation of the provider-hosted authentication flow, plus support contact and a reset/revocation plan;
- the in-app account deletion path (`/profile`) and public deletion URL;
- an explanation that remote push is data-only and does not auto-display an OS alert;
- any feature access prerequisites and their current test data.

Use this as a console-only template and replace every bracketed field before submission; bracketed text is not submission-ready:

> ZeroTime is a Korean university-notice app. Review entry: [current navigation steps]. Authentication supports Google, Apple, Naver, and Kakao. Use [secure reviewer account or provider-flow instructions] and contact [current support contact] if access fails. Account deletion is available at Profile -> 회원 탈퇴 and https://zerotime.kr/account-deletion/. Notifications use data-only transport; the app locally displays only after authorization. Test data/prerequisites: [current verified data].

## 7. Manual RACI

| Activity | Responsible (does work) | Accountable (approves) | Consulted | Informed |
|---|---|---|---|---|
| Plane/identity record and artifact provenance | Release operator | Release owner | Backend owner, native owner | Store owner |
| Firebase/FCM/APNs registration separation | Push/platform operator | Release owner | Backend owner, security/privacy owner | Store owner |
| iOS signing/archive/TestFlight internal upload | iOS release operator | Store owner | Release owner | Backend owner |
| Android signing/AAB/Play internal upload | Android release operator | Store owner | Release owner | Backend owner |
| Native barrier and deletion evidence review | Native owner | Release owner | Backend owner, privacy owner | Store owner |
| Apple Privacy, PrivacyInfo, Google Data safety, policy/deletion URLs | Privacy owner | Release owner | Backend owner, store owner | Native owner |
| Store listing, screenshots, reviewer notes, tester access | Store owner | Store owner | Privacy owner, release owner | Support owner |
| Final production submission/rollout decision | Store owner | Release owner | All named approvers | Team/support |

A single person may hold multiple roles, but the release record must name the humans actually performing and approving the activity. “The system” is never a RACI participant.
