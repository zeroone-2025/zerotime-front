import Capacitor
import CryptoKit
import Foundation
import Security
import UIKit
import UserNotifications

/**
 * Native endpoint for `native-notification-coordinator.v1`.
 *
 * JavaScript can request native operations, but it never owns authorization,
 * admission, epochs, receipts, titles, the notification registry, or the zero
 * barrier.
 */
@objc(NativeNotificationCoordinator)
public final class NativeNotificationCoordinatorPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeNotificationCoordinator"
    public let jsName = "NativeNotificationCoordinator"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getOrCreateInstallationId", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "initialize", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "bindSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateSessionGenerations", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "beginDisplayAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scheduleAuthorizedNotification", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "abortDisplayAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "beginTapAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "completeTapAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "abortTapAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "beginAccountMutation", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "finalizeAccountMutation", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getAccountMutationLineage", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getDisplayPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestDisplayPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openNotificationSettings", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isSecureCredentialStorageAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getSecureCredential", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setSecureCredential", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deleteSecureCredential", returnType: CAPPluginReturnPromise),
    ]

    private static let coordinator = NativeNotificationCoordinator()
    fileprivate static let credentialStore = KeychainCredentialStore()
    private static weak var livePlugin: NativeNotificationCoordinatorPlugin?

    override public func load() {
        super.load()
        Self.livePlugin = self
        Task { await Self.coordinator.pluginDidLoad() }
    }

    deinit {
        if Self.livePlugin === self {
            Self.livePlugin = nil
        }
    }

    @objc func getOrCreateInstallationId(_ call: CAPPluginCall) {
        guard Self.hasExactlyKeys(call.options, []) else {
            call.reject("Installation identity takes no arguments.")
            return
        }
        Task { Self.resolve(call, await Self.coordinator.getOrCreateInstallationId()) }
    }

    @objc func initialize(_ call: CAPPluginCall) {
        guard
            Self.hasExactlyKeys(call.options, ["coordinator_contract", "release_manifest"]),
            let contract = call.getString("coordinator_contract"),
            let manifest = call.getObject("release_manifest")
        else {
            call.reject("Native coordinator initialization payload is invalid.")
            return
        }
        Task { Self.resolve(call, await Self.coordinator.initialize(contract: contract, manifest: manifest)) }
    }

    @objc func bindSession(_ call: CAPPluginCall) {
        guard
            Self.hasExactlyKeys(call.options, ["session_id", "auth_version", "binding_generation", "token_generation", "authorization_bearer"]),
            let sessionID = call.getString("session_id"),
            Self.isUUID(sessionID),
            let authVersion = Self.canonicalPositiveSafeInteger(call.getString("auth_version")),
            let bindingGeneration = Self.positiveSafeInteger(call.options["binding_generation"]),
            let tokenGeneration = Self.positiveSafeInteger(call.options["token_generation"]),
            let authorizationBearer = Self.authorizationBearer(call.getString("authorization_bearer"))
        else {
            call.reject("Native notification session binding is invalid.")
            return
        }
        Task {
            Self.resolve(call, await Self.coordinator.bindSession(
                sessionID: sessionID.lowercased(),
                authVersion: authVersion,
                bindingGeneration: bindingGeneration,
                tokenGeneration: tokenGeneration,
                authorizationBearer: authorizationBearer
            ))
        }
    }

    @objc func updateSessionGenerations(_ call: CAPPluginCall) {
        guard
            Self.hasExactlyKeys(call.options, ["session_id", "binding_generation", "token_generation"]),
            let sessionID = call.getString("session_id"),
            Self.isUUID(sessionID),
            let bindingGeneration = Self.positiveSafeInteger(call.options["binding_generation"]),
            let tokenGeneration = Self.positiveSafeInteger(call.options["token_generation"])
        else {
            call.reject("Native notification generation update is invalid.")
            return
        }
        Task {
            Self.resolve(call, await Self.coordinator.updateSessionGenerations(
                sessionID: sessionID.lowercased(),
                bindingGeneration: bindingGeneration,
                tokenGeneration: tokenGeneration
            ))
        }
    }

    @objc func beginDisplayAuthorization(_ call: CAPPluginCall) {
        guard
            Self.hasExactlyKeys(call.options, ["delivery_id", "notice_id"]),
            let payload = DataOnlyPayload(call.options)
        else {
            call.reject("Display authorization payload is invalid.")
            return
        }
        Task { Self.resolve(call, await Self.coordinator.beginDisplayAuthorization(payload)) }
    }

    @objc func scheduleAuthorizedNotification(_ call: CAPPluginCall) {
        guard
            Self.hasExactlyKeys(call.options, ["operation_id"]),
            let operationID = Self.opaqueID(call.getString("operation_id"))
        else {
            call.reject("Authorized display scheduling payload is invalid.")
            return
        }
        Task { Self.resolve(call, await Self.coordinator.scheduleAuthorizedNotification(operationID: operationID)) }
    }

    @objc func abortDisplayAuthorization(_ call: CAPPluginCall) {
        abortAuthorization(call, kind: .display)
    }

    @objc func beginTapAuthorization(_ call: CAPPluginCall) {
        guard
            Self.hasExactlyKeys(call.options, ["delivery_id", "notice_id", "display_epoch"]),
            let payload = DataOnlyPayload(call.options),
            let displayEpoch = Self.canonicalDisplayEpoch(call.options["display_epoch"])
        else {
            call.reject("Tap authorization payload is invalid.")
            return
        }
        Task { Self.resolve(call, await Self.coordinator.beginTapAuthorization(payload, displayEpoch: displayEpoch)) }
    }

    @objc func completeTapAuthorization(_ call: CAPPluginCall) {
        guard
            Self.hasExactlyKeys(call.options, ["operation_id"]),
            let operationID = Self.opaqueID(call.getString("operation_id"))
        else {
            call.reject("Tap authorization completion payload is invalid.")
            return
        }
        Task { Self.resolve(call, await Self.coordinator.completeTapAuthorization(operationID: operationID)) }
    }

    @objc func abortTapAuthorization(_ call: CAPPluginCall) {
        abortAuthorization(call, kind: .tap)
    }

    @objc func beginAccountMutation(_ call: CAPPluginCall) {
        guard
            Self.hasExactlyKeys(call.options, ["reason"]),
            let reason = AccountMutationReason(rawValue: call.getString("reason") ?? "")
        else {
            call.reject("Account mutation reason is invalid.")
            return
        }
        Task { Self.resolve(call, await Self.coordinator.beginAccountMutation(reason)) }
    }

    @objc func finalizeAccountMutation(_ call: CAPPluginCall) {
        guard
            Self.hasExactlyKeys(call.options, ["reason", "display_epoch"]),
            let reason = AccountMutationReason(rawValue: call.getString("reason") ?? ""),
            let displayEpoch = Self.canonicalDisplayEpoch(call.options["display_epoch"])
        else {
            call.reject("Account mutation finalization payload is invalid.")
            return
        }
        Task { Self.resolve(call, await Self.coordinator.finalizeAccountMutation(reason, displayEpoch: displayEpoch)) }
    }
    @objc func getAccountMutationLineage(_ call: CAPPluginCall) {
        guard Self.hasExactlyKeys(call.options, []) else {
            call.reject("Account mutation lineage takes no arguments.")
            return
        }
        Task { Self.resolve(call, await Self.coordinator.getAccountMutationLineage()) }
    }


    @objc func getDisplayPermission(_ call: CAPPluginCall) {
        Task { Self.resolve(call, ["permission": await NativeNotificationCoordinator.displayPermission()]) }
    }

    @objc func requestDisplayPermission(_ call: CAPPluginCall) {
        Task { Self.resolve(call, ["permission": await NativeNotificationCoordinator.requestDisplayPermission()]) }
    }

    @objc func openNotificationSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard
                let settingsURL = URL(string: UIApplication.openSettingsURLString),
                UIApplication.shared.canOpenURL(settingsURL)
            else {
                Task { Self.resolve(call, await Self.coordinator.operationResult(success: false)) }
                return
            }
            UIApplication.shared.open(settingsURL, options: [:]) { success in
                Task { Self.resolve(call, await Self.coordinator.operationResult(success: success)) }
            }
        }
    }

    @objc func isSecureCredentialStorageAvailable(_ call: CAPPluginCall) {
        Task { Self.resolve(call, await Self.coordinator.secureCredentialStorageAvailability()) }
    }

    @objc func getSecureCredential(_ call: CAPPluginCall) {
        guard
            Self.hasExactlyKeys(call.options, ["key"]),
            let key = call.getString("key"),
            KeychainCredentialStore.isAllowedKey(key)
        else {
            call.reject("Invalid secure credential key.")
            return
        }
        Task {
            let result = await Self.coordinator.getSecureCredential(key: key)
            if let error = result["error"] as? String {
                Self.reject(call, error)
            } else {
                Self.resolve(call, result)
            }
        }
    }

    @objc func setSecureCredential(_ call: CAPPluginCall) {
        guard
            Self.hasExactlyKeys(call.options, ["key", "value"]),
            let key = call.getString("key"),
            KeychainCredentialStore.isAllowedKey(key),
            let value = call.getString("value"),
            !value.isEmpty,
            value.lengthOfBytes(using: .utf8) <= KeychainCredentialStore.maximumValueBytes
        else {
            call.reject("Invalid secure credential value.")
            return
        }
        Task { Self.resolve(call, await Self.coordinator.setSecureCredential(value, key: key)) }
    }

    @objc func deleteSecureCredential(_ call: CAPPluginCall) {
        guard
            Self.hasExactlyKeys(call.options, ["key"]),
            let key = call.getString("key"),
            KeychainCredentialStore.isAllowedKey(key)
        else {
            call.reject("Invalid secure credential key.")
            return
        }
        Task { Self.resolve(call, await Self.coordinator.deleteSecureCredential(key: key)) }
    }

    private func abortAuthorization(_ call: CAPPluginCall, kind: AuthorizationOperationKind) {
        guard
            Self.hasExactlyKeys(call.options, ["operation_id", "reason"]),
            let operationID = Self.opaqueID(call.getString("operation_id")),
            let reason = AuthorizationAbortReason(rawValue: call.getString("reason") ?? "")
        else {
            call.reject("Authorization abort payload is invalid.")
            return
        }
        Task { Self.resolve(call, await Self.coordinator.abortAuthorization(operationID: operationID, reason: reason, kind: kind)) }
    }

    static func runLaunchPreflight(
        firebaseConfigured: Bool,
        firebaseProjectID: String?
    ) async -> Bool {
        await coordinator.beginLaunchPreflight(
            firebaseConfigured: firebaseConfigured,
            firebaseProjectID: firebaseProjectID
        )
    }

    static func queueFCMRegistrationToken(_ token: String?) {
        guard let token, !token.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return
        }
        Task { await coordinator.receiveFCMRegistrationToken(token) }
    }

    static func handleAPNSDataOnlyPayload(_ data: [String: Any]) async -> NativeNotificationHandlingResult {
        let payload = DataOnlyPayload(data)
        coordinator.quarantineAPNSDataOnlyPayload(payload)
        return await coordinator.receiveAPNSDataOnlyPayload(payload)
    }

    static func completeForegroundPresentation(
        requestIdentifier: String,
        userInfo: [AnyHashable: Any],
        completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        Task {
            await coordinator.completeForegroundPresentation(
                requestIdentifier: requestIdentifier,
                payload: DataOnlyPayload(userInfo),
                completionHandler: completionHandler
            )
        }
    }

    static func handleNotificationTap(
        requestIdentifier: String,
        userInfo: [AnyHashable: Any]
    ) async {
        let payload = DataOnlyPayload(userInfo)
        coordinator.quarantineNotificationTap(requestIdentifier: requestIdentifier, payload: payload)
        await coordinator.captureNotificationTap(
            requestIdentifier: requestIdentifier,
            payload: payload
        )
    }

    static func queueVerifiedUniversalLink(
        application: UIApplication,
        userActivity: NSUserActivity,
        restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
    ) {
        Task {
            let permitted = await coordinator.preflightAllowsContentForwarding()
            DispatchQueue.main.async {
                guard permitted else {
                    restorationHandler(nil)
                    return
                }
                _ = ApplicationDelegateProxy.shared.application(
                    application,
                    continue: userActivity,
                    restorationHandler: restorationHandler
                )
            }
        }
    }


    fileprivate static func emit(_ event: String, data: [String: Any]) {
        DispatchQueue.main.async {
            livePlugin?.notifyListeners(event, data: data, retainUntilConsumed: true)
        }
    }

    private static func resolve(_ call: CAPPluginCall, _ data: [String: Any]) {
        DispatchQueue.main.async { call.resolve(data) }
    }

    private static func reject(_ call: CAPPluginCall, _ message: String) {
        DispatchQueue.main.async { call.reject(message) }
    }

    private static func hasExactlyKeys(_ values: [AnyHashable: Any], _ expected: [String]) -> Bool {
        var keys = Set<String>()
        for key in values.keys {
            guard let key = key as? String else { return false }
            keys.insert(key)
        }
        return keys == Set(expected)
    }

    fileprivate static func isUUID(_ value: String) -> Bool {
        UUID(uuidString: value) != nil
    }

    fileprivate static func opaqueID(_ value: String?) -> String? {
        guard
            let value,
            value.utf8.count <= 128,
            let first = value.utf8.first,
            (first >= 65 && first <= 90) || (first >= 97 && first <= 122) || (first >= 48 && first <= 57),
            value.utf8.allSatisfy({ byte in
                (byte >= 65 && byte <= 90) || (byte >= 97 && byte <= 122) || (byte >= 48 && byte <= 57)
                    || byte == 46 || byte == 95 || byte == 58 || byte == 45
            })
        else {
            return nil
        }
        return value
    }

    /// Display epochs are protocol-level uint64 decimal strings. The bridge
    /// intentionally rejects numeric epochs so JavaScript cannot round them.
    fileprivate static func canonicalDisplayEpoch(_ value: Any?) -> String? {
        guard let text = value as? String, !text.isEmpty, text.allSatisfy(\.isNumber), let parsed = UInt64(text) else {
            return nil
        }
        return String(parsed) == text ? text : nil
    }

    /// Auth versions are canonical positive JavaScript-safe decimal strings.
    fileprivate static func canonicalPositiveSafeInteger(_ value: String?) -> String? {
        guard
            let value,
            !value.isEmpty,
            value.utf8.first != 48,
            value.utf8.allSatisfy({ $0 >= 48 && $0 <= 57 }),
            let parsed = UInt64(value),
            parsed > 0,
            parsed <= 9_007_199_254_740_991,
            String(parsed) == value
        else {
            return nil
        }
        return value
    }

    /// Binding and token generations crossing the bridge are positive
    /// JavaScript-safe integers.
    fileprivate static func positiveSafeInteger(_ value: Any?) -> Int? {
        guard
            let parsed = nonNegativeSafeInteger(value),
            parsed > 0
        else {
            return nil
        }
        return parsed
    }

    fileprivate static func nonNegativeSafeInteger(_ value: Any?) -> Int? {
        guard
            let number = value as? NSNumber,
            CFGetTypeID(number) != CFBooleanGetTypeID()
        else {
            return nil
        }
        let double = number.doubleValue
        guard
            double.isFinite,
            double.rounded() == double,
            double >= 0,
            double <= Double(9_007_199_254_740_991)
        else {
            return nil
        }
        let parsed = Int(double)
        return Double(parsed) == double ? parsed : nil
    }

    /// The bridge sends the complete Authorization field value, never a raw
    /// token. Reject controls to prevent header injection.
    fileprivate static func authorizationBearer(_ value: String?) -> String? {
        guard
            let value,
            value.utf8.count > "Bearer ".utf8.count,
            value.utf8.count <= 16_384,
            value.hasPrefix("Bearer "),
            value.dropFirst("Bearer ".count).utf8.allSatisfy({ $0 > 0x20 && $0 <= 0x7e })
        else {
            return nil
        }
        return value
    }
    fileprivate static func nullable(_ value: String?) -> Any {
        guard let value = value else { return NSNull() }
        return value
    }

}

struct NativeNotificationHandlingResult {
    let disposition: String

    var backgroundFetchResult: UIBackgroundFetchResult {
        disposition == "admitted" ? .newData : .noData
    }
}

private struct DataOnlyPayload: Codable {
    let deliveryID: String
    let noticeID: String

    init?(_ values: [String: Any]) {
        guard
            values.count == 2,
            let deliveryID = values["delivery_id"] as? String,
            let noticeID = values["notice_id"] as? String
        else {
            return nil
        }
        self.init(deliveryID: deliveryID, noticeID: noticeID)
    }

