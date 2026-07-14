import Capacitor
import FirebaseCore
import FirebaseMessaging
import UIKit
import UserNotifications

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, MessagingDelegate, UNUserNotificationCenterDelegate {
    var window: UIWindow?
    private var gatedBridgeViewController: UIViewController?
    private var launchGateViewController: NativeLaunchGateViewController?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self

        let firebaseConfigurationExists = Bundle.main.url(forResource: "GoogleService-Info", withExtension: "plist") != nil
        if firebaseConfigurationExists {
            FirebaseApp.configure()
        }
        let firebaseProjectID = FirebaseApp.app()?.options.projectID
        let firebaseConfigured = firebaseProjectID?.isEmpty == false

#if DEBUG
        if firebaseConfigured {
            Messaging.messaging().delegate = self
            application.registerForRemoteNotifications()
        }
#else
        if firebaseConfigured {
            Messaging.messaging().delegate = self
            application.registerForRemoteNotifications()
        } else {
            assertionFailure("A valid GoogleService-Info.plist with a Firebase project ID is required for a release archive.")
        }
#endif

        installLaunchGate()
        beginLaunchPreflight(
            firebaseConfigured: firebaseConfigured,
            firebaseProjectID: firebaseProjectID
        )
        return true
    }

    private func installLaunchGate() {
        let gate = NativeLaunchGateViewController()
        let bridge = window?.rootViewController
            ?? UIStoryboard(name: "Main", bundle: nil).instantiateInitialViewController()

        if window == nil {
            window = UIWindow(frame: UIScreen.main.bounds)
        }
        window?.rootViewController = gate
        window?.makeKeyAndVisible()
        launchGateViewController = gate

        guard let bridge else {
            gate.showRecovery()
            return
        }
        gatedBridgeViewController = bridge
    }

    private func beginLaunchPreflight(firebaseConfigured: Bool, firebaseProjectID: String?) {
        Task { [weak self] in
            let passed = await NativeNotificationCoordinatorPlugin.runLaunchPreflight(
                firebaseConfigured: firebaseConfigured,
                firebaseProjectID: firebaseProjectID
            )
            await MainActor.run {
                guard let self, let gate = self.launchGateViewController else { return }
                guard passed, let bridge = self.gatedBridgeViewController else {
                    self.gatedBridgeViewController = nil
                    gate.showRecovery()
                    return
                }
                self.window?.rootViewController = bridge
                self.window?.makeKeyAndVisible()
                self.gatedBridgeViewController = nil
                self.launchGateViewController = nil
            }
        }
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        guard FirebaseApp.app() != nil else { return }
        Messaging.messaging().apnsToken = deviceToken
    }

    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        NativeNotificationCoordinatorPlugin.queueFCMRegistrationToken(fcmToken)
    }

    func application(
        _ application: UIApplication,
        didReceiveRemoteNotification userInfo: [AnyHashable: Any],
        fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
    ) {
        guard let data = dataOnlyApplicationPayload(from: userInfo) else {
            completionHandler(.noData)
            return
        }
        Task(priority: .background) {
            let result = await NativeNotificationCoordinatorPlugin.handleAPNSDataOnlyPayload(data)
            completionHandler(result.backgroundFetchResult)
        }
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        NativeNotificationCoordinatorPlugin.completeForegroundPresentation(
            requestIdentifier: notification.request.identifier,
            userInfo: notification.request.content.userInfo,
            completionHandler: completionHandler
        )
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        Task {
            await NativeNotificationCoordinatorPlugin.handleNotificationTap(
                requestIdentifier: response.notification.request.identifier,
                userInfo: response.notification.request.content.userInfo
            )
            completionHandler()
        }
    }

    func application(
        _ app: UIApplication,
        open url: URL,
        options: [UIApplication.OpenURLOptionsKey: Any] = [:]
    ) -> Bool {
        // OAuth bearer material is never accepted through any custom scheme.
        // The only native callback transport is the verified universal link below.
        _ = app
        _ = url
        _ = options
        return false
    }

    func application(
        _ application: UIApplication,
        continue userActivity: NSUserActivity,
        restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
    ) -> Bool {
        guard
            userActivity.activityType == NSUserActivityTypeBrowsingWeb,
            let callbackURL = userActivity.webpageURL,
            isNativeOAuthCallback(callbackURL)
        else {
            return false
        }
        NativeNotificationCoordinatorPlugin.queueVerifiedUniversalLink(
            application: application,
            userActivity: userActivity,
            restorationHandler: restorationHandler
        )
        return true
    }

    /// Accept only the exact two application IDs and documented transport
    /// metadata. Unknown top-level data is a protocol violation, not a field to
    /// silently discard before the native coordinator sees it.
    private func dataOnlyApplicationPayload(from userInfo: [AnyHashable: Any]) -> [String: Any]? {
        let applicationKeys: Set<String> = ["delivery_id", "notice_id"]
        let firebaseTransportKeys: Set<String> = [
            "aps", "from", "collapse_key", "message_type", "google.to", "google.c.sender.id",
            "google.c.a.e", "google.c.a.c_id", "google.c.a.ts", "gcm.message_id",
        ]
        guard userInfo.keys.allSatisfy({ key in
            guard let key = key as? String else { return false }
            return applicationKeys.contains(key) || firebaseTransportKeys.contains(key)
        }) else {
            return nil
        }
        guard
            let aps = userInfo["aps"] as? [AnyHashable: Any],
            aps.count == 1,
            let contentAvailable = aps["content-available"] as? NSNumber,
            CFGetTypeID(contentAvailable) != CFBooleanGetTypeID(),
            contentAvailable.doubleValue == 1,
            let deliveryID = userInfo["delivery_id"] as? String,
            let noticeID = userInfo["notice_id"] as? String
        else {
            return nil
        }
        return ["delivery_id": deliveryID, "notice_id": noticeID]
    }

    private func isNativeOAuthCallback(_ url: URL) -> Bool {
        guard
            let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
            components.scheme == "https",
            components.percentEncodedHost == "zerotime.kr",
            components.host == "zerotime.kr",
            components.port == nil,
            components.percentEncodedPath == "/auth/native/callback/",
            url.user == nil,
            url.password == nil,
            url.fragment == nil,
            let encodedQuery = components.percentEncodedQuery,
            encodedQuery.utf8.count <= 2_048,
            let queryItems = components.queryItems,
            queryItems.count <= 3
        else {
            return false
        }

        let allowedNames: Set<String> = ["code", "state", "error", "error_description"]
        guard queryItems.allSatisfy({ allowedNames.contains($0.name) }) else {
            return false
        }

        let values = Dictionary(grouping: queryItems, by: \.name)
        let states = values["state"] ?? []
        let codes = values["code"] ?? []
        let errors = values["error"] ?? []
        let descriptions = values["error_description"] ?? []
        guard
            states.count == 1,
            codes.count <= 1,
            errors.count <= 1,
            descriptions.count <= 1,
            let state = states[0].value,
            isOpaqueState(state)
        else {
            return false
        }

        if
            codes.count == 1,
            errors.isEmpty,
            descriptions.isEmpty,
            let code = codes[0].value
        {
            return isBounded(code, minimumBytes: 32, maximumBytes: 512, requireNonBlank: false)
        }
        if
            errors.count == 1,
            codes.isEmpty,
            let error = errors[0].value,
            isBounded(error, minimumBytes: 1, maximumBytes: 128, requireNonBlank: true)
        {
            guard descriptions.isEmpty else {
                guard let description = descriptions[0].value else { return false }
                return isBounded(
                    description,
                    minimumBytes: 1,
                    maximumBytes: 1_024,
                    requireNonBlank: true
                )
            }
            return true
        }
        return false
    }

    private func isBounded(
        _ value: String,
        minimumBytes: Int,
        maximumBytes: Int,
        requireNonBlank: Bool
    ) -> Bool {
        let byteCount = value.utf8.count
        return byteCount >= minimumBytes
            && byteCount <= maximumBytes
            && (!requireNonBlank || !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
    }

    private func isOpaqueState(_ value: String) -> Bool {
        guard value.utf8.count >= 43, value.utf8.count <= 128 else { return false }
        return value.utf8.allSatisfy { byte in
            (byte >= 65 && byte <= 90)
                || (byte >= 97 && byte <= 122)
                || (byte >= 48 && byte <= 57)
                || byte == 45
                || byte == 95
        }
    }
}
private final class NativeLaunchGateViewController: UIViewController {
    private let spinner = UIActivityIndicatorView(style: .medium)
    private let statusLabel = UILabel()

    override func viewDidLoad() {
        super.viewDidLoad()

        view.backgroundColor = .systemBackground
        spinner.startAnimating()

        statusLabel.font = .preferredFont(forTextStyle: .body)
        statusLabel.textAlignment = .center
        statusLabel.numberOfLines = 0
        statusLabel.text = "Preparing ZeroTime securely."

        let stack = UIStackView(arrangedSubviews: [spinner, statusLabel])
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 16
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)

        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(greaterThanOrEqualTo: view.layoutMarginsGuide.leadingAnchor),
            stack.trailingAnchor.constraint(lessThanOrEqualTo: view.layoutMarginsGuide.trailingAnchor),
            stack.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: view.centerYAnchor),
        ])
    }

    func showRecovery() {
        loadViewIfNeeded()
        spinner.stopAnimating()
        statusLabel.text = "ZeroTime notification privacy check failed."
    }
}