    init?(_ values: [AnyHashable: Any]) {
        guard
            values.count >= 2,
            let deliveryID = values["delivery_id"] as? String,
            let noticeID = values["notice_id"] as? String
        else {
            return nil
        }
        self.init(deliveryID: deliveryID, noticeID: noticeID)
    }

    private init?(deliveryID: String, noticeID: String) {
        guard
            NativeNotificationCoordinatorPlugin.isUUID(deliveryID),
            Self.isPositiveDecimal(noticeID)
        else {
            return nil
        }
        self.deliveryID = deliveryID.lowercased()
        self.noticeID = noticeID
    }

    private static func isPositiveDecimal(_ value: String) -> Bool {
        !value.isEmpty && value.first != "0" && value.allSatisfy(\.isNumber) && UInt64(value) != nil
    }
}
private enum ColdPayloadKind {
    case dataOnly
    case tap
}

private struct QuarantinedColdPayload {
    let kind: ColdPayloadKind
    let payload: DataOnlyPayload
    let expiresAtMillis: Int64
}

private enum DisplayAdmission: String, Codable {
    case open
    case closing
    case closed
}

private enum MutationPhase: String, Codable {
    case unbound
    case bound
    case awaitingFinalize = "awaiting_finalize"
    case readyForRebind = "ready_for_rebind"
    case dormantRebind = "dormant_rebind"
    case terminal
    case corruptFailure = "corrupt_failure"
}

private enum AccountMutationReason: String, Codable {
    case logout
    case accountSwitch = "account_switch"
    case deletion
}

private enum AuthorizationOperationKind: String, Codable {
    case display
    case tap
}

private enum AuthorizationAbortReason: String, Codable {
    case denied
    case invalidAuthorization = "invalid_authorization"
    case expiredAuthorization = "expired_authorization"
    case transportFailed = "transport_failed"
    case nativeFailed = "native_failed"
    case staleOperation = "stale_operation"
}

private enum LocalNotificationPhase: String, Codable {
    case scheduling
    case scheduled
    case displayed
}

private struct NotificationRegistryEntry: Codable {
    let requestIdentifier: String
    let noticeID: String
    let displayEpoch: UInt64
    var phase: LocalNotificationPhase
    let createdAtMillis: Int64

    enum CodingKeys: String, CodingKey {
        case requestIdentifier = "request_identifier"
        case noticeID = "notice_id"
        case displayEpoch = "display_epoch"
        case phase
        case createdAtMillis = "created_at_millis"
    }
}

private struct DataOnlyHandoff: Codable {
    let noticeID: String
    let displayEpoch: UInt64
    let expiresAtMillis: Int64

    enum CodingKeys: String, CodingKey {
        case noticeID = "notice_id"
        case displayEpoch = "display_epoch"
        case expiresAtMillis = "expires_at_millis"
    }
}

private struct PendingTap: Codable {
    let noticeID: String
    let displayEpoch: UInt64
    let requestIdentifier: String
    let expiresAtMillis: Int64

    enum CodingKeys: String, CodingKey {
        case noticeID = "notice_id"
        case displayEpoch = "display_epoch"
        case requestIdentifier = "request_identifier"
        case expiresAtMillis = "expires_at_millis"
    }
}

private struct AuthorizationOperation: Codable, Equatable {
    let kind: AuthorizationOperationKind
    let deliveryID: String
    let noticeID: String
    let displayEpoch: UInt64
    let sessionMarker: String
    let bindingGeneration: Int
    let tokenGeneration: Int
    let expiresAtMillis: Int64

    enum CodingKeys: String, CodingKey {
        case kind
        case deliveryID = "delivery_id"
        case noticeID = "notice_id"
        case displayEpoch = "display_epoch"
        case sessionMarker = "session_marker"
        case bindingGeneration = "binding_generation"
        case tokenGeneration = "token_generation"
        case expiresAtMillis = "expires_at_millis"
    }
}

private struct UsedAuthorizationReceipt: Codable {
    let deliveryID: String
    let noticeID: String
    let displayEpoch: UInt64
    let bindingGeneration: Int
    let tokenGeneration: Int
    let expiresAtMillis: Int64

    enum CodingKeys: String, CodingKey {
        case deliveryID = "delivery_id"
        case noticeID = "notice_id"
        case displayEpoch = "display_epoch"
        case bindingGeneration = "binding_generation"
        case tokenGeneration = "token_generation"
        case expiresAtMillis = "expires_at_millis"
    }
}

private struct AuthorizationReceipt {
    let authorizationID: String
    let payload: DataOnlyPayload
    let displayEpoch: UInt64
    let bindingGeneration: Int
    let tokenGeneration: Int
    let expiresAtMillis: Int64

    init?(
        authorizationID: String,
        deliveryID: String,
        noticeID: String,
        displayEpoch: String,
        bindingGeneration: Int,
        tokenGeneration: Int,
        authorizationExpiry: String
    ) {
        guard
            let authorizationID = NativeNotificationCoordinatorPlugin.opaqueID(authorizationID),
            let payload = DataOnlyPayload([
                "delivery_id": deliveryID,
                "notice_id": noticeID,
            ]),
            let parsedDisplayEpoch = UInt64(displayEpoch),
            let expiresAtMillis = Self.utcMillis(authorizationExpiry)
        else {
            return nil
        }
        self.authorizationID = authorizationID
        self.payload = payload
        self.displayEpoch = parsedDisplayEpoch
        self.bindingGeneration = bindingGeneration
        self.tokenGeneration = tokenGeneration
        self.expiresAtMillis = expiresAtMillis
    }

    private static func utcMillis(_ value: String) -> Int64? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = formatter.date(from: value) ?? ISO8601DateFormatter().date(from: value)
        guard let date else { return nil }
        let milliseconds = date.timeIntervalSince1970 * 1_000
        guard milliseconds.isFinite, milliseconds >= 0, milliseconds <= Double(Int64.max) else { return nil }
        return Int64(milliseconds.rounded(.towardZero))
    }
}
private func canonicalPositiveJSONInteger(_ value: Any?) -> String? {
    guard
        let number = value as? NSNumber,
        CFGetTypeID(number) != CFBooleanGetTypeID(),
        let parsed = UInt64(number.stringValue),
        parsed > 0,
        String(parsed) == number.stringValue
    else {
        return nil
    }
    return String(parsed)
}
private func exactJSONBoolean(_ value: Any?) -> Bool? {
    guard
        let number = value as? NSNumber,
        CFGetTypeID(number) == CFBooleanGetTypeID()
    else {
        return nil
    }
    return number.boolValue
}
private struct JSONDuplicateKeyValidator {
    private let bytes: [UInt8]
    private var index = 0

    init(_ data: Data) {
        bytes = Array(data)
    }

    mutating func hasNoDuplicateKeys() -> Bool {
        skipWhitespace()
        guard parseObject() else { return false }
        skipWhitespace()
        return index == bytes.count
    }

    private mutating func parseObject() -> Bool {
        guard consume(0x7B) else { return false }
        skipWhitespace()
        if consume(0x7D) { return true }

        var keys = Set<String>()
        while true {
            skipWhitespace()
            guard let key = parseString(), keys.insert(key).inserted else { return false }
            skipWhitespace()
            guard consume(0x3A) else { return false }
            skipWhitespace()
            guard parseValue() else { return false }
            skipWhitespace()
            if consume(0x2C) { continue }
            return consume(0x7D)
        }
    }

    private mutating func parseArray() -> Bool {
        guard consume(0x5B) else { return false }
        skipWhitespace()
        if consume(0x5D) { return true }

        while true {
            guard parseValue() else { return false }
            skipWhitespace()
            if consume(0x2C) {
                skipWhitespace()
                continue
            }
            return consume(0x5D)
        }
    }

    private mutating func parseValue() -> Bool {
        skipWhitespace()
        guard index < bytes.count else { return false }
        switch bytes[index] {
        case 0x7B:
            return parseObject()
        case 0x5B:
            return parseArray()
        case 0x22:
            return parseString() != nil
        default:
            return parsePrimitive()
        }
    }

    private mutating func parseString() -> String? {
        guard consume(0x22) else { return nil }
        let start = index - 1
        while index < bytes.count {
            let byte = bytes[index]
            if byte == 0x22 {
                index += 1
                var wrapped = Data([0x5B])
                wrapped.append(contentsOf: bytes[start..<index])
                wrapped.append(0x5D)
                guard
                    let object = try? JSONSerialization.jsonObject(with: wrapped),
                    let values = object as? [String],
                    values.count == 1
                else {
                    return nil
                }
                return values[0]
            }
            if byte == 0x5C {
                guard index + 1 < bytes.count else { return nil }
                index += 2
            } else {
                guard byte >= 0x20 else { return nil }
                index += 1
            }
        }
        return nil
    }

    private mutating func parsePrimitive() -> Bool {
        let start = index
        while index < bytes.count, !isValueDelimiter(bytes[index]) {
            index += 1
        }
        return index > start
    }

    private mutating func skipWhitespace() {
        while index < bytes.count, isWhitespace(bytes[index]) {
            index += 1
        }
    }

    private mutating func consume(_ byte: UInt8) -> Bool {
        guard index < bytes.count, bytes[index] == byte else { return false }
        index += 1
        return true
    }

    private func isWhitespace(_ byte: UInt8) -> Bool {
        byte == 0x20 || byte == 0x09 || byte == 0x0A || byte == 0x0D
    }

    private func isValueDelimiter(_ byte: UInt8) -> Bool {
        byte == 0x2C || byte == 0x5D || byte == 0x7D || isWhitespace(byte)
    }
}
private struct ServerAuthorization {
    let receipt: AuthorizationReceipt
    let title: String

    init?(_ values: [String: Any]) {
        let keys: Set<String> = [
            "authorized", "authorization_id", "authorization_expires_at_utc", "delivery_id",
            "client_display_epoch", "notice", "display", "installation",
        ]
        guard
            Set(values.keys) == keys,
            exactJSONBoolean(values["authorized"]) == true,
            let authorizationID = values["authorization_id"] as? String,
            let authorizationExpiry = values["authorization_expires_at_utc"] as? String,
            let deliveryID = values["delivery_id"] as? String,
            let displayEpoch = NativeNotificationCoordinatorPlugin.canonicalDisplayEpoch(values["client_display_epoch"]),
            let notice = values["notice"] as? [String: Any],
            Set(notice.keys) == Set<String>(["id", "public_title"]),
            let noticeID = canonicalPositiveJSONInteger(notice["id"]),
            let title = notice["public_title"] as? String,
            !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
            title.count <= 512,
            title.unicodeScalars.allSatisfy({ !CharacterSet.controlCharacters.contains($0) }),
            let display = values["display"] as? [String: Any],
            Set(display.keys) == Set<String>(["app_name"]),
            display["app_name"] as? String == "ZeroTime",
            let installation = values["installation"] as? [String: Any],
            Set(installation.keys) == Set<String>(["binding_generation", "token_generation"]),
            let bindingGeneration = NativeNotificationCoordinatorPlugin.positiveSafeInteger(installation["binding_generation"]),
            let tokenGeneration = NativeNotificationCoordinatorPlugin.positiveSafeInteger(installation["token_generation"]),
            let receipt = AuthorizationReceipt(
                authorizationID: authorizationID,
                deliveryID: deliveryID,
                noticeID: noticeID,
                displayEpoch: displayEpoch,
                bindingGeneration: bindingGeneration,
                tokenGeneration: tokenGeneration,
                authorizationExpiry: authorizationExpiry
            )
        else {
            return nil
        }
        self.receipt = receipt
        self.title = title
    }
}

private struct NotificationDurableState: Codable {
    static let version = 2

    let version: Int
    let installationID: String
    var displayEpoch: UInt64
    var admission: DisplayAdmission
    var mutationPhase: MutationPhase
    var mutationReason: AccountMutationReason?
    let sessionMarkerKey: Data
    var sessionMarker: String?
    var authVersion: String?
    var bindingGeneration: Int
    var tokenGeneration: Int
    var nextLaunchPurge: Bool
    var localPrivacyBarrierFailed: Bool
    var corruptState: Bool
    var foregroundPresentationIDs: Set<String>
    var registry: [String: NotificationRegistryEntry]
    var handoffs: [String: DataOnlyHandoff]
    var pendingTaps: [String: PendingTap]
    var operations: [String: AuthorizationOperation]
    var usedAuthorizationReceipts: [String: UsedAuthorizationReceipt]

    enum CodingKeys: String, CodingKey {
        case version
        case installationID = "installation_id"
        case displayEpoch = "display_epoch"
        case admission
        case mutationPhase = "mutation_phase"
        case mutationReason = "mutation_reason"
        case sessionMarkerKey = "session_marker_key"
        case sessionMarker = "session_marker"
        case authVersion = "auth_version"
        case bindingGeneration = "binding_generation"
        case tokenGeneration = "token_generation"
        case nextLaunchPurge = "next_launch_purge"
        case localPrivacyBarrierFailed = "local_privacy_barrier_failed"
        case corruptState = "corrupt_state"
        // Older v2 records may include namespace_rotation_reason. It is
        // intentionally ignored so removing dead metadata remains decodable.
        case foregroundPresentationIDs = "foreground_presentation_ids"
        case registry = "local_notification_registry"
        case handoffs = "data_only_handoffs"
        case pendingTaps = "pending_taps"
        case operations = "authorization_operations"
        case usedAuthorizationReceipts = "used_authorization_receipts"
    }

    static func initial(installationID: String = UUID().uuidString.lowercased()) throws -> NotificationDurableState {
        NotificationDurableState(
            version: version,
            installationID: installationID,
            displayEpoch: 0,
            admission: .closed,
            mutationPhase: .unbound,
            mutationReason: nil,
            sessionMarkerKey: try randomMarkerKey(),
            sessionMarker: nil,
            authVersion: nil,
            bindingGeneration: 0,
            tokenGeneration: 0,
            nextLaunchPurge: false,
            localPrivacyBarrierFailed: false,
            corruptState: false,
            foregroundPresentationIDs: [],
            registry: [:],
            handoffs: [:],
            pendingTaps: [:],
            operations: [:],
            usedAuthorizationReceipts: [:]
        )
    }

    static func corruptRecovery() throws -> NotificationDurableState {
        var recovered = try initial()
        recovered.displayEpoch = UInt64.max
        recovered.admission = .closing
        recovered.mutationPhase = .corruptFailure
        recovered.nextLaunchPurge = true
        recovered.localPrivacyBarrierFailed = true
        recovered.corruptState = true
        return recovered
    }

    var isValid: Bool {
        guard
            version == Self.version,
            NativeNotificationCoordinatorPlugin.isUUID(installationID),
            sessionMarkerKey.count == 32,
            bindingGeneration >= 0,
            tokenGeneration >= 0,
            bindingGeneration <= 9_007_199_254_740_991,
            tokenGeneration <= 9_007_199_254_740_991,
            authVersion.map({ NativeNotificationCoordinatorPlugin.canonicalPositiveSafeInteger($0) == $0 }) ?? true,
            sessionMarker.map({ $0.count == 64 && $0.allSatisfy(\.isHexDigit) }) ?? true,
            NativeNotificationCoordinatorProtocolLimits.acceptsStoredCount(handoffs.count),
            NativeNotificationCoordinatorProtocolLimits.acceptsStoredCount(pendingTaps.count),
            NativeNotificationCoordinatorProtocolLimits.acceptsStoredCount(operations.count),
            usedAuthorizationReceipts.count <= NativeNotificationCoordinator.maximumUsedReceipts,
            registry.count <= NativeNotificationCoordinator.maximumRegistryEntries,
            foregroundPresentationIDs.count <= NativeNotificationCoordinator.maximumForegroundPresentationIDs,
            foregroundPresentationIDs.isSubset(of: Set(registry.keys))
        else {
            return false
        }

        if admission == .open {
            guard
                mutationPhase == .bound,
                sessionMarker != nil,
                bindingGeneration > 0,
                tokenGeneration > 0,
                !localPrivacyBarrierFailed,
                !corruptState
            else {
                return false
            }
        }
        if mutationPhase == .bound && (bindingGeneration <= 0 || tokenGeneration <= 0) { return false }
        if mutationPhase == .corruptFailure && (!corruptState || !localPrivacyBarrierFailed) { return false }
        if (mutationPhase == .terminal || mutationPhase == .corruptFailure) && admission == .open { return false }
        switch mutationPhase {
        case .awaitingFinalize:
            guard mutationReason != nil else { return false }
        case .unbound:
            guard mutationReason == nil || mutationReason == .logout else { return false }
        case .readyForRebind:
            guard mutationReason == nil || mutationReason == .accountSwitch else { return false }
        case .terminal:
            guard mutationReason == .deletion else { return false }
        case .bound, .dormantRebind, .corruptFailure:
            guard mutationReason == nil else { return false }
        }
        let hasCompletedMutationReceipt = (mutationPhase == .unbound && mutationReason == .logout)
            || (mutationPhase == .readyForRebind && mutationReason == .accountSwitch)
            || (mutationPhase == .terminal && mutationReason == .deletion)
        if hasCompletedMutationReceipt {
            guard
                sessionMarker == nil,
                authVersion == nil,
                !corruptState,
                (
                    (admission == .closed && !nextLaunchPurge)
                        || (admission == .closing && nextLaunchPurge)
                )
            else {
                return false
            }
        }

        return registry.allSatisfy { deliveryID, entry in
            NativeNotificationCoordinatorPlugin.isUUID(deliveryID)
                && DataOnlyPayload(["delivery_id": deliveryID, "notice_id": entry.noticeID]) != nil
                && entry.requestIdentifier == NativeNotificationCoordinator.requestIdentifier(for: deliveryID)
                && entry.createdAtMillis > 0
        } && handoffs.allSatisfy { deliveryID, handoff in
            NativeNotificationCoordinatorPlugin.isUUID(deliveryID)
                && DataOnlyPayload(["delivery_id": deliveryID, "notice_id": handoff.noticeID]) != nil
                && handoff.expiresAtMillis > 0
        } && pendingTaps.allSatisfy { deliveryID, tap in
            NativeNotificationCoordinatorPlugin.isUUID(deliveryID)
                && DataOnlyPayload(["delivery_id": deliveryID, "notice_id": tap.noticeID]) != nil
                && tap.requestIdentifier == NativeNotificationCoordinator.requestIdentifier(for: deliveryID)
                && tap.expiresAtMillis > 0
        } && operations.allSatisfy { operationID, operation in
            NativeNotificationCoordinatorPlugin.isUUID(operationID)
                && DataOnlyPayload(["delivery_id": operation.deliveryID, "notice_id": operation.noticeID]) != nil
                && operation.sessionMarker.count == 64
                && operation.bindingGeneration > 0
                && operation.bindingGeneration <= 9_007_199_254_740_991
                && operation.tokenGeneration > 0
                && operation.tokenGeneration <= 9_007_199_254_740_991
                && operation.expiresAtMillis > 0
        } && usedAuthorizationReceipts.allSatisfy { receiptID, receipt in
            NativeNotificationCoordinatorPlugin.opaqueID(receiptID) != nil
                && DataOnlyPayload(["delivery_id": receipt.deliveryID, "notice_id": receipt.noticeID]) != nil
                && receipt.bindingGeneration > 0
                && receipt.bindingGeneration <= 9_007_199_254_740_991
                && receipt.tokenGeneration > 0
                && receipt.tokenGeneration <= 9_007_199_254_740_991
                && receipt.expiresAtMillis > 0
        }
    }

    private static func randomMarkerKey() throws -> Data {
        var bytes = [UInt8](repeating: 0, count: 32)
        let status = bytes.withUnsafeMutableBytes { buffer in
            SecRandomCopyBytes(kSecRandomDefault, buffer.count, buffer.baseAddress!)
        }
        guard status == errSecSuccess else {
            throw KeychainStateError.write(errSecAllocate)
        }
        return Data(bytes)
    }
}

private final class KeychainNotificationStateStore {
    private let service = "kr.zerotime.app.native-notification-coordinator"
    private let stateAccount = "state.v1"
    private let journalAccount = "state.journal.v1"

    /// A surviving journal is the fully encoded next state. It is authoritative
    /// until its exact bytes have been restored to a canonical primary item.
    func read() throws -> Data? {
        if let journal = try readItem(account: journalAccount) {
            guard Self.isValidDurableState(journal.data) else {
                throw KeychainStateError.invalidJournal
            }
            do {
                try replace(journal.data, account: stateAccount)
                guard try primaryMatchesCanonical(journal.data) else {
                    throw KeychainStateError.write(errSecParam)
                }
                try remove(account: journalAccount)
            } catch {
                throw KeychainStateError.journalRecoveryFailed
            }
            return journal.data
        }
        guard let item = try readItem(account: stateAccount) else { return nil }
        if !isCanonical(item.attributes) {
            try write(item.data)
        }
        return item.data
    }
    /// This diagnostic path never repairs keychain state. A valid journal remains
    /// authoritative and is returned byte-for-byte.
    func readOnly() throws -> Data? {
        if let journal = try readItem(account: journalAccount) {
            guard Self.isValidDurableState(journal.data) else {
                throw KeychainStateError.invalidJournal
            }
            return journal.data
        }
        return try readItem(account: stateAccount)?.data
    }

    private static func isValidDurableState(_ data: Data) -> Bool {
        guard
            let decoded = try? JSONDecoder().decode(NotificationDurableState.self, from: data),
            decoded.isValid
        else {
            return false
        }
        return true
    }

    private func primaryMatchesCanonical(_ data: Data) throws -> Bool {
        guard let primary = try readItem(account: stateAccount) else { return false }
        return primary.data == data && isCanonical(primary.attributes)
    }


    /// Keychain updates are atomic for an existing item. A durable journal
    /// closes the add/replace crash window and is removed only after the new
    /// primary state has been verified as canonical.
    func write(_ data: Data) throws {
        try replace(data, account: journalAccount)
        try replace(data, account: stateAccount)
        guard try attributesAreCanonical(account: stateAccount) else {
            throw KeychainStateError.write(errSecParam)
        }
        try remove(account: journalAccount)
    }

    private func readItem(account: String) throws -> (data: Data, attributes: [String: Any])? {
        var query = lookupQuery(account: account)
        query[kSecReturnData as String] = true
        query[kSecReturnAttributes as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound { return nil }
        guard
            status == errSecSuccess,
            let result = item as? [String: Any],
            let data = result[kSecValueData as String] as? Data
        else {
            throw KeychainStateError.read(status)
        }
        return (data, result)
    }

    private func replace(_ data: Data, account: String) throws {
        let attributes = canonicalAttributes(data: data)
        let updateStatus = SecItemUpdate(lookupQuery(account: account) as CFDictionary, attributes as CFDictionary)
        if updateStatus == errSecSuccess { return }
        guard updateStatus == errSecItemNotFound else {
            throw KeychainStateError.write(updateStatus)
        }

        var addQuery = baseQuery(account: account)
        addQuery.merge(attributes) { _, new in new }
        let addStatus = SecItemAdd(addQuery as CFDictionary, nil)
        guard addStatus == errSecSuccess else { throw KeychainStateError.write(addStatus) }
    }

    private func remove(account: String) throws {
        let status = SecItemDelete(lookupQuery(account: account) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainStateError.write(status)
        }
    }

    private func baseQuery(account: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }

    private func lookupQuery(account: String) -> [String: Any] {
        var query = baseQuery(account: account)
        query[kSecAttrSynchronizable as String] = kSecAttrSynchronizableAny
        return query
    }

    private func canonicalAttributes(data: Data) -> [String: Any] {
        [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            kSecAttrSynchronizable as String: kCFBooleanFalse as Any,
        ]
    }

    private func attributesAreCanonical(account: String) throws -> Bool {
        guard let item = try readItem(account: account) else {
            throw KeychainStateError.read(errSecItemNotFound)
        }
        return isCanonical(item.attributes)
    }

    private func isCanonical(_ attributes: [String: Any]) -> Bool {
        let accessible = attributes[kSecAttrAccessible as String] as? String
        let synchronizable = attributes[kSecAttrSynchronizable as String] as? Bool ?? false
        return accessible == (kSecAttrAccessibleWhenUnlockedThisDeviceOnly as String) && !synchronizable
    }
}

private enum KeychainStateError: Error {
    case read(OSStatus)
    case write(OSStatus)
    case invalidJournal
    case journalRecoveryFailed
}

private final class KeychainCredentialStore {
    static let maximumValueBytes = 65_536
    private static let service = "kr.zerotime.app.native-auth.credentials"
    static let privacyBarrierFailureKey = "zerotime.native-auth.privacy-barrier-failed.v1"
    static let corruptSessionAuditKey = "zerotime.native-auth.corrupt-session-audit.v1"
    static let deletionStatusKey = "zerotime.account-deletion.status.v1"
    static let deletionOperationKey = "zerotime.account-deletion.operation.v1"
    static let deletionOperationAuditKey = "zerotime.account-deletion.operation.audit.v1"
    static let deletionNativeReauthHandoffKey = "zerotime.account-deletion.native-reauth-handoff.v1"
    private static let allowedKeys: Set<String> = [
        "zerotime.native-auth.transient.v1",
        "zerotime.native-auth.refresh.v1",
        "zerotime.native-auth.session.v1",
        privacyBarrierFailureKey,
        corruptSessionAuditKey,
        deletionStatusKey,
        deletionOperationKey,
        deletionOperationAuditKey,
        deletionNativeReauthHandoffKey,
    ]

    static func isAllowedKey(_ key: String) -> Bool { allowedKeys.contains(key) }

    static func isPrivacyBarrierFailureKey(_ key: String) -> Bool { key == privacyBarrierFailureKey }
    static func isRecoveryKey(_ key: String) -> Bool {
        isPrivacyBarrierFailureKey(key) || key == corruptSessionAuditKey
    }
    static func isDeletionLifecycleKey(_ key: String) -> Bool {
        key == deletionStatusKey
            || key == deletionOperationKey
            || key == deletionOperationAuditKey
            || key == deletionNativeReauthHandoffKey
    }

    func isAvailable() -> Bool {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: Self.service,
            kSecAttrSynchronizable as String: kSecAttrSynchronizableAny,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        query[kSecReturnAttributes as String] = true
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        return status == errSecSuccess || status == errSecItemNotFound
    }
    /// A missing coordinator record is a first install only after every
    /// credential namespace has been queried and found absent. This check does
    /// not read or canonicalize credential values.
    func allAllowedCredentialsAreAbsent() throws -> Bool {
        for key in Self.allowedKeys {
            var query = lookupQuery(key: key)
            query[kSecMatchLimit as String] = kSecMatchLimitOne
            let status = SecItemCopyMatching(query as CFDictionary, nil)
            if status == errSecItemNotFound { continue }
            if status == errSecSuccess { return false }
            throw KeychainCredentialError.read(status)
        }
        return true
    }
    func hasRefreshOrSessionCredentials() throws -> Bool {
        for key in [
            "zerotime.native-auth.refresh.v1",
            "zerotime.native-auth.session.v1",
        ] {
            var query = lookupQuery(key: key)
            query[kSecMatchLimit as String] = kSecMatchLimitOne
            let status = SecItemCopyMatching(query as CFDictionary, nil)
            if status == errSecItemNotFound { continue }
            if status == errSecSuccess { return true }
            throw KeychainCredentialError.read(status)
        }
        return false
    }


    func read(key: String) throws -> String? {
        var query = lookupQuery(key: key)
        query[kSecReturnData as String] = true
        query[kSecReturnAttributes as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound { return nil }
        guard
            status == errSecSuccess,
            let result = item as? [String: Any],
            let data = result[kSecValueData as String] as? Data,
            let value = String(data: data, encoding: .utf8)
        else {
            throw KeychainCredentialError.read(status)
        }
        if !isCanonical(result) { try write(value, key: key) }
        return value
    }

    func write(_ value: String, key: String) throws {
        guard value.lengthOfBytes(using: .utf8) <= Self.maximumValueBytes else { throw KeychainCredentialError.invalidValue }
        let data = Data(value.utf8)
        let attributes = canonicalAttributes(data: data)
        let updateStatus = SecItemUpdate(lookupQuery(key: key) as CFDictionary, attributes as CFDictionary)
        if updateStatus == errSecSuccess, try attributesAreCanonical(key: key) { return }
        if updateStatus != errSecSuccess && updateStatus != errSecItemNotFound && updateStatus != errSecParam {
            throw KeychainCredentialError.write(updateStatus)
        }

        let deleteStatus = SecItemDelete(lookupQuery(key: key) as CFDictionary)
        guard deleteStatus == errSecSuccess || deleteStatus == errSecItemNotFound else {
            throw KeychainCredentialError.write(deleteStatus)
        }
        var addQuery = baseQuery(key: key)
        addQuery.merge(attributes) { _, new in new }
        let addStatus = SecItemAdd(addQuery as CFDictionary, nil)
        guard addStatus == errSecSuccess, try attributesAreCanonical(key: key) else {
            throw KeychainCredentialError.write(addStatus)
        }
    }

    func remove(key: String) throws {
        let status = SecItemDelete(lookupQuery(key: key) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw KeychainCredentialError.remove(status) }
    }


    private func baseQuery(key: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: Self.service,
            kSecAttrAccount as String: key,
        ]
    }

    private func lookupQuery(key: String) -> [String: Any] {
        var query = baseQuery(key: key)
        query[kSecAttrSynchronizable as String] = kSecAttrSynchronizableAny
        return query
    }


    private func canonicalAttributes(data: Data) -> [String: Any] {
        [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            kSecAttrSynchronizable as String: kCFBooleanFalse as Any,
        ]
    }

    private func attributesAreCanonical(key: String) throws -> Bool {
        var query = lookupQuery(key: key)
        query[kSecReturnAttributes as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess, let attributes = item as? [String: Any] else {
            throw KeychainCredentialError.read(status)
        }
        return isCanonical(attributes)
    }

    private func isCanonical(_ attributes: [String: Any]) -> Bool {
        let accessible = attributes[kSecAttrAccessible as String] as? String
        let synchronizable = attributes[kSecAttrSynchronizable as String] as? Bool ?? false
        return accessible == (kSecAttrAccessibleWhenUnlockedThisDeviceOnly as String) && !synchronizable
    }
}

private enum KeychainCredentialError: Error {
    case read(OSStatus)
    case write(OSStatus)
    case remove(OSStatus)
    case invalidValue
}

/**
 * A single draining task owns durable transitions, notification scheduling, and
 * purge completion. Network authorization intentionally runs between FIFO turns.
 */
private final class FIFOCommandProcessor {
    private let lock = NSLock()
    private var commands: [() async -> Void] = []
    private var draining = false

    func submit<T>(_ operation: @escaping () async -> T) async -> T {
        await withCheckedContinuation { continuation in
            lock.lock()
            commands.append {
                continuation.resume(returning: await operation())
            }
            let startsDrain = !draining
            if startsDrain { draining = true }
            lock.unlock()
            if startsDrain {
                Task { await self.drain() }
            }
        }
    }

    private func drain() async {
        while true {
            lock.lock()
            guard !commands.isEmpty else {
                draining = false
                lock.unlock()
                return
            }
            let command = commands.removeFirst()
            lock.unlock()
            await command()
        }
    }
}
private final class RedirectRejectingURLSessionDelegate: NSObject, URLSessionTaskDelegate {
    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        willPerformHTTPRedirection response: HTTPURLResponse,
        newRequest request: URLRequest,
        completionHandler: @escaping (URLRequest?) -> Void
    ) {
        _ = session
        _ = task
        _ = response
        _ = request
        completionHandler(nil)
    }
}
private final class AuthorizationNetworkCancellation {
    private let lock = NSLock()
    private var cancelled = false
    private var session: URLSession?

    func attach(_ session: URLSession) -> Bool {
        lock.lock()
        guard !cancelled else {
            lock.unlock()
            session.invalidateAndCancel()
            return false
        }
        self.session = session
        lock.unlock()
        return true
    }

    func finish(_ session: URLSession) {
        lock.lock()
        if self.session === session {
            self.session = nil
        }
        lock.unlock()
    }

    func cancel() {
        lock.lock()
        cancelled = true
        let session = self.session
        lock.unlock()
        session?.invalidateAndCancel()
    }

    var isCancelled: Bool {
        lock.lock()
        defer { lock.unlock() }
        return cancelled
    }
}
private final class OnceNotificationEnumeration<Value> {
    private let lock = NSLock()
    private var continuation: CheckedContinuation<Value?, Never>?

    init(_ continuation: CheckedContinuation<Value?, Never>) {
        self.continuation = continuation
    }

    func resume(_ value: Value?) {
        lock.lock()
        let continuation = self.continuation
        self.continuation = nil
        lock.unlock()
        continuation?.resume(returning: value)
    }
}


private struct AuthorizationNetworkRequest {
    let operation: AuthorizationOperation
    let apiOrigin: URL
    let request: URLRequest
    let cancellation: AuthorizationNetworkCancellation
}

private enum CredentialOperation {
    case read
    case write
    case delete
}

/// Shared collection boundaries for cap-1/cap/cap+1 coordinator fixtures.
enum NativeNotificationCoordinatorProtocolLimits {
    static let collectionCap = 32

    static func acceptsInsertion(atCount count: Int) -> Bool {
        count >= 0 && count < collectionCap
    }

    static func acceptsStoredCount(_ count: Int) -> Bool {
        count >= 0 && count <= collectionCap
    }
}

private final class NativeNotificationCoordinator {
    static let maximumUsedReceipts = 128
    static let maximumRegistryEntries = 128
    static let maximumForegroundPresentationIDs = maximumRegistryEntries
    private static let maximumPendingFCMTokens = 1
    private static let coordinatorContract = "native-notification-coordinator.v1"
    private static let releaseContract = "mobile-release.v1"
    private static let releaseContractSHA256 = "0f736c8e90c5ba1ea68370e327f2f405fba5a83e4807c3bc7691aaa8c0711d84"
    private static let notificationPrefix = "zerotime.native-notification."
    private static let notificationCategory = "zerotime.native-notification.category.v1"
    private static let authorizationTTLMillis: Int64 = 30_000
    private static let handoffTTLMillis: Int64 = 10 * 60_000
    private static let tapTTLMillis: Int64 = 10 * 60_000
    private static let coldPayloadQuarantineTTLMillis: Int64 = 10 * 60_000
    private static let purgeAttempts = 3
    private static let authorizationRequestTimeout: TimeInterval = 10
    private static let authorizationResponseMaximumBytes = 16 * 1024
    private static let notificationEnumerationTimeout: TimeInterval = 1.5
    private static let unknownZeroCount = 9_007_199_254_740_991

    private let processor = FIFOCommandProcessor()
    private let stateStore = KeychainNotificationStateStore()
    private let coldPayloadLock = NSLock()
    private var state: NotificationDurableState?
    private var bootstrapped = false
    private var releaseValidated = false
    private var releaseConfigurationBlocked = false
    private var activeSessionID: String?
    private var authorizationBearer: String?
    private var validatedAPIOrigin: URL?
    private var runtimeFirebaseProjectID: String?
    private var pendingFCMTokens: [String] = []
    private var authorizationNetworkCancellations: [String: AuthorizationNetworkCancellation] = [:]
    private var hasEmittedPendingFCMTokensForCurrentBinding = false
    private var coldPayloadQuarantine: QuarantinedColdPayload?

    func beginLaunchPreflight(firebaseConfigured: Bool, firebaseProjectID: String?) async -> Bool {
        await processor.submit {
            self.runtimeFirebaseProjectID = firebaseConfigured ? firebaseProjectID : nil
            self.releaseConfigurationBlocked = !firebaseConfigured || firebaseProjectID?.isEmpty != false
            return await self.preflightLocked()
        }
    }
    /// The AppDelegate can deliver a cold APNs callback while launch preflight is
    /// already draining. Keep one identifier-only payload outside durable state
    /// until a verified bind creates a new display epoch.
    func quarantineAPNSDataOnlyPayload(_ payload: DataOnlyPayload?) {
        guard let payload else { return }
        quarantineColdPayload(payload, kind: .dataOnly)
    }

    func quarantineNotificationTap(requestIdentifier: String, payload: DataOnlyPayload?) {
        guard
            let payload,
            requestIdentifier == Self.requestIdentifier(for: payload.deliveryID)
        else {
            return
        }
        quarantineColdPayload(payload, kind: .tap)
    }


    func pluginDidLoad() async {
        _ = await processor.submit {
            guard await self.preflightLocked() else { return false }
            self.emitQueuedEventsLocked()
            return true
        }
    }

    func preflightAllowsContentForwarding() async -> Bool {
        await processor.submit { await self.preflightLocked() }
    }

    func getOrCreateInstallationId() async -> [String: Any] {
        await processor.submit {
            guard await self.preflightLocked(), let state = self.state else { return ["installation_id": NSNull()] }
            return ["installation_id": state.installationID]
        }
    }
    func getAccountMutationLineage() async -> [String: Any] {
        await processor.submit {
            let current = self.readOnlyDurableStateLocked()
            let reason = current.flatMap { self.ownedMutationReasonLocked($0) }
            let phase: String?
            if let current, reason != nil {
                if current.mutationPhase == .awaitingFinalize {
                    phase = "awaiting_finalize"
                } else if self.isCompletedMutationReceiptStateLocked(current) {
                    phase = "completed"
                } else {
                    phase = nil
                }
            } else {
                phase = nil
            }
            let counts = await self.readOnlyZeroCountsLocked(state: current)
            return [
                "available": current != nil,
                "active": phase != nil,
                "phase": NativeNotificationCoordinatorPlugin.nullable(phase),
                "reason": NativeNotificationCoordinatorPlugin.nullable(reason?.rawValue),
                "display_epoch": String(current?.displayEpoch ?? 0),
                "zero_counts": counts.dictionary,
            ]
        }
    }

    func initialize(contract: String, manifest: [String: Any]) async -> [String: Any] {
        await processor.submit {
            guard
                await self.preflightLocked(),
                !self.releaseConfigurationBlocked,
                let apiOrigin = Self.validatedAPIOrigin(manifest),
                Self.validateReleaseManifest(
                    contract: contract,
                    manifest: manifest,
                    runtimeFirebaseProjectID: self.runtimeFirebaseProjectID
                )
            else {
                self.releaseValidated = false
                self.validatedAPIOrigin = nil
                self.authorizationBearer = nil
                self.cancelAllNetworkAuthorizationsLocked()
                self.clearColdPayloadQuarantine()
                return self.operationResultLocked(success: false)
            }
            self.validatedAPIOrigin = apiOrigin
            self.releaseValidated = true
            self.emitQueuedEventsLocked()
            return self.operationResultLocked(success: self.state?.localPrivacyBarrierFailed == false && self.state?.corruptState == false)
        }
    }

    func bindSession(
        sessionID: String,
        authVersion: String,
        bindingGeneration: Int,
        tokenGeneration: Int,
        authorizationBearer: String
    ) async -> [String: Any] {
        await processor.submit {
            guard
                await self.preflightLocked(),
                self.releaseValidated,
                var next = self.state,
                NativeNotificationCoordinatorPlugin.canonicalPositiveSafeInteger(authVersion) == authVersion,
                bindingGeneration > 0,
                tokenGeneration > 0,
                !next.localPrivacyBarrierFailed,
                !next.corruptState,
                next.admission == .closed,
                next.mutationPhase == .unbound || next.mutationPhase == .readyForRebind || next.mutationPhase == .dormantRebind || next.mutationPhase == .terminal,
                next.displayEpoch < UInt64.max
            else {
                self.clearColdPayloadQuarantine()
                return self.operationResultLocked(success: false)
            }
            next.displayEpoch += 1
            next.admission = .open
            next.mutationPhase = .bound
            next.mutationReason = nil
            next.authVersion = authVersion
            next.sessionMarker = Self.sessionMarker(
                sessionID: sessionID,
                authVersion: authVersion,
                key: next.sessionMarkerKey
            )
            next.bindingGeneration = bindingGeneration
            next.tokenGeneration = tokenGeneration
            next.nextLaunchPurge = false
            do {
                try self.persistLocked(next)
                self.activeSessionID = sessionID
                self.authorizationBearer = authorizationBearer
                self.hasEmittedPendingFCMTokensForCurrentBinding = false
                guard self.releaseColdPayloadAfterVerifiedRebindLocked() else {
                    return self.operationResultLocked(success: false)
                }
                self.emitQueuedEventsLocked()
                return self.operationResultLocked(success: true, sessionID: sessionID)
            } catch {
                self.failClosedLocked()
                return self.operationResultLocked(success: false)
            }
        }
    }

    func updateSessionGenerations(sessionID: String, bindingGeneration: Int, tokenGeneration: Int) async -> [String: Any] {
        await processor.submit {
            guard
                await self.preflightLocked(),
                self.releaseValidated,
                var closing = self.state,
                bindingGeneration > 0,
                tokenGeneration > 0,
                self.isDisplayAdmittedLocked(),
                closing.displayEpoch < UInt64.max,
                let authVersion = closing.authVersion,
                NativeNotificationCoordinatorPlugin.canonicalPositiveSafeInteger(authVersion) == authVersion,
                closing.sessionMarker == Self.sessionMarker(
                    sessionID: sessionID,
                    authVersion: authVersion,
                    key: closing.sessionMarkerKey
                )
            else {
                return self.operationResultLocked(success: false)
            }
            closing.displayEpoch += 1
            closing.admission = .closing
            closing.mutationPhase = .dormantRebind
            closing.mutationReason = nil
            closing.sessionMarker = nil
            closing.bindingGeneration = bindingGeneration
            closing.tokenGeneration = tokenGeneration
            closing.nextLaunchPurge = true
            self.activeSessionID = nil
            do {
                try self.persistLocked(closing)
                guard await self.purgeAndCloseLocked(phase: .dormantRebind, reason: nil) else {
                    return self.operationResultLocked(success: false)
                }
                guard var rebound = self.state else { return self.operationResultLocked(success: false) }
                rebound.admission = .open
                rebound.mutationPhase = .bound
                rebound.mutationReason = nil
                rebound.authVersion = authVersion
                rebound.sessionMarker = Self.sessionMarker(
                    sessionID: sessionID,
                    authVersion: authVersion,
                    key: rebound.sessionMarkerKey
                )
                rebound.bindingGeneration = bindingGeneration
                rebound.tokenGeneration = tokenGeneration
                rebound.nextLaunchPurge = false
                self.activeSessionID = sessionID
                try self.persistLocked(rebound)
                self.pendingFCMTokens.removeAll()
                self.hasEmittedPendingFCMTokensForCurrentBinding = false
                return self.operationResultLocked(success: true, sessionID: sessionID)
            } catch {
                self.failClosedLocked()
                return self.operationResultLocked(success: false)
            }
        }
    }

    func receiveAPNSDataOnlyPayload(_ payload: DataOnlyPayload?) async -> NativeNotificationHandlingResult {
        await processor.submit {
            guard
                await self.preflightLocked(),
                let payload,
                self.isPersistedAdmissionOpenLocked(),
                var next = self.state
            else {
                self.retainColdPayloadOnlyWhileDormantRebindLocked()
                return NativeNotificationHandlingResult(disposition: "received")
            }
            self.clearColdPayloadQuarantine()
            guard
                next.registry[payload.deliveryID] == nil,
                next.handoffs[payload.deliveryID] == nil,
                next.pendingTaps[payload.deliveryID] == nil,
                !next.operations.values.contains(where: { $0.deliveryID == payload.deliveryID })
            else {
                return NativeNotificationHandlingResult(disposition: "received")
            }
            guard
                NativeNotificationCoordinatorProtocolLimits.acceptsInsertion(atCount: next.handoffs.count),
                next.registry.count < Self.maximumRegistryEntries
            else {
                return NativeNotificationHandlingResult(disposition: "received")
            }
            next.handoffs[payload.deliveryID] = DataOnlyHandoff(
                noticeID: payload.noticeID,
                displayEpoch: next.displayEpoch,
                expiresAtMillis: Self.nowMillis() + Self.handoffTTLMillis
            )
            do {
                try self.persistLocked(next)
                if self.releaseValidated { self.emitDataOnlyPayload(payload) }
                return NativeNotificationHandlingResult(disposition: "admitted")
            } catch {
                self.failClosedLocked()
                return NativeNotificationHandlingResult(disposition: "received")
            }
        }
    }

    func receiveFCMRegistrationToken(_ token: String) async {
        _ = await processor.submit {
            guard await self.preflightLocked(), token.utf8.count <= 4_096 else { return false }
            self.pendingFCMTokens = Array([token].suffix(Self.maximumPendingFCMTokens))
            self.hasEmittedPendingFCMTokensForCurrentBinding = false
            self.emitQueuedEventsLocked()
            return true
        }
    }

    func beginDisplayAuthorization(_ payload: DataOnlyPayload) async -> [String: Any] {
        await processor.submit {
            var result: [String: Any] = ["admitted": false]
            guard
                await self.preflightLocked(),
                self.releaseValidated,
                self.isDisplayAdmittedLocked(),
                var next = self.state,
                let handoff = next.handoffs[payload.deliveryID],
                handoff.noticeID == payload.noticeID,
                handoff.displayEpoch == next.displayEpoch
            else {
                return result
            }
            guard let currentHandoff = next.handoffs[payload.deliveryID], currentHandoff.expiresAtMillis > Self.nowMillis() else { return result }
            guard
                NativeNotificationCoordinatorProtocolLimits.acceptsInsertion(atCount: next.operations.count),
                next.registry.count < Self.maximumRegistryEntries
            else {
                return result
            }
            let operationID = UUID().uuidString.lowercased()
            let operation = AuthorizationOperation(
                kind: .display,
                deliveryID: payload.deliveryID,
                noticeID: payload.noticeID,
                displayEpoch: next.displayEpoch,
                sessionMarker: next.sessionMarker ?? "",
                bindingGeneration: next.bindingGeneration,
                tokenGeneration: next.tokenGeneration,
                expiresAtMillis: Self.nowMillis() + Self.authorizationTTLMillis
            )
            guard !operation.sessionMarker.isEmpty else { return result }
            next.handoffs.removeValue(forKey: payload.deliveryID)
            next.operations[operationID] = operation
            do {
                try self.persistLocked(next)
                result["admitted"] = true
                result.merge(self.operationIdentityLocked(operationID: operationID, operation: operation)) { _, new in new }
            } catch {
                self.failClosedLocked()
            }
            return result
        }
    }

    func scheduleAuthorizedNotification(operationID: String) async -> [String: Any] {
        guard let authorizationRequest = await processor.submit({
            await self.captureDisplayAuthorizationRequestLocked(operationID: operationID)
        }) else {
            return await processor.submit { self.operationResultLocked(success: false) }
        }

        let serverAuthorization = await Self.authorizeOperation(authorizationRequest)
        return await processor.submit {
            self.finishNetworkAuthorizationLocked(operationID)
            guard let serverAuthorization else {
                self.abortDisplayOperationLocked(operationID)
                return self.operationResultLocked(success: false)
            }
            return await self.scheduleAuthorizedNotificationLocked(
                operationID: operationID,
                operation: authorizationRequest.operation,
                serverAuthorization: serverAuthorization
            )
        }
    }

    private func captureDisplayAuthorizationRequestLocked(operationID: String) async -> AuthorizationNetworkRequest? {
        guard
            await preflightLocked(),
            releaseValidated,
            isDisplayAdmittedLocked(),
            let current = state,
            let operation = current.operations[operationID],
            operation.kind == .display,
            operationMatchesCurrentStateLocked(operation),
            operation.expiresAtMillis >= Self.nowMillis(),
            authorizationNetworkCancellations[operationID] == nil,
            NativeNotificationCoordinatorProtocolLimits.acceptsInsertion(atCount: authorizationNetworkCancellations.count),
            let authorizationRequest = authorizationNetworkRequestLocked(operation)
        else {
            abortDisplayOperationLocked(operationID)
            return nil
        }
        authorizationNetworkCancellations[operationID] = authorizationRequest.cancellation
        return authorizationRequest
    }

    private func scheduleAuthorizedNotificationLocked(
        operationID: String,
        operation: AuthorizationOperation,
        serverAuthorization: ServerAuthorization
    ) async -> [String: Any] {
        let receipt = serverAuthorization.receipt
        guard
            releaseValidated,
            isDisplayAdmittedLocked(),
            var scheduling = state,
            scheduling.operations[operationID] == operation,
            operationMatchesCurrentStateLocked(operation),
            receiptMatchesLocked(receipt, operation: operation),
            scheduling.usedAuthorizationReceipts[receipt.authorizationID] == nil,
            scheduling.usedAuthorizationReceipts.count < Self.maximumUsedReceipts,
            scheduling.registry[receipt.payload.deliveryID] == nil,
            scheduling.registry.count < Self.maximumRegistryEntries,
            operation.expiresAtMillis >= Self.nowMillis(),
            receipt.expiresAtMillis >= Self.nowMillis(),
            receipt.expiresAtMillis <= operation.expiresAtMillis
        else {
            abortDisplayOperationLocked(operationID)
            return operationResultLocked(success: false)
        }

        let requestIdentifier = Self.requestIdentifier(for: receipt.payload.deliveryID)
        scheduling.operations.removeValue(forKey: operationID)
        scheduling.usedAuthorizationReceipts[receipt.authorizationID] = UsedAuthorizationReceipt(
            deliveryID: receipt.payload.deliveryID,
            noticeID: receipt.payload.noticeID,
            displayEpoch: receipt.displayEpoch,
            bindingGeneration: receipt.bindingGeneration,
            tokenGeneration: receipt.tokenGeneration,
            expiresAtMillis: receipt.expiresAtMillis
        )
        scheduling.registry[receipt.payload.deliveryID] = NotificationRegistryEntry(
            requestIdentifier: requestIdentifier,
            noticeID: receipt.payload.noticeID,
            displayEpoch: operation.displayEpoch,
            phase: .scheduling,
            createdAtMillis: Self.nowMillis()
        )
        do {
            try persistLocked(scheduling)
        } catch {
            failClosedLocked()
            return operationResultLocked(success: false)
        }

        guard
            await Self.currentDisplayPermissionAllowsScheduling(),
            isDisplayAdmittedLocked(),
            operationMatchesCurrentStateLocked(operation),
            operation.expiresAtMillis >= Self.nowMillis(),
            receipt.expiresAtMillis >= Self.nowMillis()
        else {
            dropReservationLocked(receipt.payload.deliveryID, requestIdentifier: requestIdentifier)
            return operationResultLocked(success: false)
        }

        let added = await Self.addLocalNotification(
            identifier: requestIdentifier,
            title: serverAuthorization.title,
            payload: receipt.payload,
            displayEpoch: operation.displayEpoch
        )
        guard added else {
            await compensateAmbiguousRequestLocked(requestIdentifier)
            dropReservationLocked(receipt.payload.deliveryID, requestIdentifier: requestIdentifier)
            return operationResultLocked(success: false)
        }

        guard
            isDisplayAdmittedLocked(),
            var scheduled = state,
            operationMatchesCurrentStateLocked(operation),
            let entry = scheduled.registry[receipt.payload.deliveryID],
            entry.requestIdentifier == requestIdentifier,
            entry.phase == .scheduling
        else {
            await compensateAmbiguousRequestLocked(requestIdentifier)
            markPurgeFailureLocked()
            return operationResultLocked(success: false)
        }
        scheduled.registry[receipt.payload.deliveryID]?.phase = .scheduled
        do {
            try persistLocked(scheduled)
            return operationResultLocked(success: true)
        } catch {
            await compensateAmbiguousRequestLocked(requestIdentifier)
            markPurgeFailureLocked()
            return operationResultLocked(success: false)
        }
    }

    func abortAuthorization(operationID: String, reason: AuthorizationAbortReason, kind: AuthorizationOperationKind) async -> [String: Any] {
        await processor.submit {
            self.cancelNetworkAuthorizationLocked(operationID)
            guard await self.preflightLocked(), var next = self.state, let operation = next.operations[operationID], operation.kind == kind else {
                return self.operationResultLocked(success: false)
            }
            next.operations.removeValue(forKey: operationID)
            if kind == .display {
                do {
                    try self.persistLocked(next)
                    return self.operationResultLocked(success: true)
                } catch {
                    self.failClosedLocked()
                    return self.operationResultLocked(success: false)
                }
            }

            guard let entry = next.registry[operation.deliveryID] else {
                next.pendingTaps.removeValue(forKey: operation.deliveryID)
                do {
                    try self.persistLocked(next)
                    return self.operationResultLocked(success: true)
                } catch {
                    self.failClosedLocked()
                    return self.operationResultLocked(success: false)
                }
            }
            next.pendingTaps.removeValue(forKey: operation.deliveryID)
            do { try self.persistLocked(next) } catch {
                self.failClosedLocked()
                return self.operationResultLocked(success: false)
            }
            guard await Self.removeRequestsAndVerify([entry.requestIdentifier]) else {
                self.markPurgeFailureLocked()
                return self.operationResultLocked(success: false)
            }
            guard var removed = self.state else { return self.operationResultLocked(success: false) }
            removed.registry.removeValue(forKey: operation.deliveryID)
            removed.foregroundPresentationIDs.remove(operation.deliveryID)
            do {
                try self.persistLocked(removed)
                _ = reason
                return self.operationResultLocked(success: true)
            } catch {
                self.markPurgeFailureLocked()
                return self.operationResultLocked(success: false)
            }
        }
    }

    func completeForegroundPresentation(
        requestIdentifier: String,
        payload: DataOnlyPayload?,
        completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) async {
        await processor.submit {
            let permitted = await self.shouldPresentLocalNotificationLocked(
                requestIdentifier: requestIdentifier,
                payload: payload
            )
            completionHandler(permitted ? [.banner, .list] : [])
        }
    }

    private func shouldPresentLocalNotificationLocked(
        requestIdentifier: String,
        payload: DataOnlyPayload?
    ) async -> Bool {
        guard
            await self.preflightLocked(),
            self.releaseValidated,
            self.isDisplayAdmittedLocked(),
            let payload,
            var next = self.state,
            let entry = next.registry[payload.deliveryID],
            entry.requestIdentifier == requestIdentifier,
            entry.noticeID == payload.noticeID,
            entry.displayEpoch == next.displayEpoch,
            entry.phase == .scheduled
        else {
            return false
        }
        next.registry[payload.deliveryID]?.phase = .displayed
        next.foregroundPresentationIDs.insert(payload.deliveryID)
        do {
            try self.persistLocked(next)
            return true
        } catch {
            self.failClosedLocked()
            return false
        }
    }

    func captureNotificationTap(requestIdentifier: String, payload: DataOnlyPayload?) async {
        _ = await processor.submit {
            guard await self.preflightLocked() else {
                self.retainColdPayloadOnlyWhileDormantRebindLocked()
                return false
            }
            guard
                self.releaseValidated,
                self.isDisplayAdmittedLocked(),
                let payload,
                var next = self.state,
                let entry = next.registry[payload.deliveryID],
                entry.requestIdentifier == requestIdentifier,
                entry.noticeID == payload.noticeID,
                entry.displayEpoch == next.displayEpoch,
                entry.phase == .scheduled || entry.phase == .displayed
            else {
                let retained = self.retainColdPayloadOnlyWhileDormantRebindLocked()
                if let payload, !retained {
                    await self.removeDeniedTapLocked(deliveryID: payload.deliveryID)
                }
                return false
            }
            self.clearColdPayloadQuarantine()
            if let pendingTap = next.pendingTaps[payload.deliveryID] {
                guard
                    pendingTap.noticeID == payload.noticeID,
                    pendingTap.displayEpoch == next.displayEpoch,
                    pendingTap.requestIdentifier == requestIdentifier
                else {
                    await self.removeDeniedTapLocked(deliveryID: payload.deliveryID)
                    return false
                }
                return true
            }
            if let tapOperation = next.operations.values.first(where: {
                $0.kind == .tap && $0.deliveryID == payload.deliveryID
            }) {
                guard
                    tapOperation.noticeID == payload.noticeID,
                    tapOperation.displayEpoch == next.displayEpoch
                else {
                    await self.removeDeniedTapLocked(deliveryID: payload.deliveryID)
                    return false
                }
                return true
            }
            guard NativeNotificationCoordinatorProtocolLimits.acceptsInsertion(atCount: next.pendingTaps.count) else {
                await self.removeDeniedTapLocked(deliveryID: payload.deliveryID)
                return false
            }
            next.pendingTaps[payload.deliveryID] = PendingTap(
                noticeID: payload.noticeID,
                displayEpoch: next.displayEpoch,
                requestIdentifier: requestIdentifier,
                expiresAtMillis: Self.nowMillis() + Self.tapTTLMillis
            )
            do {
                try self.persistLocked(next)
                self.emitTap(payload, displayEpoch: next.displayEpoch)
                return true
            } catch {
                self.failClosedLocked()
                return false
            }
        }
    }

    func beginTapAuthorization(_ payload: DataOnlyPayload, displayEpoch: String) async -> [String: Any] {
        await processor.submit {
            var result: [String: Any] = ["admitted": false]
            guard
                await self.preflightLocked(),
                self.releaseValidated,
                self.isDisplayAdmittedLocked(),
                let parsedEpoch = UInt64(displayEpoch),
                var next = self.state,
                let pendingTap = next.pendingTaps[payload.deliveryID],
                let entry = next.registry[payload.deliveryID],
                pendingTap.noticeID == payload.noticeID,
                pendingTap.displayEpoch == parsedEpoch,
                pendingTap.requestIdentifier == entry.requestIdentifier,
                entry.noticeID == payload.noticeID,
                entry.displayEpoch == parsedEpoch,
                parsedEpoch == next.displayEpoch,
                pendingTap.expiresAtMillis >= Self.nowMillis()
            else {
                await self.removeDeniedTapLocked(deliveryID: payload.deliveryID)
                return result
            }
            guard NativeNotificationCoordinatorProtocolLimits.acceptsInsertion(atCount: next.operations.count) else {
                await self.removeDeniedTapLocked(deliveryID: payload.deliveryID)
                return result
            }
            let operationID = UUID().uuidString.lowercased()
            let operation = AuthorizationOperation(
                kind: .tap,
                deliveryID: payload.deliveryID,
                noticeID: payload.noticeID,
                displayEpoch: parsedEpoch,
                sessionMarker: next.sessionMarker ?? "",
                bindingGeneration: next.bindingGeneration,
                tokenGeneration: next.tokenGeneration,
                expiresAtMillis: Self.nowMillis() + Self.authorizationTTLMillis
            )
            guard !operation.sessionMarker.isEmpty else { return result }
            next.pendingTaps.removeValue(forKey: payload.deliveryID)
            next.operations[operationID] = operation
            do {
                try self.persistLocked(next)
                result["admitted"] = true
                result.merge(self.operationIdentityLocked(operationID: operationID, operation: operation)) { _, new in new }
            } catch {
                self.failClosedLocked()
            }
            return result
        }
    }

    func completeTapAuthorization(operationID: String) async -> [String: Any] {
        guard let authorizationRequest = await processor.submit({
            await self.captureTapAuthorizationRequestLocked(operationID: operationID)
        }) else {
            return await processor.submit { self.operationResultLocked(success: false) }
        }

        let serverAuthorization = await Self.authorizeOperation(authorizationRequest)
        return await processor.submit {
            self.finishNetworkAuthorizationLocked(operationID)
            guard let serverAuthorization else {
                await self.denyTapOperationLocked(operationID)
                return self.operationResultLocked(success: false)
            }
            return await self.completeTapAuthorizationLocked(
                operationID: operationID,
                operation: authorizationRequest.operation,
                serverAuthorization: serverAuthorization
            )
        }
    }

    private func captureTapAuthorizationRequestLocked(operationID: String) async -> AuthorizationNetworkRequest? {
        guard
            await preflightLocked(),
            releaseValidated,
            isDisplayAdmittedLocked(),
            let current = state,
            let operation = current.operations[operationID],
            operation.kind == .tap,
            operationMatchesCurrentStateLocked(operation),
            operation.expiresAtMillis >= Self.nowMillis(),
            authorizationNetworkCancellations[operationID] == nil,
            NativeNotificationCoordinatorProtocolLimits.acceptsInsertion(atCount: authorizationNetworkCancellations.count),
            let authorizationRequest = authorizationNetworkRequestLocked(operation)
        else {
            await denyTapOperationLocked(operationID)
            return nil
        }
        authorizationNetworkCancellations[operationID] = authorizationRequest.cancellation
        return authorizationRequest
    }

    private func completeTapAuthorizationLocked(
        operationID: String,
        operation: AuthorizationOperation,
        serverAuthorization: ServerAuthorization
    ) async -> [String: Any] {
        let receipt = serverAuthorization.receipt
        guard
            var next = state,
            releaseValidated,
            isDisplayAdmittedLocked(),
            next.operations[operationID] == operation,
            operationMatchesCurrentStateLocked(operation),
            receiptMatchesLocked(receipt, operation: operation),
            next.usedAuthorizationReceipts[receipt.authorizationID] == nil,
            next.usedAuthorizationReceipts.count < Self.maximumUsedReceipts,
            let entry = next.registry[receipt.payload.deliveryID],
            entry.noticeID == receipt.payload.noticeID,
            entry.displayEpoch == operation.displayEpoch,
            operation.expiresAtMillis >= Self.nowMillis(),
            receipt.expiresAtMillis >= Self.nowMillis(),
            receipt.expiresAtMillis <= operation.expiresAtMillis
        else {
            await denyTapOperationLocked(operationID)
            return operationResultLocked(success: false)
        }

        next.operations.removeValue(forKey: operationID)
        next.usedAuthorizationReceipts[receipt.authorizationID] = UsedAuthorizationReceipt(
            deliveryID: receipt.payload.deliveryID,
            noticeID: receipt.payload.noticeID,
            displayEpoch: receipt.displayEpoch,
            bindingGeneration: receipt.bindingGeneration,
            tokenGeneration: receipt.tokenGeneration,
            expiresAtMillis: receipt.expiresAtMillis
        )
        do {
            try persistLocked(next)
        } catch {
            failClosedLocked()
            return operationResultLocked(success: false)
        }

        guard await Self.removeRequestsAndVerify([entry.requestIdentifier]) else {
            markPurgeFailureLocked()
            return operationResultLocked(success: false)
        }
        guard var completed = state else { return operationResultLocked(success: false) }
        completed.registry.removeValue(forKey: receipt.payload.deliveryID)
        completed.foregroundPresentationIDs.remove(receipt.payload.deliveryID)
        do {
            try persistLocked(completed)
            return operationResultLocked(success: true)
        } catch {
            markPurgeFailureLocked()
            return operationResultLocked(success: false)
        }
    }

    func beginAccountMutation(_ reason: AccountMutationReason) async -> [String: Any] {
        await processor.submit {
            self.authorizationBearer = nil
            self.cancelAllNetworkAuthorizationsLocked()
            self.pendingFCMTokens.removeAll()
            self.hasEmittedPendingFCMTokensForCurrentBinding = false
            self.clearColdPayloadQuarantine()
            _ = await self.preflightLocked()
            guard var closing = self.state else { return await self.mutationResultLocked(success: false) }
            if self.isCompletedMutationReceiptStateLocked(closing) || closing.mutationPhase == .awaitingFinalize {
                guard closing.mutationReason == reason else {
                    return await self.mutationResultLocked(success: false)
                }
                let healthy = await self.hasHealthyClosedMutationReceiptInvariantLocked(closing)
                return await self.mutationResultLocked(success: healthy)
            }
            guard
                !closing.localPrivacyBarrierFailed,
                !closing.corruptState,
                closing.displayEpoch < UInt64.max,
                (
                    (closing.mutationPhase == .bound && closing.admission == .open)
                        || self.isCleanClosedNonterminalStateLocked(closing)
                )
            else {
                return await self.mutationResultLocked(success: false)
            }
            closing.displayEpoch += 1
            closing.admission = .closing
            closing.mutationPhase = .awaitingFinalize
            closing.mutationReason = reason
            closing.sessionMarker = nil
            closing.authVersion = nil
            closing.nextLaunchPurge = true
            self.activeSessionID = nil
            do {
                try self.persistLocked(closing)
                let purged = await self.purgeAndCloseLocked(phase: .awaitingFinalize, reason: reason)
                return await self.mutationResultLocked(success: purged)
            } catch {
                self.failClosedLocked()
                return await self.mutationResultLocked(success: false)
            }
        }
    }

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

    func operationResult(success: Bool) async -> [String: Any] {
        await processor.submit { self.operationResultLocked(success: success) }
    }
    func secureCredentialStorageAvailability() async -> [String: Any] {
        await processor.submit {
            // Availability proves only that the non-secret recovery marker can
            // be reached. Per-key phase checks still protect credentials.
            ["available": NativeNotificationCoordinatorPlugin.credentialStore.isAvailable()]
        }
    }

    func getSecureCredential(key: String) async -> [String: Any] {
        await processor.submit {
            if KeychainCredentialStore.isRecoveryKey(key) {
                do {
                    return ["value": NativeNotificationCoordinatorPlugin.nullable(try NativeNotificationCoordinatorPlugin.credentialStore.read(key: key))]
                } catch {
                    return ["error": "Secure credential read failed."]
                }
            }
            guard await self.preflightLocked() else {
                return ["error": "Secure credential preflight failed."]
            }
            if self.hasVerifiedCredentialAbsenceLocked(key: key) {
                return ["value": NSNull()]
            }
            guard self.credentialOperationPermittedLocked(key: key, operation: .read) else {
                return ["error": "Secure credentials are unavailable in the current coordinator phase."]
            }
            do {
                return ["value": NativeNotificationCoordinatorPlugin.nullable(try NativeNotificationCoordinatorPlugin.credentialStore.read(key: key))]
            } catch {
                return ["error": "Secure credential read failed."]
            }
        }
    }

    func setSecureCredential(_ value: String, key: String) async -> [String: Any] {
        await processor.submit {
            if KeychainCredentialStore.isRecoveryKey(key) {
                do {
                    try NativeNotificationCoordinatorPlugin.credentialStore.write(value, key: key)
                    return ["success": true]
                } catch {
                    return ["success": false]
                }
            }
            guard await self.preflightLocked(), self.credentialOperationPermittedLocked(key: key, operation: .write) else {
                return ["success": false]
            }
            do {
                try NativeNotificationCoordinatorPlugin.credentialStore.write(value, key: key)
                return ["success": true]
            } catch {
                return ["success": false]
            }
        }
    }

    func deleteSecureCredential(key: String) async -> [String: Any] {
        await processor.submit {
            if KeychainCredentialStore.isRecoveryKey(key) {
                do {
                    try NativeNotificationCoordinatorPlugin.credentialStore.remove(key: key)
                    return ["success": true]
                } catch {
                    return ["success": false]
                }
            }
            guard await self.preflightLocked(), self.credentialOperationPermittedLocked(key: key, operation: .delete) else {
                return ["success": false]
            }
            do {
                try NativeNotificationCoordinatorPlugin.credentialStore.remove(key: key)
                return ["success": true]
            } catch {
                return ["success": false]
            }
        }
    }

    private func preflightLocked() async -> Bool {
        let now = Self.nowMillis()
        pruneColdPayloadQuarantine(now: now)
        if bootstrapped {
            await pruneExpiredLocked(now: now)
            if state?.corruptState == true {
                return false
            }
            if state?.localPrivacyBarrierFailed == true {
                return await recoverLocalPrivacyBarrierLocked() && !releaseConfigurationBlocked
            }
            return state?.localPrivacyBarrierFailed == false && !releaseConfigurationBlocked
        }
        do {
            let serialized = try stateStore.read()
            if let serialized {
                guard let decoded = try? JSONDecoder().decode(NotificationDurableState.self, from: serialized), decoded.isValid else {
                    self.clearColdPayloadQuarantine()
                    let recovered = try NotificationDurableState.corruptRecovery()
                    try persistLocked(recovered)
                    _ = await purgeAndCloseLocked(phase: .corruptFailure, reason: nil)
                    bootstrapped = true
                    return false
                }
                state = decoded
            } else {
                guard try NativeNotificationCoordinatorPlugin.credentialStore.allAllowedCredentialsAreAbsent() else {
                    self.clearColdPayloadQuarantine()
                    let recovered = try NotificationDurableState.corruptRecovery()
                    try persistLocked(recovered)
                    _ = await purgeAndCloseLocked(phase: .corruptFailure, reason: nil)
                    bootstrapped = true
                    return false
                }
                var initial = try NotificationDurableState.initial()
                initial.admission = .closing
                initial.nextLaunchPurge = true
                try persistLocked(initial)
                guard await purgeAndCloseLocked(phase: .unbound, reason: nil) else {
                    bootstrapped = true
                    return false
                }
            }
            guard var current = state else { return false }
            await pruneExpiredLocked(now: Self.nowMillis())
            current = state ?? current
            let ownerlessCredentialPhase = current.mutationReason == nil
                && (current.mutationPhase == .unbound || current.mutationPhase == .readyForRebind)
            let hasOwnerlessSessionCredentials = try ownerlessCredentialPhase
                && NativeNotificationCoordinatorPlugin.credentialStore.hasRefreshOrSessionCredentials()
            let preservesCredentialRebindProvenance = current.mutationReason == nil
                && (
                    current.mutationPhase == .bound
                        || current.mutationPhase == .dormantRebind
                        || (ownerlessCredentialPhase && (current.authVersion != nil || hasOwnerlessSessionCredentials))
                )
            let needsDormantRebindCanonicalization = preservesCredentialRebindProvenance
                && current.mutationPhase != .dormantRebind
            let dirty = current.nextLaunchPurge
                || current.admission != .closed
                || current.sessionMarker != nil
                || (current.authVersion != nil && current.mutationPhase != .dormantRebind)
                || !current.registry.isEmpty
                || !current.handoffs.isEmpty
                || !current.pendingTaps.isEmpty
                || !current.operations.isEmpty
                || !current.usedAuthorizationReceipts.isEmpty
                || !current.foregroundPresentationIDs.isEmpty
                || needsDormantRebindCanonicalization
            if current.corruptState {
                self.clearColdPayloadQuarantine()
                _ = await purgeAndCloseLocked(phase: .corruptFailure, reason: nil)
                bootstrapped = true
                return false
            }
            if ownedMutationReasonLocked(current) != nil {
                clearColdPayloadQuarantine()
                activeSessionID = nil
                authorizationBearer = nil
                cancelAllNetworkAuthorizationsLocked()
                pendingFCMTokens.removeAll()
                hasEmittedPendingFCMTokensForCurrentBinding = false
                let recovered = await resumeOwnedMutationReceiptLocked()
                bootstrapped = true
                return recovered && !releaseConfigurationBlocked
            }
            if current.localPrivacyBarrierFailed {
                let recovered = await recoverLocalPrivacyBarrierLocked()
                bootstrapped = true
                return recovered && !releaseConfigurationBlocked
            }
            if dirty {
                guard current.displayEpoch < UInt64.max else {
                    failClosedLocked()
                    bootstrapped = true
                    return false
                }
                current.displayEpoch += 1
                current.admission = .closing
                current.sessionMarker = nil
                if preservesCredentialRebindProvenance {
                    // A restarted process has no live bearer or active session.
                    // Keep refresh/session provenance until JavaScript validates it
                    // against the server and calls bindSession.
                    current.mutationPhase = .dormantRebind
                    current.mutationReason = nil
                } else {
                    current.authVersion = nil
                }
                current.nextLaunchPurge = true
                activeSessionID = nil
                authorizationBearer = nil
                try persistLocked(current)
                guard await purgeAndCloseLocked(phase: current.mutationPhase, reason: current.mutationReason) else {
                    bootstrapped = true
                    return false
                }
            }
            bootstrapped = true
            return !releaseConfigurationBlocked
        } catch KeychainStateError.journalRecoveryFailed {
            self.clearColdPayloadQuarantine()
            _ = await Self.purgeAllAppNotifications()
            failClosedLocked()
            bootstrapped = true
            return false
        } catch {
            self.clearColdPayloadQuarantine()
            do {
                let recovered = try NotificationDurableState.corruptRecovery()
                try persistLocked(recovered)
                _ = await purgeAndCloseLocked(phase: .corruptFailure, reason: nil)
            } catch {
                _ = await Self.purgeAllAppNotifications()
            }
            failClosedLocked()
            bootstrapped = true
            return false
        }
    }

    private func recoverLocalPrivacyBarrierLocked() async -> Bool {
        guard
            let failed = state,
            failed.localPrivacyBarrierFailed,
            !failed.corruptState
        else {
            return false
        }
        clearColdPayloadQuarantine()
        if ownedMutationReasonLocked(failed) != nil {
            return await resumeOwnedMutationReceiptLocked()
        }
        let ownerlessCredentialPhase = failed.mutationReason == nil
            && (failed.mutationPhase == .unbound || failed.mutationPhase == .readyForRebind)
        let hasOwnerlessSessionCredentials: Bool
        do {
            hasOwnerlessSessionCredentials = try ownerlessCredentialPhase
                && NativeNotificationCoordinatorPlugin.credentialStore.hasRefreshOrSessionCredentials()
        } catch {
            return false
        }
        let preservesCredentialRebindProvenance = failed.mutationReason == nil
            && (
                failed.mutationPhase == .bound
                    || failed.mutationPhase == .dormantRebind
                    || (ownerlessCredentialPhase && (failed.authVersion != nil || hasOwnerlessSessionCredentials))
            )
        let phase: MutationPhase
        let reason: AccountMutationReason?
        if preservesCredentialRebindProvenance {
            phase = .dormantRebind
            reason = nil
        } else {
            phase = failed.mutationPhase
            reason = failed.mutationReason
        }
        let displayEpoch = failed.displayEpoch
        guard
            await purgeAndCloseLocked(phase: phase, reason: reason),
            let recovered = state,
            recovered.displayEpoch == displayEpoch,
            recovered.mutationPhase == phase,
            recovered.mutationReason == reason,
            recovered.admission == .closed,
            !recovered.nextLaunchPurge,
            !recovered.localPrivacyBarrierFailed,
            !recovered.corruptState
        else {
            return false
        }
        return (await zeroCountsLocked()).isZero
    }

    private func purgeAndCloseLocked(phase: MutationPhase, reason: AccountMutationReason?) async -> Bool {
        guard var closing = state else { return false }
        cancelAllNetworkAuthorizationsLocked()
        closing.admission = .closing
        closing.mutationPhase = phase
        closing.mutationReason = reason
        closing.sessionMarker = nil
        closing.nextLaunchPurge = true
        do { try persistLocked(closing) } catch {
            failClosedLocked()
            return false
        }
        let deterministicRequestIdentifiers = Array(Set(closing.registry.values.map(\.requestIdentifier)))
        guard await Self.removeRequestsAndVerify(deterministicRequestIdentifiers) else {
            markPurgeFailureLocked()
            return false
        }
        guard await Self.purgeAllAppNotifications() else {
            markPurgeFailureLocked()
            return false
        }
        guard var cleared = state else {
            failClosedLocked()
            return false
        }
        cleared.admission = .closing
        cleared.mutationPhase = phase
        cleared.mutationReason = reason
        cleared.sessionMarker = nil
        cleared.nextLaunchPurge = true
        cleared.registry.removeAll()
        cleared.handoffs.removeAll()
        cleared.pendingTaps.removeAll()
        cleared.operations.removeAll()
        cleared.usedAuthorizationReceipts.removeAll()
        cleared.foregroundPresentationIDs.removeAll()
        do {
            try persistLocked(cleared)
            guard (await zeroCountsLocked()).isZero else {
                markPurgeFailureLocked()
                return false
            }
            var closed = cleared
            closed.admission = .closed
            closed.mutationPhase = phase
            closed.mutationReason = reason
            closed.sessionMarker = nil
            closed.nextLaunchPurge = false
            try persistLocked(closed)
            guard (await zeroCountsLocked()).isZero else {
                markPurgeFailureLocked()
                return false
            }
            if closed.localPrivacyBarrierFailed && !closed.corruptState {
                closed.localPrivacyBarrierFailed = false
                try persistLocked(closed)
            }
            return true
        } catch {
            markPurgeFailureLocked()
            return false
        }
    }

    private func readOnlyDurableStateLocked() -> NotificationDurableState? {
        do {
            guard
                let serialized = try stateStore.readOnly(),
                let decoded = try? JSONDecoder().decode(NotificationDurableState.self, from: serialized),
                decoded.isValid,
                !decoded.corruptState
            else {
                return nil
            }
            return decoded
        } catch {
            return nil
        }
    }
    private func readOnlyZeroCountsLocked(state candidate: NotificationDurableState?) async -> ZeroCounts {
        guard
            let candidate,
            let platform = await Self.allAppNotificationCounts()
        else {
            return ZeroCounts(
                pending: Self.unknownZeroCount,
                delivered: Self.unknownZeroCount,
                foreground: Self.unknownZeroCount,
                registry: Self.unknownZeroCount,
                inflight: Self.unknownZeroCount
            )
        }
        return ZeroCounts(
            pending: platform.pending,
            delivered: platform.delivered,
            foreground: candidate.foregroundPresentationIDs.count,
            registry: candidate.registry.count,
            inflight: candidate.operations.count + candidate.handoffs.count + candidate.pendingTaps.count
        )
    }
    private func zeroCountsLocked() async -> ZeroCounts {
        guard let platform = await Self.allAppNotificationCounts() else {
            markPurgeFailureLocked()
            return ZeroCounts(
                pending: Int.max,
                delivered: Int.max,
                foreground: Int.max,
                registry: Int.max,
                inflight: Int.max
            )
        }
        guard let state else {
            return ZeroCounts(pending: platform.pending, delivered: platform.delivered, foreground: Int.max, registry: Int.max, inflight: Int.max)
        }
        return ZeroCounts(
            pending: platform.pending,
            delivered: platform.delivered,
            foreground: state.foregroundPresentationIDs.count,
            registry: state.registry.count,
            inflight: state.operations.count + state.handoffs.count + state.pendingTaps.count
        )
    }

    private func mutationResultLocked(success: Bool) async -> [String: Any] {
        let counts = await zeroCountsLocked()
        return [
            "success": success && counts.isZero,
            "display_epoch": String(state?.displayEpoch ?? 0),
            "zero_counts": counts.dictionary,
        ]
    }
    private func readOnlyMutationResultLocked(
        success: Bool,
        state candidate: NotificationDurableState?
    ) async -> [String: Any] {
        let counts = await readOnlyZeroCountsLocked(state: candidate)
        return [
            "success": success && counts.isZero,
            "display_epoch": String(candidate?.displayEpoch ?? 0),
            "zero_counts": counts.dictionary,
        ]
    }

    private func operationResultLocked(success: Bool, sessionID: String? = nil) -> [String: Any] {
        let current = state
        let hasBoundGenerations = (current?.bindingGeneration ?? 0) > 0
        let installationID = NativeNotificationCoordinatorPlugin.nullable(current?.installationID)
        let session = NativeNotificationCoordinatorPlugin.nullable(sessionID ?? activeSessionID)
        let bindingGeneration: Any = hasBoundGenerations ? current!.bindingGeneration : NSNull()
        let tokenGeneration: Any = hasBoundGenerations ? current!.tokenGeneration : NSNull()
        return [
            "success": success,
            "installation_id": installationID,
            "session_id": session,
            "binding_generation": bindingGeneration,
            "token_generation": tokenGeneration,
            "display_epoch": String(current?.displayEpoch ?? 0),
        ]
    }

    private func operationIdentityLocked(operationID: String, operation: AuthorizationOperation) -> [String: Any] {
        [
            "operation_id": operationID,
            "installation_id": NativeNotificationCoordinatorPlugin.nullable(state?.installationID),
            "session_id": NativeNotificationCoordinatorPlugin.nullable(activeSessionID),
            "binding_generation": operation.bindingGeneration,
            "token_generation": operation.tokenGeneration,
            "client_display_epoch": String(operation.displayEpoch),
        ]
    }
    private func isCompletedMutationReceiptStateLocked(_ candidate: NotificationDurableState) -> Bool {
        (candidate.mutationPhase == .unbound && candidate.mutationReason == .logout)
            || (candidate.mutationPhase == .readyForRebind && candidate.mutationReason == .accountSwitch)
            || (candidate.mutationPhase == .terminal && candidate.mutationReason == .deletion)
    }
    private func ownsFinalizableMutationReceiptLocked(
        _ candidate: NotificationDurableState,
        reason: AccountMutationReason,
        displayEpoch: String
    ) -> Bool {
        !candidate.corruptState
            && (candidate.admission == .closed || candidate.admission == .closing)
            && candidate.mutationReason == reason
            && String(candidate.displayEpoch) == displayEpoch
            && (
                candidate.mutationPhase == .awaitingFinalize
                    || isCompletedMutationReceiptStateLocked(candidate)
            )
    }
    private func ownedMutationReasonLocked(_ candidate: NotificationDurableState) -> AccountMutationReason? {
        guard !candidate.corruptState else { return nil }
        if candidate.mutationPhase == .awaitingFinalize {
            return candidate.mutationReason
        }
        return isCompletedMutationReceiptStateLocked(candidate) ? candidate.mutationReason : nil
    }

    private func completedMutationPhase(for reason: AccountMutationReason) -> MutationPhase {
        switch reason {
        case .logout:
            return .unbound
        case .accountSwitch:
            return .readyForRebind
        case .deletion:
            return .terminal
        }
    }

    private func hasClosedFiveZeroStateStructureLocked(_ candidate: NotificationDurableState) -> Bool {
        candidate.admission == .closed
            && !candidate.nextLaunchPurge
            && !candidate.localPrivacyBarrierFailed
            && !candidate.corruptState
            && candidate.sessionMarker == nil
            && candidate.authVersion == nil
            && candidate.registry.isEmpty
            && candidate.handoffs.isEmpty
            && candidate.pendingTaps.isEmpty
            && candidate.operations.isEmpty
            && candidate.usedAuthorizationReceipts.isEmpty
            && candidate.foregroundPresentationIDs.isEmpty
    }

    private func isHealthyCompletedMutationReceiptStateLocked(_ candidate: NotificationDurableState) -> Bool {
        isCompletedMutationReceiptStateLocked(candidate) && hasClosedFiveZeroStateStructureLocked(candidate)
    }

    private func prepareCompletedMutationReceiptLocked(
        reason: AccountMutationReason,
        displayEpoch: String
    ) -> Bool {
        guard
            var next = state,
            String(next.displayEpoch) == displayEpoch,
            next.mutationReason == reason,
            next.mutationPhase == .awaitingFinalize
                || (
                    isCompletedMutationReceiptStateLocked(next)
                        && next.mutationPhase == completedMutationPhase(for: reason)
                )
        else {
            return false
        }
        next.admission = .closing
        next.mutationPhase = completedMutationPhase(for: reason)
        next.mutationReason = reason
        next.sessionMarker = nil
        next.authVersion = nil
        next.nextLaunchPurge = true
        do {
            try persistLocked(next)
            return true
        } catch {
            markPurgeFailureLocked()
            return false
        }
    }

    private func wipeNativeAuthSecretsForCompletedReceiptLocked() -> Bool {
        do {
            for key in [
                "zerotime.native-auth.refresh.v1",
                "zerotime.native-auth.session.v1",
                "zerotime.native-auth.transient.v1",
            ] {
                try NativeNotificationCoordinatorPlugin.credentialStore.remove(key: key)
            }
            return true
        } catch {
            markPurgeFailureLocked()
            return false
        }
    }

    private func completeOwnedMutationReceiptLocked(
        reason: AccountMutationReason,
        displayEpoch: String
    ) async -> Bool {
        guard
            let current = state,
            current.admission == .closed,
            !current.localPrivacyBarrierFailed,
            !current.corruptState,
            current.mutationReason == reason,
            String(current.displayEpoch) == displayEpoch,
            current.mutationPhase == .awaitingFinalize || isCompletedMutationReceiptStateLocked(current)
        else {
            return false
        }
        guard prepareCompletedMutationReceiptLocked(reason: reason, displayEpoch: displayEpoch) else {
            return false
        }
        guard wipeNativeAuthSecretsForCompletedReceiptLocked() else {
            return false
        }
        guard await purgeAndCloseLocked(phase: completedMutationPhase(for: reason), reason: reason) else {
            return false
        }
        guard
            let completed = state,
            completed.displayEpoch == current.displayEpoch,
            completed.mutationPhase == completedMutationPhase(for: reason),
            completed.mutationReason == reason,
            isHealthyCompletedMutationReceiptStateLocked(completed)
        else {
            return false
        }
        return (await zeroCountsLocked()).isZero
    }

    private func resumeOwnedMutationReceiptLocked() async -> Bool {
        guard
            let current = state,
            let reason = ownedMutationReasonLocked(current)
        else {
            return false
        }
        let displayEpoch = current.displayEpoch
        let phase: MutationPhase
        if current.mutationPhase == .awaitingFinalize {
            phase = .awaitingFinalize
        } else if isCompletedMutationReceiptStateLocked(current) {
            let canonicalEpoch = String(displayEpoch)
            guard prepareCompletedMutationReceiptLocked(reason: reason, displayEpoch: canonicalEpoch) else {
                return false
            }
            guard wipeNativeAuthSecretsForCompletedReceiptLocked() else {
                return false
            }
            phase = completedMutationPhase(for: reason)
        } else {
            return false
        }
        guard await purgeAndCloseLocked(phase: phase, reason: reason) else {
            return false
        }
        guard
            let recovered = state,
            recovered.displayEpoch == displayEpoch,
            recovered.mutationPhase == phase,
            recovered.mutationReason == reason,
            recovered.admission == .closed,
            !recovered.nextLaunchPurge,
            !recovered.localPrivacyBarrierFailed,
            !recovered.corruptState
        else {
            return false
        }
        return (await zeroCountsLocked()).isZero
    }

    private func hasHealthyClosedMutationReceiptInvariantLocked(_ candidate: NotificationDurableState) async -> Bool {
        guard hasClosedFiveZeroStateStructureLocked(candidate) else {
            return false
        }
        return (await zeroCountsLocked()).isZero
    }
    private func isCleanClosedNonterminalStateLocked(_ candidate: NotificationDurableState) -> Bool {
        guard
            candidate.admission == .closed,
            candidate.sessionMarker == nil,
            (candidate.mutationPhase == .dormantRebind || candidate.authVersion == nil),
            !candidate.nextLaunchPurge,
            !candidate.localPrivacyBarrierFailed,
            !candidate.corruptState,
            candidate.registry.isEmpty,
            candidate.handoffs.isEmpty,
            candidate.pendingTaps.isEmpty,
            candidate.operations.isEmpty,
            candidate.usedAuthorizationReceipts.isEmpty,
            candidate.foregroundPresentationIDs.isEmpty
        else {
            return false
        }
        switch candidate.mutationPhase {
        case .unbound, .readyForRebind, .dormantRebind:
            return true
        case .bound, .awaitingFinalize, .terminal, .corruptFailure:
            return false
        }
    }

    private func quarantineColdPayload(_ payload: DataOnlyPayload, kind: ColdPayloadKind) {
        let now = Self.nowMillis()
        coldPayloadLock.lock()
        defer { coldPayloadLock.unlock() }
        if coldPayloadQuarantine?.expiresAtMillis ?? 0 <= now {
            coldPayloadQuarantine = nil
        }
        guard coldPayloadQuarantine == nil else { return }
        coldPayloadQuarantine = QuarantinedColdPayload(
            kind: kind,
            payload: payload,
            expiresAtMillis: now + Self.coldPayloadQuarantineTTLMillis
        )
    }

    private func pruneColdPayloadQuarantine(now: Int64) {
        coldPayloadLock.lock()
        defer { coldPayloadLock.unlock() }
        if coldPayloadQuarantine?.expiresAtMillis ?? 0 <= now {
            coldPayloadQuarantine = nil
        }
    }

    private func clearColdPayloadQuarantine() {
        coldPayloadLock.lock()
        coldPayloadQuarantine = nil
        coldPayloadLock.unlock()
    }

    private func takeColdPayloadQuarantine() -> QuarantinedColdPayload? {
        let now = Self.nowMillis()
        coldPayloadLock.lock()
        defer { coldPayloadLock.unlock() }
        guard let quarantined = coldPayloadQuarantine else { return nil }
        guard quarantined.expiresAtMillis > now else {
            coldPayloadQuarantine = nil
            return nil
        }
        coldPayloadQuarantine = nil
        return quarantined
    }

    /// A cold payload can survive only while the new process remains closed and
    /// dormant. All other phases drop it rather than making it displayable.
    private func retainColdPayloadOnlyWhileDormantRebindLocked() -> Bool {
        guard
            let state,
            state.mutationPhase == .dormantRebind,
            isCleanClosedNonterminalStateLocked(state)
        else {
            clearColdPayloadQuarantine()
            return false
        }
        pruneColdPayloadQuarantine(now: Self.nowMillis())
        coldPayloadLock.lock()
        defer { coldPayloadLock.unlock() }
        return coldPayloadQuarantine != nil
    }

    /// Rebinding consumes the memory-only quarantine and writes fresh epoch-bound
    /// handoff evidence. It never persists notification text, subject, or bearer.
    private func releaseColdPayloadAfterVerifiedRebindLocked() -> Bool {
        guard let quarantined = takeColdPayloadQuarantine() else { return true }
        guard
            var next = state,
            isDisplayAdmittedLocked(),
            next.admission == .open,
            next.mutationPhase == .bound
        else {
            return true
        }

        switch quarantined.kind {
        case .dataOnly:
            guard
                NativeNotificationCoordinatorProtocolLimits.acceptsInsertion(atCount: next.handoffs.count),
                next.registry[quarantined.payload.deliveryID] == nil,
                next.handoffs[quarantined.payload.deliveryID] == nil,
                next.pendingTaps[quarantined.payload.deliveryID] == nil,
                !next.operations.values.contains(where: { $0.deliveryID == quarantined.payload.deliveryID })
            else {
                return true
            }
            next.handoffs[quarantined.payload.deliveryID] = DataOnlyHandoff(
                noticeID: quarantined.payload.noticeID,
                displayEpoch: next.displayEpoch,
                expiresAtMillis: quarantined.expiresAtMillis
            )
        case .tap:
            guard
                NativeNotificationCoordinatorProtocolLimits.acceptsInsertion(atCount: next.pendingTaps.count),
                next.registry.count < Self.maximumRegistryEntries,
                next.handoffs[quarantined.payload.deliveryID] == nil,
                next.pendingTaps[quarantined.payload.deliveryID] == nil,
                next.registry[quarantined.payload.deliveryID] == nil,
                !next.operations.values.contains(where: { $0.deliveryID == quarantined.payload.deliveryID })
            else {
                return true
            }
            let requestIdentifier = Self.requestIdentifier(for: quarantined.payload.deliveryID)
            next.registry[quarantined.payload.deliveryID] = NotificationRegistryEntry(
                requestIdentifier: requestIdentifier,
                noticeID: quarantined.payload.noticeID,
                displayEpoch: next.displayEpoch,
                phase: .displayed,
                createdAtMillis: Self.nowMillis()
            )
            next.pendingTaps[quarantined.payload.deliveryID] = PendingTap(
                noticeID: quarantined.payload.noticeID,
                displayEpoch: next.displayEpoch,
                requestIdentifier: requestIdentifier,
                expiresAtMillis: quarantined.expiresAtMillis
            )
        }

        do {
            try persistLocked(next)
            return true
        } catch {
            failClosedLocked()
            return false
        }
    }

    private func isPersistedAdmissionOpenLocked() -> Bool {
        guard
            let state,
            let authVersion = state.authVersion,
            NativeNotificationCoordinatorPlugin.canonicalPositiveSafeInteger(authVersion) == authVersion
        else {
            return false
        }
        return state.admission == .open
            && state.mutationPhase == .bound
            && state.sessionMarker != nil
            && state.bindingGeneration > 0
            && state.tokenGeneration > 0
            && !state.nextLaunchPurge
    }

    private func isDisplayAdmittedLocked() -> Bool {
        isPersistedAdmissionOpenLocked()
            && activeSessionID != nil
            && state?.localPrivacyBarrierFailed == false
            && state?.corruptState == false
    }

    private func operationMatchesCurrentStateLocked(_ operation: AuthorizationOperation) -> Bool {
        guard let state else { return false }
        return isDisplayAdmittedLocked()
            && operation.displayEpoch == state.displayEpoch
            && operation.sessionMarker == state.sessionMarker
            && operation.bindingGeneration == state.bindingGeneration
            && operation.tokenGeneration == state.tokenGeneration
    }

    private func receiptMatchesLocked(_ receipt: AuthorizationReceipt, operation: AuthorizationOperation) -> Bool {
        receipt.payload.deliveryID == operation.deliveryID
            && receipt.payload.noticeID == operation.noticeID
            && receipt.displayEpoch == operation.displayEpoch
            && receipt.bindingGeneration == operation.bindingGeneration
            && receipt.tokenGeneration == operation.tokenGeneration
    }
    private func authorizationNetworkRequestLocked(_ operation: AuthorizationOperation) -> AuthorizationNetworkRequest? {
        guard
            let state,
            let apiOrigin = validatedAPIOrigin,
            let sessionID = activeSessionID,
            let authorizationBearer,
            let authVersion = state.authVersion,
            NativeNotificationCoordinatorPlugin.canonicalPositiveSafeInteger(authVersion) == authVersion,
            state.bindingGeneration > 0,
            state.tokenGeneration > 0,
            state.sessionMarker == operation.sessionMarker,
            Self.sessionMarker(
                sessionID: sessionID,
                authVersion: authVersion,
                key: state.sessionMarkerKey
            ) == operation.sessionMarker,
            let noticeID = UInt64(operation.noticeID),
            noticeID > 0
        else {
            return nil
        }

        let body: [String: Any] = [
            "notice_id": NSNumber(value: noticeID),
            "installation_id": state.installationID,
            "binding_generation": operation.bindingGeneration,
            "token_generation": operation.tokenGeneration,
            "session_id": sessionID,
            "client_display_epoch": String(operation.displayEpoch),
        ]
        guard
            JSONSerialization.isValidJSONObject(body),
            let bodyData = try? JSONSerialization.data(withJSONObject: body),
            let url = URL(string: "/v1/push-deliveries/\(operation.deliveryID)/authorize-display", relativeTo: apiOrigin)?.absoluteURL,
            url.scheme?.lowercased() == "https"
        else {
            return nil
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.httpBody = bodyData
        request.timeoutInterval = Self.authorizationRequestTimeout
        request.setValue("application/json; charset=utf-8", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue(authorizationBearer, forHTTPHeaderField: "Authorization")
        request.setValue(Self.releaseContract, forHTTPHeaderField: "X-ZeroTime-Contract")
        request.setValue(UUID().uuidString.lowercased(), forHTTPHeaderField: "Idempotency-Key")
        return AuthorizationNetworkRequest(
            operation: operation,
            apiOrigin: apiOrigin,
            request: request,
            cancellation: AuthorizationNetworkCancellation()
        )
    }

    private static func authorizeOperation(_ authorizationRequest: AuthorizationNetworkRequest) async -> ServerAuthorization? {
        guard !Task.isCancelled, !authorizationRequest.cancellation.isCancelled else { return nil }
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = authorizationRequestTimeout
        configuration.timeoutIntervalForResource = authorizationRequestTimeout
        configuration.waitsForConnectivity = false
        let redirectDelegate = RedirectRejectingURLSessionDelegate()
        let session = URLSession(
            configuration: configuration,
            delegate: redirectDelegate,
            delegateQueue: nil
        )
        guard authorizationRequest.cancellation.attach(session) else { return nil }

        return await withTaskCancellationHandler(operation: {
            defer {
                authorizationRequest.cancellation.finish(session)
                session.invalidateAndCancel()
            }
            guard !Task.isCancelled, !authorizationRequest.cancellation.isCancelled else { return nil }
            do {
                let (data, response) = try await session.data(for: authorizationRequest.request)
                guard data.count <= authorizationResponseMaximumBytes else { return nil }
                var duplicateKeyValidator = JSONDuplicateKeyValidator(data)
                guard
                    !Task.isCancelled,
                    !authorizationRequest.cancellation.isCancelled,
                    let httpResponse = response as? HTTPURLResponse,
                    httpResponse.statusCode == 200,
                    httpResponse.value(forHTTPHeaderField: "X-ZeroTime-Contract") == releaseContract,
                    isExpectedAuthorizationResponseURL(
                        httpResponse.url,
                        expected: authorizationRequest.request.url,
                        apiOrigin: authorizationRequest.apiOrigin
                    ),
                    isJSONContentType(httpResponse.value(forHTTPHeaderField: "Content-Type")),
                    duplicateKeyValidator.hasNoDuplicateKeys(),
                    let object = try JSONSerialization.jsonObject(with: data) as? [String: Any]
                else {
                    return nil
                }
                return ServerAuthorization(object)
            } catch {
                return nil
            }
        }, onCancel: {
            authorizationRequest.cancellation.cancel()
        })
    }

    private static func isExpectedAuthorizationResponseURL(
        _ finalURL: URL?,
        expected: URL?,
        apiOrigin: URL
    ) -> Bool {
        guard
            let finalURL,
            let expected,
            finalURL.absoluteString == expected.absoluteString,
            let finalComponents = URLComponents(url: finalURL, resolvingAgainstBaseURL: false),
            let originComponents = URLComponents(url: apiOrigin, resolvingAgainstBaseURL: false),
            finalComponents.scheme?.lowercased() == originComponents.scheme?.lowercased(),
            finalComponents.host?.lowercased() == originComponents.host?.lowercased(),
            finalComponents.port == originComponents.port,
            finalComponents.user == nil,
            finalComponents.password == nil,
            finalComponents.query == nil,
            finalComponents.fragment == nil
        else {
            return false
        }
        return true
    }

    private static func isJSONContentType(_ value: String?) -> Bool {
        guard let value else { return false }
        let normalized = value.lowercased()
        return normalized == "application/json" || normalized == "application/json; charset=utf-8"
    }

    private func hasVerifiedCredentialAbsenceLocked(key: String) -> Bool {
        guard
            let state,
            (
                (state.mutationPhase == .unbound && state.mutationReason == nil)
                    || (state.mutationPhase == .readyForRebind && state.mutationReason == nil)
                    || isHealthyCompletedMutationReceiptStateLocked(state)
            ),
            key == "zerotime.native-auth.refresh.v1" || key == "zerotime.native-auth.session.v1"
        else {
            return false
        }
        return true
    }

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
            // Native completion owns the refresh/session/transient wipe. Bridge
            // cleanup may only delete its remaining normal-phase records.
            return true
        }

        switch state.mutationPhase {
        case .unbound, .readyForRebind:
            return key == "zerotime.native-auth.transient.v1"
        case .dormantRebind:
            // A clean restart may only inspect the persisted refresh/session
            // material before server validation and bindSession.
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

    private func finishNetworkAuthorizationLocked(_ operationID: String) {
        authorizationNetworkCancellations.removeValue(forKey: operationID)
    }

    private func cancelNetworkAuthorizationLocked(_ operationID: String) {
        authorizationNetworkCancellations.removeValue(forKey: operationID)?.cancel()
    }

    private func cancelNetworkAuthorizationsNotInLocked(_ operationIDs: Set<String>) {
        let cancellations = authorizationNetworkCancellations
            .filter { !operationIDs.contains($0.key) }
            .map(\.value)
        authorizationNetworkCancellations = authorizationNetworkCancellations
            .filter { operationIDs.contains($0.key) }
        cancellations.forEach { $0.cancel() }
    }

    private func cancelAllNetworkAuthorizationsLocked() {
        let cancellations = Array(authorizationNetworkCancellations.values)
        authorizationNetworkCancellations.removeAll()
        cancellations.forEach { $0.cancel() }
    }
    private func abortDisplayOperationLocked(_ operationID: String) {
        cancelNetworkAuthorizationLocked(operationID)
        guard var next = state, next.operations[operationID]?.kind == .display else { return }
        next.operations.removeValue(forKey: operationID)
        do {
            try persistLocked(next)
        } catch {
            failClosedLocked()
        }
    }

    private func denyTapOperationLocked(_ operationID: String) async {
        cancelNetworkAuthorizationLocked(operationID)
        guard let deliveryID = state?.operations[operationID]?.deliveryID else { return }
        await removeDeniedTapLocked(deliveryID: deliveryID)
    }

    private func pruneExpiredLocked(now: Int64) async {
        pruneColdPayloadQuarantine(now: now)
        guard var next = state else { return }
        let expiredTapDeliveryIDs = Set(
            next.pendingTaps.compactMap { deliveryID, tap in
                tap.expiresAtMillis < now ? deliveryID : nil
            }
            + next.operations.values.compactMap { operation in
                operation.kind == .tap && operation.expiresAtMillis < now
                    ? operation.deliveryID
                    : nil
            }
        )
        next.handoffs = next.handoffs.filter { $0.value.expiresAtMillis >= now }
        next.pendingTaps = next.pendingTaps.filter { $0.value.expiresAtMillis >= now }
        next.operations = next.operations.filter { $0.value.expiresAtMillis >= now }
        next.usedAuthorizationReceipts = next.usedAuthorizationReceipts.filter { $0.value.expiresAtMillis >= now }
        cancelNetworkAuthorizationsNotInLocked(Set(next.operations.keys))
        next.foregroundPresentationIDs.formIntersection(Set(next.registry.keys))
        if next.registry.count >= Self.maximumRegistryEntries {
            guard let activeRequestIdentifiers = await Self.activeAppNotificationRequestIdentifiers() else {
                markPurgeFailureLocked()
                return
            }
            next.registry = next.registry.filter { activeRequestIdentifiers.contains($0.value.requestIdentifier) }
            next.foregroundPresentationIDs.formIntersection(Set(next.registry.keys))
        }
        pendingFCMTokens = Array(pendingFCMTokens.suffix(Self.maximumPendingFCMTokens))
        do {
            try persistLocked(next)
        } catch {
            failClosedLocked()
            return
        }
        for deliveryID in expiredTapDeliveryIDs {
            await removeDeniedTapLocked(deliveryID: deliveryID)
        }
    }

    private func dropReservationLocked(_ deliveryID: String, requestIdentifier: String) {
        guard var next = state, next.registry[deliveryID]?.requestIdentifier == requestIdentifier else { return }
        next.registry.removeValue(forKey: deliveryID)
        do { try persistLocked(next) } catch { markPurgeFailureLocked() }
    }

    private func removeDeniedTapLocked(deliveryID: String) async {
        let requestIdentifier = state?.registry[deliveryID]?.requestIdentifier ?? Self.requestIdentifier(for: deliveryID)
        guard await Self.removeRequestsAndVerify([requestIdentifier]) else {
            markPurgeFailureLocked()
            return
        }
        guard var next = state else { return }
        next.pendingTaps.removeValue(forKey: deliveryID)
        next.foregroundPresentationIDs.remove(deliveryID)
        next.registry.removeValue(forKey: deliveryID)
        next.operations = next.operations.filter { $0.value.deliveryID != deliveryID }
        cancelNetworkAuthorizationsNotInLocked(Set(next.operations.keys))
        do { try persistLocked(next) } catch { markPurgeFailureLocked() }
    }

    private func compensateAmbiguousRequestLocked(_ requestIdentifier: String) async {
        guard await Self.removeRequestsAndVerify([requestIdentifier]) else {
            markPurgeFailureLocked()
            return
        }
    }

    private func markPurgeFailureLocked() {
        clearColdPayloadQuarantine()
        guard var next = state else { return }
        let ownerlessCredentialPhase = next.mutationReason == nil
            && (next.mutationPhase == .unbound || next.mutationPhase == .readyForRebind)
        let hasOwnerlessSessionCredentials: Bool
        do {
            hasOwnerlessSessionCredentials = try ownerlessCredentialPhase
                && NativeNotificationCoordinatorPlugin.credentialStore.hasRefreshOrSessionCredentials()
        } catch {
            failClosedLocked()
            return
        }
        let preservesCredentialRebindProvenance = next.mutationReason == nil
            && (
                next.mutationPhase == .bound
                    || next.mutationPhase == .dormantRebind
                    || (ownerlessCredentialPhase && (next.authVersion != nil || hasOwnerlessSessionCredentials))
            )
        if preservesCredentialRebindProvenance {
            next.mutationPhase = .dormantRebind
            next.mutationReason = nil
        } else {
            next.authVersion = nil
        }
        next.admission = .closing
        next.sessionMarker = nil
        next.nextLaunchPurge = true
        next.localPrivacyBarrierFailed = true
        activeSessionID = nil
        authorizationBearer = nil
        cancelAllNetworkAuthorizationsLocked()
        pendingFCMTokens.removeAll()
        do { try persistLocked(next) } catch { state = next }
    }

    private func failClosedLocked() {
        clearColdPayloadQuarantine()
        if var state {
            let ownerlessCredentialPhase = state.mutationReason == nil
                && (state.mutationPhase == .unbound || state.mutationPhase == .readyForRebind)
            let hasOwnerlessSessionCredentials: Bool
            if ownerlessCredentialPhase {
                do {
                    hasOwnerlessSessionCredentials = try NativeNotificationCoordinatorPlugin.credentialStore.hasRefreshOrSessionCredentials()
                } catch {
                    hasOwnerlessSessionCredentials = true
                }
            } else {
                hasOwnerlessSessionCredentials = false
            }
            let preservesCredentialRebindProvenance = state.mutationReason == nil
                && (
                    state.mutationPhase == .bound
                        || state.mutationPhase == .dormantRebind
                        || (ownerlessCredentialPhase && (state.authVersion != nil || hasOwnerlessSessionCredentials))
                )
            if preservesCredentialRebindProvenance {
                state.mutationPhase = .dormantRebind
                state.mutationReason = nil
            } else {
                state.authVersion = nil
            }
            state.admission = .closing
            state.sessionMarker = nil
            state.nextLaunchPurge = true
            state.localPrivacyBarrierFailed = true
            self.state = state
        }
        activeSessionID = nil
        authorizationBearer = nil
        cancelAllNetworkAuthorizationsLocked()
        pendingFCMTokens.removeAll()
        validatedAPIOrigin = nil
        releaseValidated = false
    }

    private func persistLocked(_ next: NotificationDurableState) throws {
        try stateStore.write(JSONEncoder().encode(next))
        state = next
    }

    private func emitQueuedEventsLocked() {
        guard releaseValidated, !releaseConfigurationBlocked, let state, !state.localPrivacyBarrierFailed, !state.corruptState else { return }
        for (deliveryID, handoff) in state.handoffs where handoff.displayEpoch == state.displayEpoch {
            emitDataOnlyPayload(DataOnlyPayload(["delivery_id": deliveryID, "notice_id": handoff.noticeID])!)
        }
        for (deliveryID, tap) in state.pendingTaps where tap.displayEpoch == state.displayEpoch {
            if let payload = DataOnlyPayload(["delivery_id": deliveryID, "notice_id": tap.noticeID]) {
                emitTap(payload, displayEpoch: tap.displayEpoch)
            }
        }
        guard
            !pendingFCMTokens.isEmpty,
            isDisplayAdmittedLocked(),
            !hasEmittedPendingFCMTokensForCurrentBinding
        else {
            return
        }
        for token in pendingFCMTokens {
            NativeNotificationCoordinatorPlugin.emit("fcmToken", data: ["token": token])
        }
        pendingFCMTokens.removeAll()
        hasEmittedPendingFCMTokensForCurrentBinding = true
    }

    private func emitDataOnlyPayload(_ payload: DataOnlyPayload) {
        NativeNotificationCoordinatorPlugin.emit("dataOnlyPush", data: [
            "delivery_id": payload.deliveryID,
            "notice_id": payload.noticeID,
        ])
    }

    private func emitTap(_ payload: DataOnlyPayload, displayEpoch: UInt64) {
        NativeNotificationCoordinatorPlugin.emit("notificationTap", data: [
            "delivery_id": payload.deliveryID,
            "notice_id": payload.noticeID,
            "display_epoch": String(displayEpoch),
        ])
    }

    private static func validateReleaseManifest(
        contract: String,
        manifest: [String: Any],
        runtimeFirebaseProjectID: String?
    ) -> Bool {
        let keys: Set<String> = [
            "contract", "contract_sha256", "plane", "frontend_git_sha", "backend_git_sha", "backend_image_digest",
            "backend_deployment_id", "backend_deployed_at_utc", "firebase_project_id", "api_origin", "platform",
            "app_version", "build_number", "bundle_id",
        ]
        guard
            Bundle.main.object(forInfoDictionaryKey: "ZeroTimeNativeCoordinatorContract") as? String == coordinatorContract,
            Set(manifest.keys) == keys,
            contract == coordinatorContract,
            manifest["contract"] as? String == releaseContract,
            manifest["contract_sha256"] as? String == releaseContractSHA256,
            manifest["platform"] as? String == "ios",
            manifest["bundle_id"] as? String == Bundle.main.bundleIdentifier,
            let firebaseProjectID = manifest["firebase_project_id"] as? String,
            !firebaseProjectID.isEmpty,
            firebaseProjectID == runtimeFirebaseProjectID,
            validatedAPIOrigin(manifest) != nil
        else {
            return false
        }
#if DEBUG
        return true
#else
        guard let embedded = Bundle.main.object(forInfoDictionaryKey: "ZeroTimeReleaseManifest") as? [String: Any],
              Set(embedded.keys) == keys,
              manifest.allSatisfy({ key, value in (value as? String) == (embedded[key] as? String) }),
              manifest["app_version"] as? String == Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String,
              manifest["build_number"] as? String == Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String else {
            return false
        }
        return true
#endif
    }

    private static func validatedAPIOrigin(_ manifest: [String: Any]) -> URL? {
        guard
            let rawValue = manifest["api_origin"] as? String,
            rawValue.utf8.count <= 2_048,
            let components = URLComponents(string: rawValue),
            components.scheme?.lowercased() == "https",
            let host = components.host,
            !host.isEmpty,
            components.user == nil,
            components.password == nil,
            components.query == nil,
            components.fragment == nil,
            components.path.isEmpty || components.path == "/",
            components.port.map({ (1...65_535).contains($0) }) ?? true
        else {
            return nil
        }
        var canonical = URLComponents()
        canonical.scheme = "https"
        canonical.host = host.lowercased()
        canonical.port = components.port
        return canonical.url
    }

    private static func sessionMarker(sessionID: String, authVersion: String, key: Data) -> String {
        var evidence = Data(sessionID.utf8)
        evidence.append(contentsOf: [0])
        evidence.append(Data(authVersion.utf8))
        let authenticationCode = HMAC<SHA256>.authenticationCode(for: evidence, using: SymmetricKey(data: key))
        return authenticationCode.map { String(format: "%02x", $0) }.joined()
    }

    static func requestIdentifier(for deliveryID: String) -> String {
        "\(notificationPrefix)\(deliveryID.lowercased())"
    }

    private static func nowMillis() -> Int64 {
        Int64((Date().timeIntervalSince1970 * 1_000).rounded(.towardZero))
    }

    static func displayPermission() async -> String {
        let settings = await withCheckedContinuation { continuation in
            UNUserNotificationCenter.current().getNotificationSettings { continuation.resume(returning: $0) }
        }
        switch settings.authorizationStatus {
        case .notDetermined: return "not_determined"
        case .denied: return "denied"
        case .authorized: return "granted"
        case .provisional: return "provisional"
        case .ephemeral: return "ephemeral"
        @unknown default: return "denied"
        }
    }
    private static func currentDisplayPermissionAllowsScheduling() async -> Bool {
        switch await displayPermission() {
        case "granted", "provisional", "ephemeral":
            return true
        default:
            return false
        }
    }

    static func requestDisplayPermission() async -> String {
        guard await displayPermission() == "not_determined" else { return await displayPermission() }
        _ = await withCheckedContinuation { continuation in
            UNUserNotificationCenter.current().requestAuthorization(options: [.alert]) { granted, error in
                continuation.resume(returning: granted && error == nil)
            }
        }
        return await displayPermission()
    }

    private static func addLocalNotification(
        identifier: String,
        title: String,
        payload: DataOnlyPayload,
        displayEpoch: UInt64
    ) async -> Bool {
        let content = UNMutableNotificationContent()
        content.title = title
        content.categoryIdentifier = notificationCategory
        content.userInfo = [
            "delivery_id": payload.deliveryID,
            "notice_id": payload.noticeID,
            "display_epoch": String(displayEpoch),
        ]
        let request = UNNotificationRequest(identifier: identifier, content: content, trigger: nil)
        return await withCheckedContinuation { continuation in
            UNUserNotificationCenter.current().add(request) { error in continuation.resume(returning: error == nil) }
        }
    }

    private static func removeRequestsAndVerify(_ identifiers: [String]) async -> Bool {
        guard !identifiers.isEmpty else { return true }
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: identifiers)
        center.removeDeliveredNotifications(withIdentifiers: identifiers)
        guard
            let pending = await pendingRequests(),
            let delivered = await deliveredNotifications()
        else {
            return false
        }
        let target = Set(identifiers)
        return !pending.contains(where: { target.contains($0.identifier) })
            && !delivered.contains(where: { target.contains($0.request.identifier) })
    }

    private static func purgeAllAppNotifications() async -> Bool {
        let center = UNUserNotificationCenter.current()
        for attempt in 0..<purgeAttempts {
            center.removeAllPendingNotificationRequests()
            center.removeAllDeliveredNotifications()
            if attempt + 1 < purgeAttempts {
                try? await Task.sleep(nanoseconds: 75_000_000)
            }
            guard let counts = await allAppNotificationCounts() else { return false }
            if counts.pending == 0 && counts.delivered == 0 { return true }
        }
        return false
    }

    private static func allAppNotificationCounts() async -> (pending: Int, delivered: Int)? {
        guard
            let pending = await pendingRequests(),
            let delivered = await deliveredNotifications()
        else {
            return nil
        }
        return (pending.count, delivered.count)
    }

    private static func activeAppNotificationRequestIdentifiers() async -> Set<String>? {
        guard
            let pending = await pendingRequests(),
            let delivered = await deliveredNotifications()
        else {
            return nil
        }
        return Set(pending.map(\.identifier) + delivered.map(\.request.identifier))
    }

    private static func pendingRequests() async -> [UNNotificationRequest]? {
        await enumerateNotificationCenter { completion in
            UNUserNotificationCenter.current().getPendingNotificationRequests(completionHandler: completion)
        }
    }

    private static func deliveredNotifications() async -> [UNNotification]? {
        await enumerateNotificationCenter { completion in
            UNUserNotificationCenter.current().getDeliveredNotifications(completionHandler: completion)
        }
    }

    /// The callback and timeout race through one continuation, so a late system
    /// response cannot convert an enumeration timeout into a false zero.
    private static func enumerateNotificationCenter<Value>(
        _ callback: @escaping (@escaping ([Value]) -> Void) -> Void
    ) async -> [Value]? {
        await withCheckedContinuation { (continuation: CheckedContinuation<[Value]?, Never>) in
            let once = OnceNotificationEnumeration<[Value]>(continuation)
            DispatchQueue.global(qos: .utility).asyncAfter(
                deadline: .now() + notificationEnumerationTimeout
            ) {
                once.resume(nil)
            }
            callback { values in
                once.resume(values)
            }
        }
    }
}

private struct ZeroCounts {
    let pending: Int
    let delivered: Int
    let foreground: Int
    let registry: Int
    let inflight: Int

    var isZero: Bool { pending == 0 && delivered == 0 && foreground == 0 && registry == 0 && inflight == 0 }

    var dictionary: [String: Any] {
        [
            "pending_count": pending,
            "delivered_count": delivered,
            "foreground_banner_count": foreground,
            "registry_count": registry,
            "inflight_count": inflight,
        ]
    }
}
