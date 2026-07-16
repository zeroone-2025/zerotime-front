package kr.zerotime.app;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.service.notification.StatusBarNotification;
import android.util.Base64;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.PluginMethod;
import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import org.json.JSONException;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

import java.math.BigInteger;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.ByteBuffer;
import java.nio.CharBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.security.GeneralSecurityException;
import java.security.Key;
import java.security.KeyStore;
import java.security.SecureRandom;
import java.text.BreakIterator;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TimeZone;
import java.util.TreeMap;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.net.ssl.HttpsURLConnection;

/**
 * Process-owned privacy coordinator for Firebase data messages and local notification display.
 *
 * All state transitions run on {@link CoordinatorEngine#serialExecutor}. The Capacitor plugin is
 * merely one adapter: FCM, activity startup, and content taps use the same engine without an
 * active WebView. Remote FCM input is never rendered; it is retained as an opaque two-ID handoff
 * until the native coordinator performs server authorization.
 */
@CapacitorPlugin(
        name = NativeNotificationCoordinatorPlugin.PLUGIN_NAME,
        permissions = {
                @Permission(alias = "notifications", strings = {Manifest.permission.POST_NOTIFICATIONS})
        }
)
public class NativeNotificationCoordinatorPlugin extends Plugin {
    public static final String PLUGIN_NAME = "NativeNotificationCoordinator";
    public static final String DATA_ONLY_PUSH_EVENT = "dataOnlyPush";
    public static final String FCM_TOKEN_EVENT = "fcmToken";
    public static final String NOTIFICATION_TAP_EVENT = "notificationTap";
    public static final String ACTION_NOTIFICATION_TAP = "kr.zerotime.app.NOTIFICATION_TAP";
    public static final String EXTRA_DELIVERY_ID = "kr.zerotime.app.delivery_id";
    public static final String EXTRA_NOTICE_ID = "kr.zerotime.app.notice_id";
    public static final String EXTRA_DISPLAY_EPOCH = "kr.zerotime.app.display_epoch";

    private CoordinatorEngine engine;

    @Override
    public void load() {
        engine = CoordinatorEngine.get(getContext().getApplicationContext());
        engine.attach(this);
    }

    @Override
    protected void handleOnDestroy() {
        if (engine != null) {
            engine.detach(this);
        }
        super.handleOnDestroy();
    }

    @PluginMethod
    public void getOrCreateInstallationId(PluginCall call) {
        engine.execute(() -> resolve(call, engine.getOrCreateInstallationId()));
    }

    @PluginMethod
    public void initialize(PluginCall call) {
        final JSObject input = call.getData();
        engine.execute(() -> resolve(call, engine.initialize(input)));
    }

    @PluginMethod
    public void bindSession(PluginCall call) {
        final JSObject input = call.getData();
        engine.execute(() -> resolve(call, engine.bindSession(input)));
    }

    @PluginMethod
    public void updateSessionGenerations(PluginCall call) {
        final JSObject input = call.getData();
        engine.execute(() -> resolve(call, engine.updateSessionGenerations(input)));
    }

    @PluginMethod
    public void beginDisplayAuthorization(PluginCall call) {
        final JSObject input = call.getData();
        engine.execute(() -> resolve(call, engine.beginDisplayAuthorization(input)));
    }

    @PluginMethod
    public void scheduleAuthorizedNotification(PluginCall call) {
        final JSObject input = call.getData();
        call.setKeepAlive(true);
        engine.execute(() -> engine.scheduleAuthorizedNotification(
                input,
                result -> resolveDeferredOperation(call, result)
        ));
    }

    @PluginMethod
    public void abortDisplayAuthorization(PluginCall call) {
        final JSObject input = call.getData();
        engine.execute(() -> resolve(call, engine.abortAuthorization(input, Operation.KIND_DISPLAY)));
    }

    @PluginMethod
    public void beginTapAuthorization(PluginCall call) {
        final JSObject input = call.getData();
        engine.execute(() -> resolve(call, engine.beginTapAuthorization(input)));
    }

    @PluginMethod
    public void completeTapAuthorization(PluginCall call) {
        final JSObject input = call.getData();
        call.setKeepAlive(true);
        engine.execute(() -> engine.completeTapAuthorization(
                input,
                result -> resolveDeferredOperation(call, result)
        ));
    }

    @PluginMethod
    public void abortTapAuthorization(PluginCall call) {
        final JSObject input = call.getData();
        engine.execute(() -> resolve(call, engine.abortAuthorization(input, Operation.KIND_TAP)));
    }

    @PluginMethod
    public void beginAccountMutation(PluginCall call) {
        final JSObject input = call.getData();
        engine.execute(() -> resolve(call, engine.beginAccountMutation(input)));
    }

    @PluginMethod
    public void finalizeAccountMutation(PluginCall call) {
        final JSObject input = call.getData();
        engine.execute(() -> resolve(call, engine.finalizeAccountMutation(input)));
    }

    @PluginMethod
    public void getAccountMutationLineage(PluginCall call) {
        final JSObject input = call.getData();
        if (input != null && input.length() != 0) {
            call.reject("Invalid account mutation lineage query.");
            return;
        }
        engine.execute(() -> resolve(call, engine.getAccountMutationLineage()));
    }

    @PluginMethod
    public void getDisplayPermission(PluginCall call) {
        engine.execute(() -> {
            JSObject result = new JSObject();
            result.put("permission", engine.displayPermission());
            resolve(call, result);
        });
    }

    @PluginMethod
    public void requestDisplayPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
                || getPermissionState("notifications") == PermissionState.GRANTED) {
            resolvePermission(call);
            return;
        }
        requestPermissionForAlias("notifications", call, "notificationPermissionCallback");
    }

    @PermissionCallback
    private void notificationPermissionCallback(PluginCall call) {
        resolvePermission(call);
    }

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Notification settings are unavailable.");
            return;
        }
        activity.runOnUiThread(() -> {
            JSObject result = new JSObject();
            try {
                Intent intent;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                            .putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
                } else {
                    intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                            .setData(Uri.fromParts("package", getContext().getPackageName(), null));
                }
                activity.startActivity(intent);
                result.put("success", true);
            } catch (ActivityNotFoundException | SecurityException exception) {
                result.put("success", false);
            }
            call.resolve(result);
        });
    }

    @PluginMethod
    public void isSecureCredentialStorageAvailable(PluginCall call) {
        engine.execute(() -> {
            JSObject result = new JSObject();
            result.put("available", engine.credentialsAvailable());
            resolve(call, result);
        });
    }

    @PluginMethod
    public void getSecureCredential(PluginCall call) {
        final JSObject input = call.getData();
        final String key = input == null ? null : secureCredentialKey(input.opt("key"));
        if (!hasExactKeys(input, "key") || key == null) {
            call.reject("Invalid secure credential key.");
            return;
        }
        engine.execute(() -> {
            try {
                JSObject result = new JSObject();
                String value = engine.loadCredential(key);
                result.put("value", value == null ? JSONObject.NULL : value);
                resolve(call, result);
            } catch (GeneralSecurityException exception) {
                reject(call, "Secure credentials are unavailable.");
            }
        });
    }

    @PluginMethod
    public void setSecureCredential(PluginCall call) {
        final JSObject input = call.getData();
        final String key = input == null ? null : secureCredentialKey(input.opt("key"));
        final Object rawValue = input == null ? null : input.opt("value");
        if (!hasExactKeys(input, "key", "value") || key == null || !(rawValue instanceof String)
                || !isSecureCredentialValue((String) rawValue)) {
            call.reject("Invalid secure credential.");
            return;
        }
        engine.execute(() -> {
            try {
                engine.saveCredential(key, (String) rawValue);
                resolve(call, engine.operationResult(true));
            } catch (GeneralSecurityException exception) {
                reject(call, "Secure credentials are unavailable.");
            }
        });
    }

    @PluginMethod
    public void deleteSecureCredential(PluginCall call) {
        final JSObject input = call.getData();
        final String key = input == null ? null : secureCredentialKey(input.opt("key"));
        if (!hasExactKeys(input, "key") || key == null) {
            call.reject("Invalid secure credential key.");
            return;
        }
        engine.execute(() -> {
            try {
                engine.deleteCredential(key);
                resolve(call, engine.operationResult(true));
            } catch (GeneralSecurityException exception) {
                reject(call, "Secure credentials are unavailable.");
            }
        });
    }

    /** Runs idempotent runtime readiness without reconciling persisted notification state. */
    public static boolean runStartupPreflight(Context context) {
        return CoordinatorEngine.get(context.getApplicationContext()).runtimeReadinessBlocking();
    }

    /** Runs the one-time UI cold-launch reconciliation before the WebView is created. */
    public static boolean runUiColdLaunchPreflight(Context context) {
        return CoordinatorEngine.get(context.getApplicationContext()).preflightBlocking();
    }
    /** Retains only opaque tap identifiers until a fresh cold-launch rebind succeeds. */
    public static void quarantineColdNotificationTap(Context context, Intent intent) {
        CoordinatorEngine.get(context.getApplicationContext()).quarantineColdNotificationTap(intent);
    }


    /** Queues an opaque local-notification tap even when no Capacitor plugin is attached. */
    public static void handleNotificationTap(Context context, Intent intent) {
        CoordinatorEngine.get(context.getApplicationContext()).handleNotificationTap(intent);
    }

    private void resolvePermission(PluginCall call) {
        JSObject result = new JSObject();
        result.put("permission", engine.displayPermission());
        call.resolve(result);
    }

    private void emitFromEngine(String event, JSObject payload) {
        Activity activity = getActivity();
        if (activity != null) {
            activity.runOnUiThread(() -> notifyListeners(event, payload, true));
        }
    }

    private void resolveDeferredOperation(PluginCall call, JSObject result) {
        call.setKeepAlive(false);
        resolve(call, result);
    }

    private void resolve(PluginCall call, JSObject result) {
        Activity activity = getActivity();
        if (activity == null) {
            call.resolve(result);
            return;
        }
        activity.runOnUiThread(() -> call.resolve(result));
    }

    private void reject(PluginCall call, String message) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject(message);
            return;
        }
        activity.runOnUiThread(() -> call.reject(message));
    }

    /** Firebase adapter; notification payloads are only a defense-in-depth drop. */
    public static final class DataOnlyMessagingService extends FirebaseMessagingService {
        @Override
        public void onMessageReceived(RemoteMessage message) {
            if (message.getNotification() != null) {
                return;
            }
            CoordinatorEngine.get(getApplicationContext()).receiveDataOnlyPush(message.getData());
        }

        @Override
        public void onNewToken(String token) {
            CoordinatorEngine.get(getApplicationContext()).receiveFcmToken(token);
        }
    }

    private static final class CoordinatorEngine {
        private static final String COORDINATOR_CONTRACT = "native-notification-coordinator.v1";
        private static final String MOBILE_RELEASE_CONTRACT = "mobile-release.v1";
        private static final String MOBILE_RELEASE_CONTRACT_SHA256 =
                "0f736c8e90c5ba1ea68370e327f2f405fba5a83e4807c3bc7691aaa8c0711d84";
        private static final String CHANNEL_ID = "zerotime.authorized-notices.v1";
        private static final int STATE_VERSION = 3;
        private static final int MAX_NOTIFICATION_ID = Integer.MAX_VALUE;
        private static final int MAX_PENDING_HANDOFFS = 32;
        private static final int MAX_USED_RECEIPTS = 128;
        private static final int MAX_PENDING_TAPS = 32;
        private static final int MAX_PENDING_OPERATIONS = 32;
        private static final int NETWORK_EXECUTOR_WORKERS = 2;
        private static final int MAX_NOTIFICATION_REGISTRY = 128;
        private static final long AUTHORIZATION_TTL_MILLIS = 30_000L;
        private static final long HANDOFF_TTL_MILLIS = 10 * 60_000L;
        private static final long TAP_TTL_MILLIS = 10 * 60_000L;
        private static final long COLD_PAYLOAD_QUARANTINE_TTL_MILLIS = 10 * 60_000L;
        private static final long REGISTRY_TTL_MILLIS = 7L * 24L * 60L * 60L * 1000L;
        private static final long PURGE_TIMEOUT_MILLIS = 1_500L;
        private static final long PURGE_RETRY_MILLIS = 75L;
        private static final int NETWORK_CONNECT_TIMEOUT_MILLIS = 3_000;
        private static final int NETWORK_READ_TIMEOUT_MILLIS = 3_000;
        private static final int MAX_AUTHORIZATION_RESPONSE_BYTES = 16 * 1024;
        private static final BigInteger MAX_UINT64 = new BigInteger("18446744073709551615");
        private static final long MAX_JS_SAFE_INTEGER = 9_007_199_254_740_991L;
        private static final Pattern UUID_PATTERN = Pattern.compile(
                "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
        );
        private static final Pattern NOTICE_ID_PATTERN = Pattern.compile("^[1-9][0-9]{0,18}$");
        private static final Pattern UINT64_PATTERN = Pattern.compile("^(0|[1-9][0-9]{0,19})$");
        private static final Pattern OPAQUE_ID_PATTERN = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$");
        private static final Pattern UTC_PATTERN = Pattern.compile(
                "^(\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2})(?:\\.(\\d{1,3}))?Z$"
        );
        private static final AtomicReference<CoordinatorEngine> INSTANCE = new AtomicReference<>();

        private final Context context;
        private final ExecutorService serialExecutor = Executors.newSingleThreadExecutor();
        private final ThreadPoolExecutor networkExecutor = new ThreadPoolExecutor(
                NETWORK_EXECUTOR_WORKERS,
                NETWORK_EXECUTOR_WORKERS,
                0L,
                TimeUnit.MILLISECONDS,
                new ArrayBlockingQueue<>(MAX_PENDING_OPERATIONS - NETWORK_EXECUTOR_WORKERS),
                new ThreadPoolExecutor.AbortPolicy()
        );
        private final EncryptedStateStore stateStore;
        private final NotificationManager notificationManager;
        private final AtomicReference<NativeNotificationCoordinatorPlugin> plugin = new AtomicReference<>();
        private final Map<String, CancellableNetworkOperation> networkOperations = new TreeMap<>();
        private final Map<String, OperationResultContinuation> pendingOperationContinuations = new TreeMap<>();
        private final Map<String, QuarantinedPayload> coldPayloadQuarantine = new TreeMap<>();
        private State state;
        private boolean releaseValidated;
        private boolean runtimeReady;
        private boolean uiColdLaunchReconciled;
        private boolean headlessFcmBootstrapAttempted;
        private boolean headlessFcmBootstrapSucceeded;
        private String validatedApiOrigin;
        private String activeSessionId;
        private volatile String authorizationBearer;
        private interface OperationResultContinuation {
            void complete(JSObject result);
        }

        static CoordinatorEngine get(Context context) {
            CoordinatorEngine existing = INSTANCE.get();
            if (existing != null) {
                return existing;
            }
            CoordinatorEngine created = new CoordinatorEngine(context.getApplicationContext());
            return INSTANCE.compareAndSet(null, created) ? created : INSTANCE.get();
        }

        private CoordinatorEngine(Context context) {
            this.context = context;
            this.stateStore = new EncryptedStateStore(context);
            this.notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            createNotificationChannel();
        }

        void attach(NativeNotificationCoordinatorPlugin plugin) {
            this.plugin.set(plugin);
        }

        void detach(NativeNotificationCoordinatorPlugin plugin) {
            this.plugin.compareAndSet(plugin, null);
        }

        void execute(Runnable runnable) {
            serialExecutor.execute(runnable);
        }

        boolean runtimeReadinessBlocking() {
            CountDownLatch completed = new CountDownLatch(1);
            AtomicReference<Boolean> result = new AtomicReference<>(false);
            execute(() -> {
                try {
                    result.set(ensureRuntimeReadinessLocked());
                } finally {
                    completed.countDown();
                }
            });
            try {
                return completed.await(PURGE_TIMEOUT_MILLIS + 750L, TimeUnit.MILLISECONDS)
                        && Boolean.TRUE.equals(result.get());
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                return false;
            }
        }
        boolean preflightBlocking() {
            CountDownLatch completed = new CountDownLatch(1);
            AtomicReference<Boolean> result = new AtomicReference<>(false);
            execute(() -> {
                try {
                    result.set(launchPreflightLocked());
                } finally {
                    completed.countDown();
                }
            });
            try {
                return completed.await(PURGE_TIMEOUT_MILLIS + 750L, TimeUnit.MILLISECONDS) && Boolean.TRUE.equals(result.get());
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                return false;
            }
        }

        private boolean launchPreflightLocked() {
            if (uiColdLaunchReconciled) {
                return ensureRuntimeReadinessLocked();
            }
            invalidateBootstrapSuccessLocked();
            clearReleaseTrustAndCancelWorkLocked();
            state = null;
            if (!ensureLoadedLocked()) {
                clearColdPayloadQuarantineLocked();
                return false;
            }
            try {
                pruneExpiredLocked(System.currentTimeMillis());
                if (!reconcileLoadedStateLocked()) {
                    clearColdPayloadQuarantineLocked();
                    invalidateBootstrapSuccessLocked();
                    return false;
                }
                uiColdLaunchReconciled = true;
                runtimeReady = true;
                return true;
            } catch (GeneralSecurityException | JSONException | IllegalStateException exception) {
                failClosedLocked();
                return false;
            }
        }

        private boolean bootstrapLocked() {
            return ensureRuntimeReadinessLocked();
        }

        private boolean ensureRuntimeReadinessLocked() {
            if (runtimeReady) {
                return state != null && !state.localPrivacyBarrierFailed && !state.corruptState;
            }
            if (!ensureLoadedLocked()) {
                return false;
            }
            try {
                pruneExpiredLocked(System.currentTimeMillis());
                if (state == null || state.corruptState) {
                    purgeCorruptStateLocked();
                    return false;
                }
                if (state.localPrivacyBarrierFailed) {
                    if (!retryPrivacyBarrierRecoveryLocked()) {
                        return false;
                    }
                } else if (State.hasDurableMutationReceipt(state.mutationPhase, state.mutationReason)
                        && !resumeMutationReceiptRecoveryLocked()) {
                    return false;
                }
                runtimeReady = true;
                return true;
            } catch (GeneralSecurityException | JSONException | IllegalStateException exception) {
                failClosedLocked();
                return false;
            }
        }

        private void invalidateBootstrapSuccessLocked() {
            runtimeReady = false;
            headlessFcmBootstrapSucceeded = false;
        }

        JSObject getOrCreateInstallationId() {
            JSObject result = new JSObject();
            if (!bootstrapLocked() || !ensureLoadedLocked()) {
                result.put("installation_id", JSONObject.NULL);
                return result;
            }
            result.put("installation_id", state.installationId);
            return result;
        }
        JSObject getAccountMutationLineage() {
            State snapshot = state;
            if (snapshot == null) {
                StateLoadResult loaded = stateStore.loadReadOnly();
                if (loaded.kind == StateLoadResult.VALID) {
                    snapshot = loaded.state;
                }
            }
            String displayEpoch = snapshot == null ? null : canonicalUint64(snapshot.displayEpoch);
            boolean available = snapshot != null && displayEpoch != null && !snapshot.corruptState
                    && !State.MUTATION_CORRUPT_FAILURE.equals(snapshot.mutationPhase);
            boolean active = available
                    && State.hasDurableMutationReceipt(snapshot.mutationPhase, snapshot.mutationReason);
            ZeroCounts counts = zeroCountsForStateLocked(available ? snapshot : null);
            JSObject result = new JSObject();
            result.put("available", available);
            result.put("active", active);
            result.put("phase", active
                    ? (State.MUTATION_AWAITING_FINALIZE.equals(snapshot.mutationPhase)
                    ? State.MUTATION_AWAITING_FINALIZE : "completed")
                    : JSONObject.NULL);
            result.put("reason", active ? snapshot.mutationReason : JSONObject.NULL);
            result.put("display_epoch", displayEpoch == null ? "0" : displayEpoch);
            result.put("zero_counts", counts.toJson());
            return result;
        }


        JSObject initialize(JSObject input) {
            if (!bootstrapLocked()) {
                clearReleaseTrustAndCancelWorkLocked();
                return operationResult(false);
            }
            String apiOrigin = validatedApiOrigin(input);
            if (apiOrigin == null) {
                clearReleaseTrustAndCancelWorkLocked();
                return operationResult(false);
            }
            releaseValidated = true;
            validatedApiOrigin = apiOrigin;
            reconcileCurrentFcmToken();
            emitQueuedEventsLocked();
            boolean initialized = !state.localPrivacyBarrierFailed && !state.corruptState;
            if (!initialized) {
                clearReleaseTrustAndCancelWorkLocked();
            }
            return operationResult(initialized);
        }

        JSObject bindSession(JSObject input) {
            if (!bootstrapLocked()) {
                return operationResult(false);
            }
            String sessionId = input == null ? null : input.optString("session_id", null);
            String authVersion = input == null ? null : canonicalPositiveIntegerString(input.optString("auth_version", null));
            String bindingGeneration = input == null ? null : positiveJsSafeInteger(input.opt("binding_generation"));
            String tokenGeneration = input == null ? null : positiveJsSafeInteger(input.opt("token_generation"));
            String bearer = input == null ? null : authorizationBearer(input.opt("authorization_bearer"));
            boolean reestablishingDormantBound = isPersistedAdmissionOpenLocked()
                    && activeSessionId == null && authorizationBearer == null;
            boolean closedForBinding = State.ADMISSION_CLOSED.equals(state.admission)
                    && (State.MUTATION_UNBOUND.equals(state.mutationPhase)
                    || State.MUTATION_READY_FOR_RELOGIN.equals(state.mutationPhase)
                    || State.MUTATION_READY_FOR_REBIND.equals(state.mutationPhase)
                    || State.MUTATION_DORMANT_REBIND.equals(state.mutationPhase)
                    || State.MUTATION_TERMINAL.equals(state.mutationPhase));
            if (input == null || !hasExactKeys(input,
                    "session_id", "auth_version", "binding_generation", "token_generation", "authorization_bearer")
                    || !isUuid(sessionId) || authVersion == null || bindingGeneration == null || tokenGeneration == null
                    || bearer == null || !releaseValidated || validatedApiOrigin == null || state.localPrivacyBarrierFailed
                    || state.corruptState || !(closedForBinding || reestablishingDormantBound)) {
                return operationResult(false);
            }
            try {
                if (reestablishingDormantBound) {
                    cancelNetworkOperationsLocked();
                    State closing = state.copy();
                    closing.displayEpoch = incrementEpoch(closing.displayEpoch);
                    closing.admission = State.ADMISSION_CLOSING;
                    closing.sessionMarker = null;
                    closing.mutationPhase = State.MUTATION_DORMANT_REBIND;
                    closing.mutationReason = null;
                    closing.nextLaunchPurge = true;
                    persist(closing);
                    if (!purgeAndCloseLocked(closing, State.MUTATION_DORMANT_REBIND, null)) {
                        return operationResult(false);
                    }
                }
                State next = state.copy();
                next.displayEpoch = incrementEpoch(next.displayEpoch);
                next.admission = State.ADMISSION_OPEN;
                next.mutationPhase = State.MUTATION_BOUND;
                next.mutationReason = null;
                next.sessionMarker = stateStore.sessionMarker(sessionId);
                next.bindingGeneration = bindingGeneration;
                next.tokenGeneration = tokenGeneration;
                next.nextLaunchPurge = false;
                next.handoffs.clear();
                persist(next);
                activeSessionId = sessionId;
                authorizationBearer = bearer;
                if (!releaseColdPayloadAfterVerifiedRebindLocked()) {
                    return operationResult(false);
                }
                emitQueuedEventsLocked();
                return operationResult(true);
            } catch (GeneralSecurityException | JSONException | IllegalStateException exception) {
                clearVolatileSessionLocked();
                failClosedLocked();
                return operationResult(false);
            }
        }

        JSObject updateSessionGenerations(JSObject input) {
            String sessionId = input == null ? null : input.optString("session_id", null);
            String bindingGeneration = input == null ? null : positiveJsSafeInteger(input.opt("binding_generation"));
            String tokenGeneration = input == null ? null : positiveJsSafeInteger(input.opt("token_generation"));
            if (!bootstrapLocked() || input == null
                    || !hasExactKeys(input, "session_id", "binding_generation", "token_generation")
                    || !isUuid(sessionId) || bindingGeneration == null || tokenGeneration == null || !releaseValidated
                    || authorizationBearer == null || !isPersistedAdmissionOpenLocked()
                    || !sessionId.equals(activeSessionId)) {
                return operationResult(false);
            }
            try {
                if (!stateStore.sessionMarker(sessionId).equals(state.sessionMarker)) {
                    return operationResult(false);
                }
                cancelNetworkOperationsLocked();
                State closing = state.copy();
                closing.displayEpoch = incrementEpoch(closing.displayEpoch);
                closing.admission = State.ADMISSION_CLOSING;
                closing.sessionMarker = null;
                closing.mutationPhase = State.MUTATION_DORMANT_REBIND;
                closing.mutationReason = null;
                closing.bindingGeneration = bindingGeneration;
                closing.tokenGeneration = tokenGeneration;
                closing.nextLaunchPurge = true;
                persist(closing);
                if (!purgeAndCloseLocked(closing, State.MUTATION_DORMANT_REBIND, null)) {
                    return operationResult(false);
                }
                State rebound = state.copy();
                rebound.admission = State.ADMISSION_OPEN;
                rebound.mutationPhase = State.MUTATION_BOUND;
                rebound.sessionMarker = stateStore.sessionMarker(sessionId);
                rebound.bindingGeneration = bindingGeneration;
                rebound.tokenGeneration = tokenGeneration;
                rebound.nextLaunchPurge = false;
                persist(rebound);
                activeSessionId = sessionId;
                if (!releaseColdPayloadAfterVerifiedRebindLocked()) {
                    return operationResult(false);
                }
                return operationResult(true);
            } catch (GeneralSecurityException | JSONException | IllegalStateException exception) {
                clearAuthorizationBearerLocked();
                failClosedLocked();
                return operationResult(false);
            }
        }

        JSObject beginDisplayAuthorization(JSObject input) {
            JSObject result = new JSObject();
            result.put("admitted", false);
            DataOnlyPayload payload = input == null || !hasExactKeys(input, "delivery_id", "notice_id")
                    ? null : DataOnlyPayload.from(input);
            if (!bootstrapLocked() || payload == null || !releaseValidated || !isDisplayAdmittedLocked()) {
                return result;
            }
            try {
                pruneExpiredLocked(System.currentTimeMillis());
                Handoff handoff = state.handoffs.get(payload.deliveryId);
                if (handoff == null || !payload.noticeId.equals(handoff.noticeId)
                        || !state.displayEpoch.equals(handoff.displayEpoch)
                        || state.operations.size() >= MAX_PENDING_OPERATIONS) {
                    return result;
                }
                State next = state.copy();
                next.handoffs.remove(payload.deliveryId);
                Operation operation = Operation.create(
                        Operation.KIND_DISPLAY,
                        payload,
                        next.displayEpoch,
                        next.sessionMarker,
                        next.bindingGeneration,
                        next.tokenGeneration
                );
                next.operations.put(operation.operationId, operation);
                persist(next);
                result.put("admitted", true);
                addOperationIdentity(result, operation);
            } catch (GeneralSecurityException | JSONException | IllegalStateException exception) {
                failClosedLocked();
            }
            return result;
        }

        void scheduleAuthorizedNotification(JSObject input, OperationResultContinuation continuation) {
            if (!bootstrapLocked() || !releaseValidated || input == null || !hasExactKeys(input, "operation_id")) {
                continuation.complete(operationResult(false));
                return;
            }
            String operationId = opaqueId(input.opt("operation_id"));
            if (operationId == null) {
                continuation.complete(operationResult(false));
                return;
            }
            boolean pending = false;
            try {
                pruneExpiredLocked(System.currentTimeMillis());
                Operation operation = state.operations.get(operationId);
                if (operation == null || !Operation.KIND_DISPLAY.equals(operation.kind)
                        || networkOperations.containsKey(operationId)
                        || pendingOperationContinuations.containsKey(operationId)
                        || pendingOperationContinuations.size() >= MAX_PENDING_OPERATIONS) {
                    continuation.complete(operationResult(false));
                    return;
                }
                if (!isDisplayAdmittedLocked() || !operationMatchesCurrentState(operation)
                        || state.registry.size() >= MAX_NOTIFICATION_REGISTRY) {
                    discardOperationLocked(operation);
                    continuation.complete(operationResult(false));
                    return;
                }
                NetworkAuthorizationRequest request = NetworkAuthorizationRequest.capture(
                        operation,
                        state.installationId,
                        validatedApiOrigin,
                        activeSessionId,
                        authorizationBearer
                );
                if (request == null) {
                    discardOperationLocked(operation);
                    continuation.complete(operationResult(false));
                    return;
                }
                pendingOperationContinuations.put(operationId, continuation);
                pending = true;
                if (!startAuthorizationNetworkLocked(request)) {
                    discardOperationLocked(operation);
                }
            } catch (GeneralSecurityException | JSONException | RuntimeException exception) {
                failClosedLocked();
                if (!pending) {
                    continuation.complete(operationResult(false));
                }
            }
        }

        JSObject abortAuthorization(JSObject input, String kind) {
            String operationId = input == null ? null : opaqueId(input.opt("operation_id"));
            String reason = input == null ? null : abortReason(input.opt("reason"));
            if (!bootstrapLocked() || input == null || !hasExactKeys(input, "operation_id", "reason")
                    || operationId == null || reason == null) {
                return operationResult(false);
            }
            try {
                Operation operation = state.operations.get(operationId);
                if (operation == null || !kind.equals(operation.kind)) {
                    return operationResult(false);
                }
                State next = state.copy();
                next.operations.remove(operationId);
                CancellableNetworkOperation networkOperation = networkOperations.remove(operationId);
                if (networkOperation != null) {
                    networkOperation.cancel();
                }
                if (Operation.KIND_TAP.equals(kind)) {
                    RegistryEntry entry = next.registry.remove(operation.deliveryId);
                    next.pendingTaps.remove(operation.deliveryId);
                    if (entry != null) {
                        notificationManager.cancel(entry.notificationId);
                    }
                }
                persist(next);
                resolvePendingOperationContinuationLocked(operationId, false);
                return operationResult(true);
            } catch (GeneralSecurityException | JSONException | SecurityException | IllegalStateException exception) {
                failClosedLocked();
                return operationResult(false);
            }
        }

        JSObject beginTapAuthorization(JSObject input) {
            JSObject result = new JSObject();
            result.put("admitted", false);
            DataOnlyPayload payload = input == null || !hasExactKeys(input,
                    "delivery_id", "notice_id", "display_epoch")
                    ? null
                    : DataOnlyPayload.fromValues(
                            input.optString("delivery_id", null),
                            input.optString("notice_id", null)
                    );
            String tappedEpoch = input == null ? null : canonicalUint64(input.opt("display_epoch"));
            if (!bootstrapLocked() || payload == null || tappedEpoch == null || !releaseValidated
                    || !isDisplayAdmittedLocked()) {
                return result;
            }
            try {
                pruneExpiredLocked(System.currentTimeMillis());
                PendingTap pendingTap = state.pendingTaps.get(payload.deliveryId);
                RegistryEntry entry = state.registry.get(payload.deliveryId);
                if (pendingTap == null || entry == null || !payload.noticeId.equals(pendingTap.noticeId)
                        || !payload.noticeId.equals(entry.noticeId) || !tappedEpoch.equals(pendingTap.displayEpoch)
                        || !tappedEpoch.equals(entry.displayEpoch) || !state.displayEpoch.equals(tappedEpoch)
                        || state.operations.size() >= MAX_PENDING_OPERATIONS) {
                    removeDeniedTapLocked(payload.deliveryId);
                    return result;
                }
                State next = state.copy();
                next.pendingTaps.remove(payload.deliveryId);
                Operation operation = Operation.create(
                        Operation.KIND_TAP,
                        payload,
                        tappedEpoch,
                        next.sessionMarker,
                        next.bindingGeneration,
                        next.tokenGeneration
                );
                next.operations.put(operation.operationId, operation);
                persist(next);
                result.put("admitted", true);
                addOperationIdentity(result, operation);
            } catch (GeneralSecurityException | JSONException | IllegalStateException exception) {
                failClosedLocked();
            }
            return result;
        }

        void completeTapAuthorization(JSObject input, OperationResultContinuation continuation) {
            if (!bootstrapLocked() || !releaseValidated || input == null || !hasExactKeys(input, "operation_id")) {
                continuation.complete(operationResult(false));
                return;
            }
            String operationId = opaqueId(input.opt("operation_id"));
            if (operationId == null) {
                continuation.complete(operationResult(false));
                return;
            }
            boolean pending = false;
            try {
                pruneExpiredLocked(System.currentTimeMillis());
                Operation operation = state.operations.get(operationId);
                RegistryEntry entry = operation == null ? null : state.registry.get(operation.deliveryId);
                if (operation == null || !Operation.KIND_TAP.equals(operation.kind) || entry == null
                        || !entry.matches(operation.noticeId, operation.displayEpoch)
                        || networkOperations.containsKey(operationId)
                        || pendingOperationContinuations.containsKey(operationId)
                        || pendingOperationContinuations.size() >= MAX_PENDING_OPERATIONS) {
                    continuation.complete(operationResult(false));
                    return;
                }
                if (!isDisplayAdmittedLocked() || !operationMatchesCurrentState(operation)) {
                    discardOperationLocked(operation);
                    continuation.complete(operationResult(false));
                    return;
                }
                NetworkAuthorizationRequest request = NetworkAuthorizationRequest.capture(
                        operation,
                        state.installationId,
                        validatedApiOrigin,
                        activeSessionId,
                        authorizationBearer
                );
                if (request == null) {
                    discardOperationLocked(operation);
                    continuation.complete(operationResult(false));
                    return;
                }
                pendingOperationContinuations.put(operationId, continuation);
                pending = true;
                if (!startAuthorizationNetworkLocked(request)) {
                    discardOperationLocked(operation);
                }
            } catch (GeneralSecurityException | JSONException | RuntimeException exception) {
                failClosedLocked();
                if (!pending) {
                    continuation.complete(operationResult(false));
                }
            }
        }

        JSObject beginAccountMutation(JSObject input) {
            String reason = input == null ? null : mutationReason(input.opt("reason"));
            if (!bootstrapLocked() || input == null || !hasExactKeys(input, "reason") || reason == null) {
                return mutationResult(false);
            }
            clearColdPayloadQuarantineLocked();
            clearVolatileSessionLocked();
            try {
                if (State.isCompletedMutationPhase(state.mutationPhase)) {
                    return mutationResult(reason.equals(state.mutationReason) && zeroCountsLocked().isZero());
                }
                if (State.MUTATION_AWAITING_FINALIZE.equals(state.mutationPhase)) {
                    return mutationResult(reason.equals(state.mutationReason) && zeroCountsLocked().isZero());
                }
                if (State.MUTATION_TERMINAL.equals(state.mutationPhase)
                        || State.MUTATION_CORRUPT_FAILURE.equals(state.mutationPhase)
                        || state.localPrivacyBarrierFailed) {
                    return mutationResult(false);
                }
                cancelNetworkOperationsLocked();
                State closing = state.copy();
                closing.displayEpoch = incrementEpoch(closing.displayEpoch);
                closing.admission = State.ADMISSION_CLOSING;
                closing.sessionMarker = null;
                closing.mutationPhase = State.MUTATION_AWAITING_FINALIZE;
                closing.mutationReason = reason;
                closing.nextLaunchPurge = true;
                persist(closing);
                return mutationResult(purgeAndCloseLocked(closing, State.MUTATION_AWAITING_FINALIZE, reason));
            } catch (GeneralSecurityException | JSONException | IllegalStateException exception) {
                failClosedLocked();
                return mutationResult(false);
            }
        }

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
        private boolean ownsFinalizableMutationReceipt(State candidate, String reason, String displayEpoch) {
            return candidate != null
                    && (State.ADMISSION_CLOSED.equals(candidate.admission)
                    || State.ADMISSION_CLOSING.equals(candidate.admission))
                    && State.hasDurableMutationReceipt(candidate.mutationPhase, candidate.mutationReason)
                    && reason.equals(candidate.mutationReason)
                    && displayEpoch.equals(candidate.displayEpoch)
                    && !candidate.localPrivacyBarrierFailed && !candidate.corruptState;
        }

        void receiveDataOnlyPush(Map<String, String> data) {
            DataOnlyPayload payload = DataOnlyPayload.from(data);
            if (payload == null) {
                return;
            }
            execute(() -> {
                if (!uiColdLaunchReconciled && plugin.get() == null) {
                    quarantineColdPayloadLocked(payload, QuarantinedPayload.KIND_DATA_ONLY);
                    headlessFcmBootstrapLocked();
                    return;
                }
                if (!bootstrapLocked()) {
                    return;
                }
                if (isDormantRecoveryStateLocked()) {
                    quarantineColdPayloadLocked(payload, QuarantinedPayload.KIND_DATA_ONLY);
                    return;
                }
                if (!isPersistedAdmissionOpenLocked()) {
                    return;
                }
                try {
                    pruneExpiredLocked(System.currentTimeMillis());
                    if (state.registry.containsKey(payload.deliveryId) || state.operationsContainsDelivery(payload.deliveryId)
                            || state.handoffs.containsKey(payload.deliveryId)) {
                        return;
                    }
                    State next = state.copy();
                    while (next.handoffs.size() >= MAX_PENDING_HANDOFFS) {
                        String evictedDeliveryId = oldestHandoffKey(next.handoffs);
                        if (evictedDeliveryId == null) {
                            break;
                        }
                        next.handoffs.remove(evictedDeliveryId);
                    }
                    next.handoffs.put(payload.deliveryId, new Handoff(
                            payload.noticeId,
                            next.displayEpoch,
                            System.currentTimeMillis() + HANDOFF_TTL_MILLIS
                    ));
                    persist(next);
                    if (releaseValidated && plugin.get() != null) {
                        emitDataOnlyPayload(payload);
                    } else if (plugin.get() == null) {
                        discardColdHandoffLocked(payload.deliveryId);
                    }
                } catch (GeneralSecurityException | JSONException | IllegalStateException exception) {
                    failClosedLocked();
                }
            });
        }

        void receiveFcmToken(String token) {
            if (!isFcmToken(token)) {
                return;
            }
            execute(() -> {
                if (!bootstrapLocked()) {
                    return;
                }
                try {
                    State next = state.copy();
                    next.pendingFcmToken = token;
                    persist(next);
                    if (releaseValidated) {
                        emitFcmToken(token);
                    }
                } catch (GeneralSecurityException | JSONException | IllegalStateException exception) {
                    failClosedLocked();
                }
            });
        }

        void quarantineColdNotificationTap(Intent intent) {
            if (!isStrictNotificationTapIntent(intent)) {
                return;
            }
            DataOnlyPayload payload = DataOnlyPayload.fromValues(
                    intent.getStringExtra(EXTRA_DELIVERY_ID),
                    intent.getStringExtra(EXTRA_NOTICE_ID)
            );
            String epoch = canonicalUint64(intent.getStringExtra(EXTRA_DISPLAY_EPOCH));
            if (payload == null || epoch == null) {
                return;
            }
            execute(() -> {
                if (uiColdLaunchReconciled) {
                    captureNotificationTapLocked(payload, epoch);
                } else {
                    quarantineColdPayloadLocked(payload, QuarantinedPayload.KIND_TAP);
                }
            });
        }

        void handleNotificationTap(Intent intent) {
            if (!isStrictNotificationTapIntent(intent)) {
                return;
            }
            DataOnlyPayload payload = DataOnlyPayload.fromValues(
                    intent.getStringExtra(EXTRA_DELIVERY_ID),
                    intent.getStringExtra(EXTRA_NOTICE_ID)
            );
            String epoch = canonicalUint64(intent.getStringExtra(EXTRA_DISPLAY_EPOCH));
            if (payload == null || epoch == null) {
                return;
            }
            execute(() -> captureNotificationTapLocked(payload, epoch));
        }

        private boolean isStrictNotificationTapIntent(Intent intent) {
            if (intent == null || !ACTION_NOTIFICATION_TAP.equals(intent.getAction())
                    || intent.getData() != null || intent.getType() != null
                    || (intent.getCategories() != null && !intent.getCategories().isEmpty())) {
                return false;
            }
            try {
                Bundle extras = intent.getExtras();
                return extras != null && extras.size() == 3
                        && extras.keySet().contains(EXTRA_DELIVERY_ID)
                        && extras.keySet().contains(EXTRA_NOTICE_ID)
                        && extras.keySet().contains(EXTRA_DISPLAY_EPOCH)
                        && extras.get(EXTRA_DELIVERY_ID) instanceof String
                        && extras.get(EXTRA_NOTICE_ID) instanceof String
                        && extras.get(EXTRA_DISPLAY_EPOCH) instanceof String;
            } catch (RuntimeException exception) {
                return false;
            }
        }
        private void captureNotificationTapLocked(DataOnlyPayload payload, String epoch) {
            if (!bootstrapLocked()) {
                return;
            }
            try {
                RegistryEntry entry = state.registry.get(payload.deliveryId);
                if (!isPersistedAdmissionOpenLocked() || entry == null || !entry.matches(payload.noticeId, epoch)
                        || !state.displayEpoch.equals(epoch) || state.pendingTaps.size() >= MAX_PENDING_TAPS) {
                    removeDeniedTapLocked(payload.deliveryId);
                    return;
                }
                State next = state.copy();
                next.pendingTaps.put(payload.deliveryId, new PendingTap(
                        payload.noticeId,
                        epoch,
                        System.currentTimeMillis() + TAP_TTL_MILLIS
                ));
                persist(next);
                if (releaseValidated) {
                    emitTap(payload, epoch);
                }
            } catch (GeneralSecurityException | JSONException | IllegalStateException exception) {
                failClosedLocked();
            }
        }

        boolean credentialsAvailable() {
            // Availability proves only that the non-secret recovery marker can be reached.
            // Per-key phase checks continue to protect refresh, session, and transient credentials.
            return ensureLoadedLocked() && stateStore.markerStorageAvailable();
        }
        String loadCredential(String key) throws GeneralSecurityException {
            if (isRecoveryCredential(key)) {
                if (!ensureLoadedLocked()) {
                    throw new GeneralSecurityException("Secure privacy recovery marker is unavailable.");
                }
                return stateStore.loadCredential(key);
            }
            if (!bootstrapLocked()) {
                throw new GeneralSecurityException("Secure credentials cannot be read in the current coordinator phase.");
            }
            if (hasVerifiedCredentialAbsenceLocked(key)) {
                if (stateStore.loadCredential(key) == null) {
                    return null;
                }
                throw new GeneralSecurityException("Completed mutation retained a secure credential.");
            }
            if (!canReadCredentialLocked(key)) {
                throw new GeneralSecurityException("Secure credentials cannot be read in the current coordinator phase.");
            }
            return stateStore.loadCredential(key);
        }
        void saveCredential(String key, String value) throws GeneralSecurityException {
            if (isRecoveryCredential(key)) {
                if (!ensureLoadedLocked()) {
                    throw new GeneralSecurityException("Secure privacy recovery marker is unavailable.");
                }
                stateStore.saveCredential(key, value);
                return;
            }
            if (!bootstrapLocked() || !canWriteCredentialLocked(key)) {
                throw new GeneralSecurityException("Secure credentials cannot be written in the current coordinator phase.");
            }
            stateStore.saveCredential(key, value);
        }
        void deleteCredential(String key) throws GeneralSecurityException {
            if (isRecoveryCredential(key)) {
                if (!ensureLoadedLocked()) {
                    throw new GeneralSecurityException("Secure privacy recovery marker is unavailable.");
                }
                stateStore.removeCredential(key);
                return;
            }
            if (!bootstrapLocked()) {
                throw new GeneralSecurityException("Secure credentials cannot be deleted in the current coordinator phase.");
            }
            if (State.MUTATION_TERMINAL.equals(state.mutationPhase)) {
                if (isDeletionLifecycleCredential(key)) {
                    stateStore.removeCredential(key);
                    return;
                }
                if (isTransientCredential(key)) {
                    stateStore.removeCredential(key);
                    return;
                }
                if (isRefreshOrSessionCredential(key)) {
                    if (stateStore.loadCredential(key) != null) {
                        throw new GeneralSecurityException("Completed mutation retained a secure credential.");
                    }
                    return;
                }
            }
            if (!canDeleteCredentialLocked(key)) {
                throw new GeneralSecurityException("Secure credentials cannot be deleted in the current coordinator phase.");
            }
            stateStore.removeCredential(key);
        }

        private boolean credentialPhaseAvailableLocked() {
            return state != null && !state.localPrivacyBarrierFailed && !state.corruptState
                    && !State.MUTATION_CORRUPT_FAILURE.equals(state.mutationPhase);
        }

        private boolean canReadCredentialLocked(String key) {
            if (!credentialPhaseAvailableLocked() || secureCredentialKey(key) == null) {
                return false;
            }
            if (isDeletionLifecycleCredential(key)) {
                return true;
            }
            if (State.MUTATION_BOUND.equals(state.mutationPhase)
                    || State.MUTATION_AWAITING_FINALIZE.equals(state.mutationPhase)
                    || State.MUTATION_DORMANT_REBIND.equals(state.mutationPhase)) {
                return isRefreshOrSessionCredential(key);
            }
            return isTransientCredential(key) && (State.MUTATION_UNBOUND.equals(state.mutationPhase)
                    || State.MUTATION_READY_FOR_RELOGIN.equals(state.mutationPhase)
                    || State.MUTATION_READY_FOR_REBIND.equals(state.mutationPhase)
                    || State.MUTATION_TERMINAL.equals(state.mutationPhase));
        }

        private boolean hasVerifiedCredentialAbsenceLocked(String key) {
            return credentialPhaseAvailableLocked() && isRefreshOrSessionCredential(key)
                    && (State.MUTATION_UNBOUND.equals(state.mutationPhase)
                    || State.isCompletedMutationPhase(state.mutationPhase));
        }

        private boolean canWriteCredentialLocked(String key) {
            if (!credentialPhaseAvailableLocked() || secureCredentialKey(key) == null) {
                return false;
            }
            if (isDeletionLifecycleCredential(key)) {
                return true;
            }
            if (State.MUTATION_BOUND.equals(state.mutationPhase)) {
                return isRefreshOrSessionCredential(key) || isPrivacyBarrierCredential(key);
            }
            if (State.MUTATION_AWAITING_FINALIZE.equals(state.mutationPhase)) {
                return isPrivacyBarrierCredential(key);
            }
            if (State.MUTATION_READY_FOR_REBIND.equals(state.mutationPhase)
                    || State.MUTATION_TERMINAL.equals(state.mutationPhase)) {
                return isTransientCredential(key) || isPrivacyBarrierCredential(key);
            }
            return (isTransientCredential(key) || isPrivacyBarrierCredential(key))
                    && (State.MUTATION_UNBOUND.equals(state.mutationPhase)
                    || State.MUTATION_READY_FOR_RELOGIN.equals(state.mutationPhase));
        }

        private boolean canDeleteCredentialLocked(String key) {
            if (!credentialPhaseAvailableLocked() || secureCredentialKey(key) == null) {
                return false;
            }
            if (isDeletionLifecycleCredential(key)) {
                return true;
            }
            if (State.MUTATION_BOUND.equals(state.mutationPhase)) {
                return true;
            }
            if (State.MUTATION_AWAITING_FINALIZE.equals(state.mutationPhase)) {
                return isPrivacyBarrierCredential(key);
            }
            return State.MUTATION_UNBOUND.equals(state.mutationPhase)
                    || State.MUTATION_READY_FOR_RELOGIN.equals(state.mutationPhase)
                    || State.MUTATION_READY_FOR_REBIND.equals(state.mutationPhase);
        }

        private static boolean isTransientCredential(String key) {
            return "zerotime.native-auth.transient.v1".equals(key);
        }

        private static boolean isRefreshOrSessionCredential(String key) {
            return "zerotime.native-auth.refresh.v1".equals(key)
                    || "zerotime.native-auth.session.v1".equals(key);
        }

        private static boolean isPrivacyBarrierCredential(String key) {
            return "zerotime.native-auth.privacy-barrier-failed.v1".equals(key);
        }
        private static boolean isCorruptSessionAuditCredential(String key) {
            return "zerotime.native-auth.corrupt-session-audit.v1".equals(key);
        }

        private static boolean isDeletionLifecycleCredential(String key) {
            return "zerotime.account-deletion.status.v1".equals(key)
                    || "zerotime.account-deletion.operation.v1".equals(key)
                    || "zerotime.account-deletion.operation.audit.v1".equals(key)
                    || "zerotime.account-deletion.native-reauth-handoff.v1".equals(key);
        }

        private static boolean isRecoveryCredential(String key) {
            return isPrivacyBarrierCredential(key) || isCorruptSessionAuditCredential(key);
        }

        String displayPermission() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                    && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                return "denied";
            }
            if (notificationManager == null || !notificationManager.areNotificationsEnabled()) {
                return "denied";
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel channel = notificationManager.getNotificationChannel(CHANNEL_ID);
                if (channel == null || channel.getImportance() == NotificationManager.IMPORTANCE_NONE) {
                    return "denied";
                }
            }
            return "granted";
        }

        JSObject operationResult(boolean success) {
            JSObject result = new JSObject();
            String bindingGeneration = state == null ? null : storedPositiveJsSafeInteger(state.bindingGeneration);
            String tokenGeneration = state == null ? null : storedNonNegativeJsSafeInteger(state.tokenGeneration);
            result.put("success", success);
            result.put("installation_id", state == null ? JSONObject.NULL : state.installationId);
            result.put("session_id", activeSessionId == null ? JSONObject.NULL : activeSessionId);
            if (bindingGeneration == null || tokenGeneration == null) {
                result.put("binding_generation", JSONObject.NULL);
                result.put("token_generation", JSONObject.NULL);
            } else {
                result.put("binding_generation", Long.parseLong(bindingGeneration));
                result.put("token_generation", Long.parseLong(tokenGeneration));
            }
            result.put("display_epoch", state == null ? "0" : state.displayEpoch);
            return result;
        }

        private JSObject mutationResult(boolean success) {
            JSObject result = new JSObject();
            result.put("success", success);
            result.put("display_epoch", state == null ? "0" : state.displayEpoch);
            ZeroCounts counts = zeroCountsLocked();
            result.put("zero_counts", counts.toJson());
            return result;
        }


        private boolean reconcileLoadedStateLocked() throws GeneralSecurityException, JSONException {
            if (state == null || state.corruptState) {
                purgeCorruptStateLocked();
                return false;
            }
            if (state.localPrivacyBarrierFailed) {
                return retryPrivacyBarrierRecoveryLocked();
            }
            cancelNetworkOperationsLocked();
            clearVolatileSessionLocked();
            if (State.hasDurableMutationReceipt(state.mutationPhase, state.mutationReason)) {
                return resumeMutationReceiptRecoveryLocked();
            }
            State closing = state.copy();
            closing.displayEpoch = incrementEpoch(closing.displayEpoch);
            closing.admission = State.ADMISSION_CLOSING;
            closing.sessionMarker = null;
            if (State.MUTATION_BOUND.equals(closing.mutationPhase)) {
                closing.mutationPhase = State.MUTATION_DORMANT_REBIND;
                closing.mutationReason = null;
            }
            closing.nextLaunchPurge = true;
            persist(closing);
            if (!purgeAndCloseLocked(closing, closing.mutationPhase, closing.mutationReason)) {
                return false;
            }
            return state != null && State.ADMISSION_CLOSED.equals(state.admission)
                    && !state.nextLaunchPurge && !state.localPrivacyBarrierFailed && !state.corruptState
                    && zeroCountsLocked().isZero();
        }

        private boolean resumeMutationReceiptRecoveryLocked() throws GeneralSecurityException, JSONException {
            if (state == null || !State.hasDurableMutationReceipt(state.mutationPhase, state.mutationReason)) {
                return false;
            }
            String mutationPhase = state.mutationPhase;
            String mutationReason = state.mutationReason;
            String displayEpoch = state.displayEpoch;
            State closing = state.copy();
            closing.admission = State.ADMISSION_CLOSING;
            closing.sessionMarker = null;
            closing.nextLaunchPurge = true;
            persist(closing);
            if (State.isCompletedMutationPhase(mutationPhase)) {
                stateStore.wipeAuthenticationCredentials();
            }
            if (!purgeAndCloseLocked(closing, mutationPhase, mutationReason)) {
                return false;
            }
            return state != null && State.ADMISSION_CLOSED.equals(state.admission)
                    && !state.nextLaunchPurge && !state.localPrivacyBarrierFailed && !state.corruptState
                    && mutationPhase.equals(state.mutationPhase) && mutationReason.equals(state.mutationReason)
                    && displayEpoch.equals(state.displayEpoch) && zeroCountsLocked().isZero();
        }

        private boolean retryPrivacyBarrierRecoveryLocked() throws GeneralSecurityException, JSONException {
            if (state == null || state.corruptState || !state.localPrivacyBarrierFailed) {
                return false;
            }
            cancelNetworkOperationsLocked();
            clearVolatileSessionLocked();
            if (State.hasDurableMutationReceipt(state.mutationPhase, state.mutationReason)) {
                return resumeMutationReceiptRecoveryLocked();
            }
            String mutationPhase = state.mutationPhase;
            String mutationReason = state.mutationReason;
            if (State.MUTATION_BOUND.equals(mutationPhase)) {
                mutationPhase = State.MUTATION_DORMANT_REBIND;
                mutationReason = null;
            }
            String displayEpoch = state.displayEpoch;
            State closing = state.copy();
            closing.admission = State.ADMISSION_CLOSING;
            closing.sessionMarker = null;
            closing.mutationPhase = mutationPhase;
            closing.mutationReason = mutationReason;
            closing.nextLaunchPurge = true;
            persist(closing);
            if (!purgeAndCloseLocked(closing, mutationPhase, mutationReason)) {
                return false;
            }
            return state != null && State.ADMISSION_CLOSED.equals(state.admission)
                    && !state.nextLaunchPurge && !state.localPrivacyBarrierFailed && !state.corruptState
                    && mutationPhase.equals(state.mutationPhase)
                    && (mutationReason == null ? state.mutationReason == null
                    : mutationReason.equals(state.mutationReason))
                    && displayEpoch.equals(state.displayEpoch) && zeroCountsLocked().isZero();
        }
        private boolean allAllowlistedCredentialsAbsentLocked() {
            try {
                return stateStore.loadCredential("zerotime.native-auth.refresh.v1") == null
                        && stateStore.loadCredential("zerotime.native-auth.session.v1") == null
                        && stateStore.loadCredential("zerotime.native-auth.transient.v1") == null
                        && stateStore.loadCredential("zerotime.native-auth.privacy-barrier-failed.v1") == null
                        && stateStore.loadCredential("zerotime.native-auth.corrupt-session-audit.v1") == null
                        && stateStore.loadCredential("zerotime.account-deletion.status.v1") == null
                        && stateStore.loadCredential("zerotime.account-deletion.operation.v1") == null
                        && stateStore.loadCredential("zerotime.account-deletion.operation.audit.v1") == null
                        && stateStore.loadCredential("zerotime.account-deletion.native-reauth-handoff.v1") == null;
            } catch (GeneralSecurityException | RuntimeException exception) {
                return false;
            }
        }


        private boolean ensureLoadedLocked() {
            if (state != null) {
                return true;
            }
            StateLoadResult loaded = stateStore.load();
            try {
                if (loaded.kind == StateLoadResult.MISSING && allAllowlistedCredentialsAbsentLocked()) {
                    State initial = State.initial(UUID.randomUUID().toString());
                    persist(initial);
                    return true;
                }
                if (loaded.kind == StateLoadResult.VALID) {
                    state = loaded.state;
                    return true;
                }
                State recovered = State.corruptRecovery(UUID.randomUUID().toString());
                persist(recovered);
                purgeCorruptStateLocked();
                return true;
            } catch (GeneralSecurityException | JSONException exception) {
                state = null;
                return false;
            }
        }

        private void purgeCorruptStateLocked() {
            if (state == null) {
                return;
            }
            try {
                cancelAndVerifyPlatformLocked(state);
                State failed = state.copy();
                failed.admission = State.ADMISSION_CLOSED;
                failed.sessionMarker = null;
                failed.handoffs.clear();
                failed.pendingTaps.clear();
                failed.operations.clear();
                failed.registry.clear();
                failed.usedReceipts.clear();
                failed.foregroundBannerCount = 0;
                failed.nextLaunchPurge = true;
                failed.localPrivacyBarrierFailed = true;
                failed.corruptState = true;
                failed.mutationPhase = State.MUTATION_CORRUPT_FAILURE;
                persist(failed);
            } catch (GeneralSecurityException | JSONException exception) {
                state = null;
            }
        }

        private String validatedApiOrigin(JSObject input) {
            if (!validateReleaseManifest(input)) {
                return null;
            }
            JSONObject manifest = input.optJSONObject("release_manifest");
            String origin = manifest == null ? null : boundedString(manifest.opt("api_origin"), 256);
            if (origin == null || !origin.equals(BuildConfig.MOBILE_RELEASE_API_ORIGIN) || !isHttpsOrigin(origin)) {
                return null;
            }
            return origin;
        }

        private boolean validateReleaseManifest(JSObject input) {
            if (input == null || input.length() != 2
                    || !COORDINATOR_CONTRACT.equals(input.optString("coordinator_contract", null))) {
                return false;
            }
            JSONObject manifest = input.optJSONObject("release_manifest");
            if (manifest == null) {
                return false;
            }
            if ("dev".equals(BuildConfig.PUSH_ENVIRONMENT)) {
                return manifest.length() == 14
                        && MOBILE_RELEASE_CONTRACT.equals(manifest.optString("contract", null))
                        && equalsManifestField(manifest, "api_origin", BuildConfig.MOBILE_RELEASE_API_ORIGIN)
                        && "android".equals(manifest.optString("platform", null))
                        && context.getPackageName().equals(manifest.optString("bundle_id", null));
            }
            return manifest.length() == 14
                    && equalsManifestField(manifest, "contract", BuildConfig.MOBILE_RELEASE_CONTRACT)
                    && equalsManifestField(manifest, "contract_sha256", BuildConfig.MOBILE_RELEASE_CONTRACT_SHA256)
                    && equalsManifestField(manifest, "plane", BuildConfig.MOBILE_RELEASE_PLANE)
                    && equalsManifestField(manifest, "frontend_git_sha", BuildConfig.MOBILE_RELEASE_FRONTEND_GIT_SHA)
                    && equalsManifestField(manifest, "backend_git_sha", BuildConfig.MOBILE_RELEASE_BACKEND_GIT_SHA)
                    && equalsManifestField(manifest, "backend_image_digest", BuildConfig.MOBILE_RELEASE_BACKEND_IMAGE_DIGEST)
                    && equalsManifestField(manifest, "backend_deployment_id", BuildConfig.MOBILE_RELEASE_BACKEND_DEPLOYMENT_ID)
                    && equalsManifestField(manifest, "backend_deployed_at_utc", BuildConfig.MOBILE_RELEASE_BACKEND_DEPLOYED_AT_UTC)
                    && equalsManifestField(manifest, "firebase_project_id", BuildConfig.MOBILE_RELEASE_FIREBASE_PROJECT_ID)
                    && equalsManifestField(manifest, "api_origin", BuildConfig.MOBILE_RELEASE_API_ORIGIN)
                    && equalsManifestField(manifest, "platform", "android")
                    && equalsManifestField(manifest, "app_version", BuildConfig.MOBILE_RELEASE_APP_VERSION)
                    && equalsManifestField(manifest, "build_number", BuildConfig.MOBILE_RELEASE_BUILD_NUMBER)
                    && equalsManifestField(manifest, "bundle_id", "kr.zerotime.app")
                    && context.getPackageName().equals("kr.zerotime.app")
                    && BuildConfig.VERSION_NAME.equals(BuildConfig.MOBILE_RELEASE_APP_VERSION)
                    && String.valueOf(BuildConfig.VERSION_CODE).equals(BuildConfig.MOBILE_RELEASE_BUILD_NUMBER);
        }
        private String validatedEmbeddedReleaseApiOrigin() {
            try {
                if (!("beta".equals(BuildConfig.PUSH_ENVIRONMENT) || "prod".equals(BuildConfig.PUSH_ENVIRONMENT))
                        || !MOBILE_RELEASE_CONTRACT.equals(BuildConfig.MOBILE_RELEASE_CONTRACT)
                        || !MOBILE_RELEASE_CONTRACT_SHA256.equals(BuildConfig.MOBILE_RELEASE_CONTRACT_SHA256)
                        || !BuildConfig.PUSH_ENVIRONMENT.equals(BuildConfig.MOBILE_RELEASE_PLANE)
                        || !isNativeReleaseProvenanceField(BuildConfig.MOBILE_RELEASE_FRONTEND_GIT_SHA)
                        || !isNativeReleaseProvenanceField(BuildConfig.MOBILE_RELEASE_BACKEND_GIT_SHA)
                        || !isNativeReleaseProvenanceField(BuildConfig.MOBILE_RELEASE_BACKEND_IMAGE_DIGEST)
                        || !isNativeReleaseProvenanceField(BuildConfig.MOBILE_RELEASE_BACKEND_DEPLOYMENT_ID)
                        || !isNativeReleaseProvenanceField(BuildConfig.MOBILE_RELEASE_BACKEND_DEPLOYED_AT_UTC)
                        || !isNativeReleaseProvenanceField(BuildConfig.MOBILE_RELEASE_FIREBASE_PROJECT_ID)
                        || !isNativeReleaseProvenanceField(BuildConfig.MOBILE_RELEASE_FIREBASE_APP_ID)
                        || !"android".equals(BuildConfig.MOBILE_RELEASE_PLATFORM)
                        || !"kr.zerotime.app".equals(BuildConfig.MOBILE_RELEASE_BUNDLE_ID)
                        || !context.getPackageName().equals(BuildConfig.MOBILE_RELEASE_BUNDLE_ID)
                        || !BuildConfig.VERSION_NAME.equals(BuildConfig.MOBILE_RELEASE_APP_VERSION)
                        || !String.valueOf(BuildConfig.VERSION_CODE).equals(BuildConfig.MOBILE_RELEASE_BUILD_NUMBER)
                        || !isHttpsOrigin(BuildConfig.MOBILE_RELEASE_API_ORIGIN)) {
                    return null;
                }
                String expectedOrigin = "beta".equals(BuildConfig.PUSH_ENVIRONMENT)
                        ? "https://beta-api.zerotime.kr" : "https://api.zerotime.kr";
                if (!expectedOrigin.equals(BuildConfig.MOBILE_RELEASE_API_ORIGIN)) {
                    return null;
                }
                FirebaseApp firebaseApp = FirebaseApp.getInstance();
                if (firebaseApp == null || firebaseApp.getOptions() == null
                        || !BuildConfig.MOBILE_RELEASE_FIREBASE_PROJECT_ID.equals(
                        firebaseApp.getOptions().getProjectId())
                        || !BuildConfig.MOBILE_RELEASE_FIREBASE_APP_ID.equals(
                        firebaseApp.getOptions().getApplicationId())) {
                    return null;
                }
                return BuildConfig.MOBILE_RELEASE_API_ORIGIN;
            } catch (RuntimeException exception) {
                return null;
            }
        }

        private static boolean isNativeReleaseProvenanceField(String value) {
            return value != null && !value.trim().isEmpty() && value.length() <= 256;
        }

        private static boolean isHttpsOrigin(String origin) {
            try {
                URI uri = new URI(origin);
                String path = uri.getRawPath();
                return "https".equals(uri.getScheme()) && uri.getHost() != null && uri.getPort() == -1
                        && uri.getRawUserInfo() == null && (path == null || path.isEmpty())
                        && uri.getRawQuery() == null && uri.getRawFragment() == null && origin.equals(uri.toString());
            } catch (URISyntaxException exception) {
                return false;
            }
        }

        private boolean purgeAndCloseLocked(State closing, String mutationPhase, String mutationReason)
                throws GeneralSecurityException, JSONException {
            if (!cancelAndVerifyPlatformLocked(closing)) {
                markBarrierFailureLocked();
                return false;
            }
            State closed = closing.copy();
            closed.admission = State.ADMISSION_CLOSED;
            closed.sessionMarker = null;
            closed.handoffs.clear();
            closed.pendingTaps.clear();
            closed.operations.clear();
            closed.registry.clear();
            closed.usedReceipts.clear();
            closed.foregroundBannerCount = 0;
            closed.nextLaunchPurge = false;
            closed.localPrivacyBarrierFailed = closing.localPrivacyBarrierFailed;
            closed.mutationPhase = mutationPhase;
            closed.mutationReason = mutationReason;
            persist(closed);
            if (!zeroCountsLocked().isZero()) {
                markBarrierFailureLocked();
                return false;
            }
            if (closed.localPrivacyBarrierFailed) {
                State recovered = closed.copy();
                recovered.localPrivacyBarrierFailed = false;
                persist(recovered);
            }
            return true;
        }

        private boolean cancelAndVerifyPlatformLocked(State target) {
            if (notificationManager == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
                return false;
            }
            try {
                for (Integer id : target.notificationIds()) {
                    notificationManager.cancel(id);
                }
                notificationManager.cancelAll();
                long deadline = System.currentTimeMillis() + PURGE_TIMEOUT_MILLIS;
                do {
                    if (activeZeroTimeNotificationCount() == 0) {
                        return true;
                    }
                    try {
                        Thread.sleep(PURGE_RETRY_MILLIS);
                    } catch (InterruptedException exception) {
                        Thread.currentThread().interrupt();
                        return false;
                    }
                    notificationManager.cancelAll();
                } while (System.currentTimeMillis() < deadline);
                return activeZeroTimeNotificationCount() == 0;
            } catch (SecurityException exception) {
                return false;
            }
        }

        private int activeZeroTimeNotificationCount() {
            if (notificationManager == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
                return Integer.MAX_VALUE;
            }
            try {
                StatusBarNotification[] active = notificationManager.getActiveNotifications();
                return active == null ? Integer.MAX_VALUE : active.length;
            } catch (SecurityException exception) {
                return Integer.MAX_VALUE;
            }
        }

        private ZeroCounts zeroCountsLocked() {
            return zeroCountsForStateLocked(state);
        }

        private ZeroCounts zeroCountsForStateLocked(State source) {
            if (source == null) {
                return new ZeroCounts(0, Integer.MAX_VALUE, 0, 0, 0);
            }
            return new ZeroCounts(
                    source.pendingTaps.size() + source.handoffs.size(),
                    activeZeroTimeNotificationCount(),
                    source.foregroundBannerCount,
                    source.registry.size(),
                    source.operations.size()
            );
        }

        private void compensateAmbiguousPostLocked() {
            if (state == null) {
                return;
            }
            clearVolatileSessionLocked();
            cancelNetworkOperationsLocked();
            try {
                State closing = state.copy();
                closing.admission = State.ADMISSION_CLOSING;
                closing.sessionMarker = null;
                if (State.MUTATION_BOUND.equals(closing.mutationPhase)) {
                    closing.mutationPhase = State.MUTATION_DORMANT_REBIND;
                    closing.mutationReason = null;
                }
                closing.nextLaunchPurge = true;
                if (!closing.displayEpoch.equals(MAX_UINT64.toString())) {
                    closing.displayEpoch = incrementEpoch(closing.displayEpoch);
                } else {
                    closing.localPrivacyBarrierFailed = true;
                }
                persist(closing);
                purgeAndCloseLocked(closing, closing.mutationPhase, closing.mutationReason);
            } catch (GeneralSecurityException | JSONException | IllegalStateException exception) {
                failClosedLocked();
            }
        }

        private void discardOperationLocked(Operation operation) throws GeneralSecurityException, JSONException {
            State next = state.copy();
            next.operations.remove(operation.operationId);
            CancellableNetworkOperation networkOperation = networkOperations.remove(operation.operationId);
            if (networkOperation != null) {
                networkOperation.cancel();
            }
            if (Operation.KIND_TAP.equals(operation.kind)) {
                next.pendingTaps.remove(operation.deliveryId);
                RegistryEntry entry = next.registry.remove(operation.deliveryId);
                if (entry != null) {
                    notificationManager.cancel(entry.notificationId);
                }
            }
            persist(next);
            resolvePendingOperationContinuationLocked(operation.operationId, false);
        }

        private void removeDeniedTapLocked(String deliveryId) {
            try {
                if (state == null) {
                    return;
                }
                State next = state.copy();
                boolean changed = next.pendingTaps.remove(deliveryId) != null;
                RegistryEntry entry = next.registry.remove(deliveryId);
                changed = changed || entry != null;
                List<String> deniedOperationIds = new ArrayList<>();
                Iterator<Map.Entry<String, Operation>> operations = next.operations.entrySet().iterator();
                while (operations.hasNext()) {
                    Operation operation = operations.next().getValue();
                    if (Operation.KIND_TAP.equals(operation.kind) && deliveryId.equals(operation.deliveryId)) {
                        operations.remove();
                        CancellableNetworkOperation networkOperation = networkOperations.remove(operation.operationId);
                        if (networkOperation != null) {
                            networkOperation.cancel();
                        }
                        deniedOperationIds.add(operation.operationId);
                        changed = true;
                    }
                }
                if (entry != null) {
                    notificationManager.cancel(entry.notificationId);
                }
                if (changed) {
                    persist(next);
                    for (String operationId : deniedOperationIds) {
                        resolvePendingOperationContinuationLocked(operationId, false);
                    }
                }
            } catch (GeneralSecurityException | JSONException | SecurityException | IllegalStateException exception) {
                failClosedLocked();
            }
        }

        private void pruneExpiredLocked(long now) throws GeneralSecurityException, JSONException {
            if (state == null) {
                return;
            }
            State next = state.copy();
            boolean changed = false;
            Iterator<Map.Entry<String, Handoff>> handoffs = next.handoffs.entrySet().iterator();
            while (handoffs.hasNext()) {
                Map.Entry<String, Handoff> entry = handoffs.next();
                if (entry.getValue().expiresAtMillis <= now) {
                    handoffs.remove();
                    changed = true;
                }
            }
            Iterator<Map.Entry<String, PendingTap>> taps = next.pendingTaps.entrySet().iterator();
            while (taps.hasNext()) {
                if (taps.next().getValue().expiresAtMillis <= now) {
                    taps.remove();
                    changed = true;
                }
            }
            Set<String> expiredTapDeliveries = new HashSet<>();
            List<String> expiredOperationIds = new ArrayList<>();
            Iterator<Map.Entry<String, Operation>> operations = next.operations.entrySet().iterator();
            while (operations.hasNext()) {
                Operation operation = operations.next().getValue();
                if (operation.expiresAtMillis <= now) {
                    if (Operation.KIND_TAP.equals(operation.kind)) {
                        expiredTapDeliveries.add(operation.deliveryId);
                    }
                    operations.remove();
                    CancellableNetworkOperation networkOperation = networkOperations.remove(operation.operationId);
                    if (networkOperation != null) {
                        networkOperation.cancel();
                    }
                    expiredOperationIds.add(operation.operationId);
                    changed = true;
                }
            }
            for (String deliveryId : expiredTapDeliveries) {
                RegistryEntry entry = next.registry.remove(deliveryId);
                if (entry != null) {
                    notificationManager.cancel(entry.notificationId);
                }
            }
            Iterator<Map.Entry<String, RegistryEntry>> registry = next.registry.entrySet().iterator();
            while (registry.hasNext()) {
                RegistryEntry entry = registry.next().getValue();
                if (entry.createdAtMillis + REGISTRY_TTL_MILLIS <= now) {
                    notificationManager.cancel(entry.notificationId);
                    registry.remove();
                    changed = true;
                }
            }
            Iterator<Map.Entry<String, UsedReceipt>> receipts = next.usedReceipts.entrySet().iterator();
            while (receipts.hasNext()) {
                if (receipts.next().getValue().expiresAtMillis <= now) {
                    receipts.remove();
                    changed = true;
                }
            }
            if (changed) {
                persist(next);
                for (String operationId : expiredOperationIds) {
                    resolvePendingOperationContinuationLocked(operationId, false);
                }
            }
        }

        private boolean isDisplayAdmittedLocked() {
            return isPersistedAdmissionOpenLocked() && releaseValidated && validatedApiOrigin != null
                    && activeSessionId != null && authorizationBearer != null && "granted".equals(displayPermission());
        }


        private boolean isPersistedAdmissionOpenLocked() {
            return state != null && State.ADMISSION_OPEN.equals(state.admission)
                    && State.MUTATION_BOUND.equals(state.mutationPhase)
                    && state.sessionMarker != null && validSessionMarker(state.sessionMarker)
                    && storedPositiveJsSafeInteger(state.bindingGeneration) != null
                    && storedPositiveJsSafeInteger(state.tokenGeneration) != null
                    && !state.nextLaunchPurge && !state.localPrivacyBarrierFailed && !state.corruptState;
        }

        private boolean operationMatchesCurrentState(Operation operation) {
            return operation != null && isPersistedAdmissionOpenLocked()
                    && state.displayEpoch.equals(operation.displayEpoch)
                    && state.sessionMarker.equals(operation.sessionMarker)
                    && state.bindingGeneration.equals(operation.bindingGeneration)
                    && state.tokenGeneration.equals(operation.tokenGeneration);
        }

        private boolean authorizationRequestMatchesCurrentStateLocked(NetworkAuthorizationRequest request) {
            Operation operation = state == null ? null : state.operations.get(request.operationId);
            return operation != null && operationMatchesCurrentState(operation)
                    && request.operationId.equals(operation.operationId)
                    && authorizationRequestMatchesSchedulingStateLocked(request);
        }

        private boolean authorizationRequestMatchesSchedulingStateLocked(NetworkAuthorizationRequest request) {
            return state != null && isPersistedAdmissionOpenLocked()
                    && request.sessionMarker.equals(state.sessionMarker)
                    && request.sessionId.equals(activeSessionId)
                    && request.authorizationBearer.equals(authorizationBearer)
                    && request.apiOrigin.equals(validatedApiOrigin)
                    && releaseValidated
                    && "granted".equals(displayPermission());
        }

        private boolean receiptMatchesOperation(Receipt receipt, Operation operation, String kind) {
            long now = System.currentTimeMillis();
            return receipt != null && operation != null && kind.equals(operation.kind)
                    && receipt.deliveryId.equals(operation.deliveryId)
                    && receipt.noticeId.equals(operation.noticeId)
                    && receipt.displayEpoch.equals(operation.displayEpoch)
                    && receipt.bindingGeneration.equals(operation.bindingGeneration)
                    && receipt.tokenGeneration.equals(operation.tokenGeneration)
                    && receipt.expiresAtMillis > now
                    && receipt.expiresAtMillis <= operation.expiresAtMillis
                    && operation.expiresAtMillis >= now;
        }

        private boolean startAuthorizationNetworkLocked(NetworkAuthorizationRequest request) {
            if (networkOperations.size() >= MAX_PENDING_OPERATIONS
                    || networkOperations.containsKey(request.operationId)) {
                return false;
            }
            networkOperations.put(request.operationId, request);
            try {
                request.future = networkExecutor.submit(() -> {
                    AuthorizationResponse response = authorizeOperationOverNetwork(request);
                    execute(() -> completeAuthorizationNetworkLocked(request, response));
                });
                return true;
            } catch (RejectedExecutionException exception) {
                if (networkOperations.get(request.operationId) == request) {
                    networkOperations.remove(request.operationId);
                }
                request.cancel();
                return false;
            }
        }

        private void completeAuthorizationNetworkLocked(
                NetworkAuthorizationRequest request,
                AuthorizationResponse authorization
        ) {
            CancellableNetworkOperation active = networkOperations.get(request.operationId);
            if (active != request) {
                return;
            }
            networkOperations.remove(request.operationId);
            try {
                Operation operation = state == null ? null : state.operations.get(request.operationId);
                if (authorization == null || !authorizationRequestMatchesCurrentStateLocked(request)
                        || !receiptMatchesOperation(authorization.receipt, operation, operation == null ? null : operation.kind)
                        || state.usedReceipts.containsKey(authorization.receipt.authorizationId)
                        || state.usedReceipts.size() >= MAX_USED_RECEIPTS) {
                    if (operation != null) {
                        discardOperationLocked(operation);
                    }
                    resolvePendingOperationContinuationLocked(request.operationId, false);
                    return;
                }
                if (Operation.KIND_DISPLAY.equals(operation.kind)) {
                    if (state.registry.size() >= MAX_NOTIFICATION_REGISTRY || state.registry.containsKey(operation.deliveryId)) {
                        discardOperationLocked(operation);
                        return;
                    }
                    int notificationId = reserveDeterministicNotificationId(operation.deliveryId, state.registry);
                    State scheduling = state.copy();
                    scheduling.operations.remove(operation.operationId);
                    scheduling.usedReceipts.put(
                            authorization.receipt.authorizationId,
                            new UsedReceipt(authorization.receipt, System.currentTimeMillis())
                    );
                    scheduling.registry.put(operation.deliveryId, new RegistryEntry(
                            notificationId,
                            operation.noticeId,
                            operation.displayEpoch,
                            RegistryEntry.PHASE_SCHEDULING,
                            System.currentTimeMillis()
                    ));
                    persist(scheduling);
                    try {
                        postNotification(
                                notificationId,
                                authorization.title,
                                operation.deliveryId,
                                operation.noticeId,
                                operation.displayEpoch
                        );
                    } catch (RuntimeException exception) {
                        compensateAmbiguousPostLocked();
                        return;
                    }
                    RegistryEntry current = state.registry.get(operation.deliveryId);
                    if (!authorizationRequestMatchesSchedulingStateLocked(request) || current == null
                            || current.notificationId != notificationId
                            || !RegistryEntry.PHASE_SCHEDULING.equals(current.phase)) {
                        compensateAmbiguousPostLocked();
                        return;
                    }
                    State scheduled = state.copy();
                    scheduled.registry.put(operation.deliveryId, current.withPhase(RegistryEntry.PHASE_SCHEDULED));
                    persist(scheduled);
                    resolvePendingOperationContinuationLocked(operation.operationId, true);
                } else {
                    RegistryEntry entry = state.registry.get(operation.deliveryId);
                    if (entry == null || !entry.matches(operation.noticeId, operation.displayEpoch)) {
                        discardOperationLocked(operation);
                        return;
                    }
                    State completed = state.copy();
                    completed.operations.remove(operation.operationId);
                    completed.pendingTaps.remove(operation.deliveryId);
                    completed.usedReceipts.put(
                            authorization.receipt.authorizationId,
                            new UsedReceipt(authorization.receipt, System.currentTimeMillis())
                    );
                    completed.registry.remove(operation.deliveryId);
                    notificationManager.cancel(entry.notificationId);
                    persist(completed);
                    resolvePendingOperationContinuationLocked(operation.operationId, true);
                }
            } catch (GeneralSecurityException | JSONException | SecurityException | IllegalStateException exception) {
                failClosedLocked();
            }
        }

        private AuthorizationResponse authorizeOperationOverNetwork(NetworkAuthorizationRequest request) {
            HttpsURLConnection connection = null;
            try {
                if (request.cancelled || Thread.currentThread().isInterrupted() || !isHttpsOrigin(request.apiOrigin)) {
                    return null;
                }
                JSONObject body = new JSONObject();
                body.put("notice_id", new BigInteger(request.noticeId));
                body.put("installation_id", request.installationId);
                body.put("binding_generation", Long.parseLong(request.bindingGeneration));
                body.put("token_generation", Long.parseLong(request.tokenGeneration));
                body.put("session_id", request.sessionId);
                body.put("client_display_epoch", request.displayEpoch);
                byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
                String path = "/v1/push-deliveries/" + request.deliveryId + "/authorize-display";
                URL endpoint = new URL(request.apiOrigin + path);
                if (!isExactHttpsEndpoint(endpoint, request.apiOrigin, path)) {
                    return null;
                }
                connection = (HttpsURLConnection) endpoint.openConnection();
                request.bind(connection);
                connection.setRequestMethod("POST");
                connection.setConnectTimeout(NETWORK_CONNECT_TIMEOUT_MILLIS);
                connection.setReadTimeout(NETWORK_READ_TIMEOUT_MILLIS);
                connection.setInstanceFollowRedirects(false);
                connection.setDoInput(true);
                connection.setDoOutput(true);
                connection.setFixedLengthStreamingMode(bytes.length);
                connection.setRequestProperty("Authorization", request.authorizationBearer);
                connection.setRequestProperty("X-ZeroTime-Contract", MOBILE_RELEASE_CONTRACT);
                connection.setRequestProperty("Idempotency-Key", request.idempotencyKey);
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                connection.setRequestProperty("Accept", "application/json");
                try (OutputStream output = connection.getOutputStream()) {
                    if (request.cancelled || Thread.currentThread().isInterrupted()) {
                        return null;
                    }
                    output.write(bytes);
                }
                if (request.cancelled || Thread.currentThread().isInterrupted()
                        || connection.getResponseCode() != HttpsURLConnection.HTTP_OK
                        || !MOBILE_RELEASE_CONTRACT.equals(connection.getHeaderField("X-ZeroTime-Contract"))
                        || !isJsonResponse(connection.getContentType())
                        || connection.getContentLength() > MAX_AUTHORIZATION_RESPONSE_BYTES) {
                    return null;
                }
                try (InputStream response = connection.getInputStream()) {
                    return request.cancelled ? null
                            : AuthorizationResponse.fromJson(new JSONObject(readBoundedResponse(response)));
                }
            } catch (IOException | JSONException | RuntimeException exception) {
                return null;
            } finally {
                request.unbind(connection);
                if (connection != null) {
                    connection.disconnect();
                }
            }
        }
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


        private boolean isDormantRecoveryStateLocked() {
            return state != null && State.ADMISSION_CLOSED.equals(state.admission)
                    && State.MUTATION_DORMANT_REBIND.equals(state.mutationPhase)
                    && state.sessionMarker == null && !state.nextLaunchPurge
                    && !state.localPrivacyBarrierFailed && !state.corruptState
                    && storedPositiveJsSafeInteger(state.bindingGeneration) != null
                    && storedPositiveJsSafeInteger(state.tokenGeneration) != null;
        }




        private void discardColdHandoffLocked(String deliveryId) throws GeneralSecurityException, JSONException {
            if (state != null && state.handoffs.containsKey(deliveryId)) {
                State next = state.copy();
                next.handoffs.remove(deliveryId);
                persist(next);
            }
        }

        private void quarantineColdPayloadLocked(DataOnlyPayload payload, String kind) {
            if (payload == null || (!QuarantinedPayload.KIND_DATA_ONLY.equals(kind)
                    && !QuarantinedPayload.KIND_TAP.equals(kind))) {
                return;
            }
            long now = System.currentTimeMillis();
            pruneColdPayloadQuarantineLocked(now);
            if (!coldPayloadQuarantine.containsKey(payload.deliveryId)) {
                while (coldPayloadQuarantine.size() >= MAX_PENDING_HANDOFFS) {
                    Iterator<String> deliveryIds = coldPayloadQuarantine.keySet().iterator();
                    if (!deliveryIds.hasNext()) {
                        break;
                    }
                    deliveryIds.next();
                    deliveryIds.remove();
                }
            }
            coldPayloadQuarantine.put(payload.deliveryId, new QuarantinedPayload(
                    kind,
                    payload,
                    now + COLD_PAYLOAD_QUARANTINE_TTL_MILLIS
            ));
        }

        private void pruneColdPayloadQuarantineLocked(long now) {
            Iterator<Map.Entry<String, QuarantinedPayload>> entries = coldPayloadQuarantine.entrySet().iterator();
            while (entries.hasNext()) {
                if (entries.next().getValue().expiresAtMillis <= now) {
                    entries.remove();
                }
            }
        }

        private void discardQuarantinedPayloadLocked(String deliveryId) {
            coldPayloadQuarantine.remove(deliveryId);
        }

        private void clearColdPayloadQuarantineLocked() {
            coldPayloadQuarantine.clear();
        }
        private boolean releaseColdPayloadAfterVerifiedRebindLocked()
                throws GeneralSecurityException, JSONException {
            pruneColdPayloadQuarantineLocked(System.currentTimeMillis());
            if (coldPayloadQuarantine.isEmpty()) {
                return true;
            }
            if (!isDisplayAdmittedLocked()) {
                clearColdPayloadQuarantineLocked();
                return true;
            }
            State next = state.copy();
            for (String deliveryId : new ArrayList<>(coldPayloadQuarantine.keySet())) {
                QuarantinedPayload payload = coldPayloadQuarantine.remove(deliveryId);
                if (payload == null || next.registry.containsKey(deliveryId)
                        || next.handoffs.containsKey(deliveryId)
                        || next.pendingTaps.containsKey(deliveryId)
                        || next.operationsContainsDelivery(deliveryId)) {
                    continue;
                }
                if (QuarantinedPayload.KIND_DATA_ONLY.equals(payload.kind)) {
                    if (next.handoffs.size() < MAX_PENDING_HANDOFFS) {
                        next.handoffs.put(deliveryId, new Handoff(
                                payload.payload.noticeId,
                                next.displayEpoch,
                                payload.expiresAtMillis
                        ));
                    }
                    continue;
                }
                if (next.registry.size() >= MAX_NOTIFICATION_REGISTRY || next.pendingTaps.size() >= MAX_PENDING_TAPS) {
                    continue;
                }
                int notificationId = reserveDeterministicNotificationId(deliveryId, next.registry);
                next.registry.put(deliveryId, new RegistryEntry(
                        notificationId,
                        payload.payload.noticeId,
                        next.displayEpoch,
                        RegistryEntry.PHASE_SCHEDULED,
                        System.currentTimeMillis()
                ));
                next.pendingTaps.put(deliveryId, new PendingTap(
                        payload.payload.noticeId,
                        next.displayEpoch,
                        payload.expiresAtMillis
                ));
            }
            persist(next);
            return true;
        }

        private void cancelNetworkOperationsLocked() {
            for (CancellableNetworkOperation operation : networkOperations.values()) {
                operation.cancel();
            }
            networkOperations.clear();
            drainPendingOperationContinuationsLocked();
        }

        private void resolvePendingOperationContinuationLocked(String operationId, boolean success) {
            OperationResultContinuation continuation = pendingOperationContinuations.remove(operationId);
            if (continuation != null) {
                continuation.complete(operationResult(success));
            }
        }

        private void drainPendingOperationContinuationsLocked() {
            List<OperationResultContinuation> continuations = new ArrayList<>(pendingOperationContinuations.values());
            pendingOperationContinuations.clear();
            for (OperationResultContinuation continuation : continuations) {
                continuation.complete(operationResult(false));
            }
        }

        private void clearVolatileSessionLocked() {
            activeSessionId = null;
            clearAuthorizationBearerLocked();
        }

        private void clearReleaseTrustAndCancelWorkLocked() {
            releaseValidated = false;
            validatedApiOrigin = null;
            clearVolatileSessionLocked();
            cancelNetworkOperationsLocked();
        }

        private static boolean isExactHttpsEndpoint(URL endpoint, String origin, String path) {
            return endpoint != null && isHttpsOrigin(origin) && "https".equals(endpoint.getProtocol())
                    && (origin + path).equals(endpoint.toExternalForm());
        }

        private static boolean isJsonResponse(String contentType) {
            if (contentType == null) {
                return false;
            }
            String normalized = contentType.toLowerCase(Locale.US);
            return "application/json".equals(normalized)
                    || "application/json; charset=utf-8".equals(normalized);
        }

        private String readBoundedResponse(InputStream input) throws IOException {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            byte[] buffer = new byte[4096];
            int total = 0;
            int read;
            while ((read = input.read(buffer)) != -1) {
                total += read;
                if (total > MAX_AUTHORIZATION_RESPONSE_BYTES) {
                    throw new IOException("Authorization response exceeds the bounded limit.");
                }
                output.write(buffer, 0, read);
            }
            return strictJsonObject(output.toByteArray());
        }

        private void postNotification(int id, String title, String deliveryId, String noticeId, String displayEpoch) {
            Intent tapIntent = new Intent(context, LaunchGateActivity.class)
                    .setAction(ACTION_NOTIFICATION_TAP)
                    .putExtra(EXTRA_DELIVERY_ID, deliveryId)
                    .putExtra(EXTRA_NOTICE_ID, noticeId)
                    .putExtra(EXTRA_DISPLAY_EPOCH, displayEpoch)
                    .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent pendingIntent = PendingIntent.getActivity(
                    context,
                    id,
                    tapIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            NotificationCompat.Builder notification = new NotificationCompat.Builder(context, CHANNEL_ID)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle(title)
                    .setContentIntent(pendingIntent)
                    .setAutoCancel(true)
                    .setOnlyAlertOnce(true)
                    .setCategory(NotificationCompat.CATEGORY_STATUS)
                    .setPriority(NotificationCompat.PRIORITY_DEFAULT);
            notificationManager.notify(id, notification.build());
        }

        private void createNotificationChannel() {
            if (notificationManager == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                return;
            }
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "ZeroTime notifications",
                    NotificationManager.IMPORTANCE_DEFAULT
            );
            channel.setDescription("Authorized ZeroTime notice alerts");
            notificationManager.createNotificationChannel(channel);
        }

        private void emitQueuedEventsLocked() {
            if (!releaseValidated || plugin.get() == null || state == null) {
                return;
            }
            for (Map.Entry<String, Handoff> entry : state.handoffs.entrySet()) {
                emitDataOnlyPayload(new DataOnlyPayload(entry.getKey(), entry.getValue().noticeId));
            }
            for (Map.Entry<String, PendingTap> entry : state.pendingTaps.entrySet()) {
                emitTap(new DataOnlyPayload(entry.getKey(), entry.getValue().noticeId), entry.getValue().displayEpoch);
            }
            if (state.pendingFcmToken != null) {
                emitFcmToken(state.pendingFcmToken);
            }
        }

        private void emitDataOnlyPayload(DataOnlyPayload payload) {
            NativeNotificationCoordinatorPlugin attached = plugin.get();
            if (attached != null) {
                attached.emitFromEngine(DATA_ONLY_PUSH_EVENT, payload.toJson());
            }
        }

        private void emitTap(DataOnlyPayload payload, String epoch) {
            NativeNotificationCoordinatorPlugin attached = plugin.get();
            if (attached != null) {
                JSObject event = payload.toJson();
                event.put("display_epoch", epoch);
                attached.emitFromEngine(NOTIFICATION_TAP_EVENT, event);
            }
        }

        private void emitFcmToken(String token) {
            NativeNotificationCoordinatorPlugin attached = plugin.get();
            if (attached != null) {
                JSObject event = new JSObject();
                event.put("token", token);
                attached.emitFromEngine(FCM_TOKEN_EVENT, event);
            }
        }

        private void reconcileCurrentFcmToken() {
            try {
                FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
                    if (task.isSuccessful() && task.getResult() != null) {
                        receiveFcmToken(task.getResult());
                    }
                });
            } catch (RuntimeException ignored) {
                // The persisted token handoff remains available; no unauthenticated fallback exists.
            }
        }

        private void persist(State next) throws GeneralSecurityException, JSONException {
            if (!next.hasPersistedBounds()) {
                throw new IllegalStateException("Notification coordinator state exceeds its bounded registries.");
            }
            stateStore.save(next);
            state = next;
        }

        private void clearAuthorizationBearerLocked() {
            authorizationBearer = null;
        }

        private void markBarrierFailureLocked() {
            invalidateBootstrapSuccessLocked();
            clearColdPayloadQuarantineLocked();
            if (state == null) {
                return;
            }
            clearVolatileSessionLocked();
            try {
                State failed = state.copy();
                failed.admission = State.ADMISSION_CLOSING;
                failed.sessionMarker = null;
                if (State.MUTATION_BOUND.equals(failed.mutationPhase)) {
                    failed.mutationPhase = State.MUTATION_DORMANT_REBIND;
                    failed.mutationReason = null;
                }
                failed.nextLaunchPurge = true;
                failed.localPrivacyBarrierFailed = true;
                persist(failed);
            } catch (GeneralSecurityException | JSONException | IllegalStateException ignored) {
                // Existing durable closing state is safer than reopening on a storage failure.
            }
        }

        private void failClosedLocked() {
            invalidateBootstrapSuccessLocked();
            clearColdPayloadQuarantineLocked();
            clearReleaseTrustAndCancelWorkLocked();
            markBarrierFailureLocked();
        }

        private void addOperationIdentity(JSObject result, Operation operation) {
            String bindingGeneration = storedPositiveJsSafeInteger(operation.bindingGeneration);
            String tokenGeneration = storedPositiveJsSafeInteger(operation.tokenGeneration);
            result.put("operation_id", operation.operationId);
            result.put("installation_id", state == null ? JSONObject.NULL : state.installationId);
            result.put("session_id", activeSessionId == null ? JSONObject.NULL : activeSessionId);
            result.put("binding_generation", bindingGeneration == null
                    ? JSONObject.NULL : Long.parseLong(bindingGeneration));
            result.put("token_generation", tokenGeneration == null
                    ? JSONObject.NULL : Long.parseLong(tokenGeneration));
            result.put("client_display_epoch", operation.displayEpoch);
        }

        private static boolean equalsManifestField(JSONObject manifest, String field, String expected) {
            return expected != null && expected.equals(manifest.optString(field, null));
        }

        private static String oldestHandoffKey(Map<String, Handoff> handoffs) {
            String oldestKey = null;
            long oldest = Long.MAX_VALUE;
            for (Map.Entry<String, Handoff> entry : handoffs.entrySet()) {
                if (entry.getValue().expiresAtMillis < oldest) {
                    oldest = entry.getValue().expiresAtMillis;
                    oldestKey = entry.getKey();
                }
            }
            return oldestKey;
        }

        private static int reserveDeterministicNotificationId(String deliveryId, Map<String, RegistryEntry> registry) {
            Set<Integer> used = new HashSet<>();
            for (RegistryEntry entry : registry.values()) {
                used.add(entry.notificationId);
            }
            int candidate = deterministicNotificationId(deliveryId);
            while (used.contains(candidate)) {
                candidate = candidate == MAX_NOTIFICATION_ID ? 1 : candidate + 1;
            }
            return candidate;
        }

        private static int deterministicNotificationId(String deliveryId) {
            int hash = 0x811c9dc5;
            for (int index = 0; index < deliveryId.length(); index++) {
                hash ^= deliveryId.charAt(index);
                hash *= 0x01000193;
            }
            int candidate = (int) (Integer.toUnsignedLong(hash) % MAX_NOTIFICATION_ID);
            return candidate == 0 ? 1 : candidate;
        }

        private static String incrementEpoch(String epoch) {
            BigInteger parsed = new BigInteger(epoch);
            if (parsed.compareTo(MAX_UINT64) >= 0) {
                throw new IllegalStateException("Display epoch exhausted.");
            }
            return parsed.add(BigInteger.ONE).toString();
        }
    }

    private static final class DataOnlyPayload {
        final String deliveryId;
        final String noticeId;

        DataOnlyPayload(String deliveryId, String noticeId) {
            this.deliveryId = deliveryId;
            this.noticeId = noticeId;
        }

        static DataOnlyPayload from(JSObject object) {
            if (object == null || object.length() != 2) {
                return null;
            }
            return fromValues(object.optString("delivery_id", null), object.optString("notice_id", null));
        }

        static DataOnlyPayload from(Map<String, String> data) {
            if (data == null || data.size() != 2) {
                return null;
            }
            return fromValues(data.get("delivery_id"), data.get("notice_id"));
        }

        static DataOnlyPayload fromValues(String deliveryId, String noticeId) {
            String canonicalNoticeId = canonicalPositiveIntegerString(noticeId);
            if (!isUuid(deliveryId) || canonicalNoticeId == null) {
                return null;
            }
            return new DataOnlyPayload(deliveryId, canonicalNoticeId);
        }

        JSObject toJson() {
            JSObject result = new JSObject();
            result.put("delivery_id", deliveryId);
            result.put("notice_id", noticeId);
            return result;
        }
    }

    private static final class QuarantinedPayload {
        static final String KIND_DATA_ONLY = "data_only";
        static final String KIND_TAP = "tap";

        final String kind;
        final DataOnlyPayload payload;
        final long expiresAtMillis;

        QuarantinedPayload(String kind, DataOnlyPayload payload, long expiresAtMillis) {
            this.kind = kind;
            this.payload = payload;
            this.expiresAtMillis = expiresAtMillis;
        }
    }
    private static final class Operation {
        static final String KIND_DISPLAY = "display";
        static final String KIND_TAP = "tap";
        final String operationId;
        final String kind;
        final String deliveryId;
        final String noticeId;
        final String displayEpoch;
        final String sessionMarker;
        final String bindingGeneration;
        final String tokenGeneration;
        final long expiresAtMillis;

        Operation(
                String operationId,
                String kind,
                String deliveryId,
                String noticeId,
                String displayEpoch,
                String sessionMarker,
                String bindingGeneration,
                String tokenGeneration,
                long expiresAtMillis
        ) {
            this.operationId = operationId;
            this.kind = kind;
            this.deliveryId = deliveryId;
            this.noticeId = noticeId;
            this.displayEpoch = displayEpoch;
            this.sessionMarker = sessionMarker;
            this.bindingGeneration = bindingGeneration;
            this.tokenGeneration = tokenGeneration;
            this.expiresAtMillis = expiresAtMillis;
        }

        static Operation create(
                String kind,
                DataOnlyPayload payload,
                String displayEpoch,
                String sessionMarker,
                String bindingGeneration,
                String tokenGeneration
        ) {
            return new Operation(
                    UUID.randomUUID().toString(),
                    kind,
                    payload.deliveryId,
                    payload.noticeId,
                    displayEpoch,
                    sessionMarker,
                    bindingGeneration,
                    tokenGeneration,
                    System.currentTimeMillis() + CoordinatorEngine.AUTHORIZATION_TTL_MILLIS
            );
        }

        JSONObject toJson() throws JSONException {
            JSONObject result = new JSONObject();
            result.put("kind", kind);
            result.put("delivery_id", deliveryId);
            result.put("notice_id", noticeId);
            result.put("display_epoch", displayEpoch);
            result.put("session_marker", sessionMarker);
            result.put("binding_generation", bindingGeneration);
            result.put("token_generation", tokenGeneration);
            result.put("expires_at_millis", expiresAtMillis);
            return result;
        }

        static Operation fromJson(String operationId, JSONObject object) throws JSONException {
            if (!hasExactKeys(
                    object,
                    "kind",
                    "delivery_id",
                    "notice_id",
                    "display_epoch",
                    "session_marker",
                    "binding_generation",
                    "token_generation",
                    "expires_at_millis"
            )) {
                throw new JSONException("Invalid authorization operation.");
            }
            String kind = object.optString("kind", null);
            String deliveryId = object.optString("delivery_id", null);
            String noticeId = object.optString("notice_id", null);
            String displayEpoch = canonicalUint64(object.opt("display_epoch"));
            String sessionMarker = boundedString(object.opt("session_marker"), 64);
            String bindingGeneration = storedPositiveJsSafeInteger(object.opt("binding_generation"));
            String tokenGeneration = storedPositiveJsSafeInteger(object.opt("token_generation"));
            Long expiresAtMillis = exactLong(object.opt("expires_at_millis"));
            if (!isUuid(operationId) || !(KIND_DISPLAY.equals(kind) || KIND_TAP.equals(kind))
                    || DataOnlyPayload.fromValues(deliveryId, noticeId) == null || displayEpoch == null
                    || !validSessionMarker(sessionMarker) || bindingGeneration == null || tokenGeneration == null
                    || expiresAtMillis == null || expiresAtMillis <= 0) {
                throw new JSONException("Invalid authorization operation.");
            }
            return new Operation(operationId, kind, deliveryId, noticeId, displayEpoch, sessionMarker,
                    bindingGeneration, tokenGeneration, expiresAtMillis);
        }
    }

    private static final class Receipt {
        final String authorizationId;
        final String deliveryId;
        final String noticeId;
        final String displayEpoch;
        final String bindingGeneration;
        final String tokenGeneration;
        final long expiresAtMillis;

        Receipt(
                String authorizationId,
                String deliveryId,
                String noticeId,
                String displayEpoch,
                String bindingGeneration,
                String tokenGeneration,
                long expiresAtMillis
        ) {
            this.authorizationId = authorizationId;
            this.deliveryId = deliveryId;
            this.noticeId = noticeId;
            this.displayEpoch = displayEpoch;
            this.bindingGeneration = bindingGeneration;
            this.tokenGeneration = tokenGeneration;
            this.expiresAtMillis = expiresAtMillis;
        }

        static Receipt fromServer(JSONObject input) {
            if (input == null) {
                return null;
            }
            String authorizationId = opaqueId(input.opt("authorization_id"));
            String deliveryId = input.optString("delivery_id", null);
            JSONObject notice = input.optJSONObject("notice");
            JSONObject installation = input.optJSONObject("installation");
            if (authorizationId == null || notice == null || installation == null
                    || !hasExactKeys(notice, "id", "public_title")
                    || !hasExactKeys(installation, "binding_generation", "token_generation")) {
                return null;
            }
            DataOnlyPayload payload = DataOnlyPayload.fromValues(
                    deliveryId,
                    canonicalPositiveJsonInteger(notice.opt("id"))
            );
            String displayEpoch = canonicalUint64(input.opt("client_display_epoch"));
            String bindingGeneration = positiveJsSafeInteger(installation.opt("binding_generation"));
            String tokenGeneration = positiveJsSafeInteger(installation.opt("token_generation"));
            Object expiry = input.opt("authorization_expires_at_utc");
            Long expiresAtMillis = expiry instanceof String ? parseUtcMillis((String) expiry) : null;
            if (payload == null || displayEpoch == null || bindingGeneration == null
                    || tokenGeneration == null || expiresAtMillis == null) {
                return null;
            }
            return new Receipt(authorizationId, payload.deliveryId, payload.noticeId, displayEpoch,
                    bindingGeneration, tokenGeneration, expiresAtMillis);
        }

        JSONObject toJson() throws JSONException {
            JSONObject result = new JSONObject();
            result.put("delivery_id", deliveryId);
            result.put("notice_id", noticeId);
            result.put("display_epoch", displayEpoch);
            result.put("binding_generation", bindingGeneration);
            result.put("token_generation", tokenGeneration);
            result.put("expires_at_millis", expiresAtMillis);
            return result;
        }
    }

    private static final class AuthorizationResponse {
        final Receipt receipt;
        final String title;

        AuthorizationResponse(Receipt receipt, String title) {
            this.receipt = receipt;
            this.title = title;
        }

        static AuthorizationResponse fromJson(JSONObject input) {
            if (!hasExactKeys(
                    input,
                    "authorized",
                    "authorization_id",
                    "authorization_expires_at_utc",
                    "client_display_epoch",
                    "delivery_id",
                    "notice",
                    "display",
                    "installation"
            ) || !Boolean.TRUE.equals(input.opt("authorized"))) {
                return null;
            }
            JSONObject notice = input.optJSONObject("notice");
            JSONObject display = input.optJSONObject("display");
            if (notice == null || display == null || !hasExactKeys(notice, "id", "public_title")
                    || !hasExactKeys(display, "app_name")
                    || !"ZeroTime".equals(display.optString("app_name", null))) {
                return null;
            }
            Receipt receipt = Receipt.fromServer(input);
            String title = publicNotificationTitle(notice.opt("public_title"));
            return receipt == null || title == null ? null : new AuthorizationResponse(receipt, title);
        }
    }
    private static String strictJsonObject(byte[] bytes) throws IOException {
        try {
            CharBuffer decoded = StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(bytes));
            String document = decoded.toString();
            new StrictJsonObjectValidator(document).validate();
            return document;
        } catch (CharacterCodingException exception) {
            throw new IOException("Authorization response is not valid UTF-8.", exception);
        }
    }

    private static final class StrictJsonObjectValidator {
        private static final int MAX_NESTING = 64;
        private final String source;
        private int index;

        StrictJsonObjectValidator(String source) {
            this.source = source;
        }

        void validate() throws IOException {
            skipWhitespace();
            if (!hasNext() || current() != '{') {
                throw invalid();
            }
            parseObject(0);
            skipWhitespace();
            if (hasNext()) {
                throw invalid();
            }
        }

        private void parseObject(int depth) throws IOException {
            if (depth >= MAX_NESTING) {
                throw invalid();
            }
            expect('{');
            skipWhitespace();
            if (consume('}')) {
                return;
            }
            Set<String> keys = new HashSet<>();
            while (true) {
                skipWhitespace();
                if (!hasNext() || current() != '"') {
                    throw invalid();
                }
                if (!keys.add(parseString())) {
                    throw invalid();
                }
                skipWhitespace();
                expect(':');
                skipWhitespace();
                parseValue(depth + 1);
                skipWhitespace();
                if (consume('}')) {
                    return;
                }
                expect(',');
            }
        }

        private void parseArray(int depth) throws IOException {
            if (depth >= MAX_NESTING) {
                throw invalid();
            }
            expect('[');
            skipWhitespace();
            if (consume(']')) {
                return;
            }
            while (true) {
                parseValue(depth + 1);
                skipWhitespace();
                if (consume(']')) {
                    return;
                }
                expect(',');
                skipWhitespace();
            }
        }

        private void parseValue(int depth) throws IOException {
            if (!hasNext()) {
                throw invalid();
            }
            switch (current()) {
                case '{':
                    parseObject(depth);
                    return;
                case '[':
                    parseArray(depth);
                    return;
                case '"':
                    parseString();
                    return;
                case 't':
                    expectLiteral("true");
                    return;
                case 'f':
                    expectLiteral("false");
                    return;
                case 'n':
                    expectLiteral("null");
                    return;
                default:
                    parseNumber();
            }
        }

        private String parseString() throws IOException {
            expect('"');
            StringBuilder result = new StringBuilder();
            while (hasNext()) {
                char character = source.charAt(index++);
                if (character == '"') {
                    return result.toString();
                }
                if (character < 0x20) {
                    throw invalid();
                }
                if (character == '\\') {
                    if (!hasNext()) {
                        throw invalid();
                    }
                    char escape = source.charAt(index++);
                    switch (escape) {
                        case '"':
                        case '\\':
                        case '/':
                            result.append(escape);
                            break;
                        case 'b':
                            result.append('\b');
                            break;
                        case 'f':
                            result.append('\f');
                            break;
                        case 'n':
                            result.append('\n');
                            break;
                        case 'r':
                            result.append('\r');
                            break;
                        case 't':
                            result.append('\t');
                            break;
                        case 'u':
                            appendUnicodeEscape(result);
                            break;
                        default:
                            throw invalid();
                    }
                    continue;
                }
                if (Character.isHighSurrogate(character)) {
                    if (!hasNext() || !Character.isLowSurrogate(current())) {
                        throw invalid();
                    }
                    result.append(character);
                    result.append(source.charAt(index++));
                    continue;
                }
                if (Character.isLowSurrogate(character)) {
                    throw invalid();
                }
                result.append(character);
            }
            throw invalid();
        }

        private void appendUnicodeEscape(StringBuilder result) throws IOException {
            char first = (char) readUnicodeEscape();
            if (Character.isHighSurrogate(first)) {
                if (index + 6 > source.length() || source.charAt(index) != '\\'
                        || source.charAt(index + 1) != 'u') {
                    throw invalid();
                }
                index += 2;
                char second = (char) readUnicodeEscape();
                if (!Character.isLowSurrogate(second)) {
                    throw invalid();
                }
                result.append(first);
                result.append(second);
                return;
            }
            if (Character.isLowSurrogate(first)) {
                throw invalid();
            }
            result.append(first);
        }

        private int readUnicodeEscape() throws IOException {
            if (index + 4 > source.length()) {
                throw invalid();
            }
            int value = 0;
            for (int offset = 0; offset < 4; offset++) {
                char character = source.charAt(index++);
                int digit;
                if (character >= '0' && character <= '9') {
                    digit = character - '0';
                } else if (character >= 'a' && character <= 'f') {
                    digit = character - 'a' + 10;
                } else if (character >= 'A' && character <= 'F') {
                    digit = character - 'A' + 10;
                } else {
                    throw invalid();
                }
                value = (value << 4) | digit;
            }
            return value;
        }

        private void parseNumber() throws IOException {
            consume('-');
            if (!hasNext()) {
                throw invalid();
            }
            if (consume('0')) {
                // A leading zero is the complete integer portion.
            } else if (current() >= '1' && current() <= '9') {
                index++;
                while (hasNext() && current() >= '0' && current() <= '9') {
                    index++;
                }
            } else {
                throw invalid();
            }
            if (consume('.')) {
                consumeDigits();
            }
            if (consume('e') || consume('E')) {
                if (hasNext() && (current() == '+' || current() == '-')) {
                    index++;
                }
                consumeDigits();
            }
        }

        private void consumeDigits() throws IOException {
            if (!hasNext() || current() < '0' || current() > '9') {
                throw invalid();
            }
            do {
                index++;
            } while (hasNext() && current() >= '0' && current() <= '9');
        }

        private void expectLiteral(String literal) throws IOException {
            if (!source.regionMatches(index, literal, 0, literal.length())) {
                throw invalid();
            }
            index += literal.length();
        }

        private void skipWhitespace() {
            while (hasNext()) {
                char character = current();
                if (character != ' ' && character != '\n' && character != '\r' && character != '\t') {
                    return;
                }
                index++;
            }
        }

        private void expect(char expected) throws IOException {
            if (!consume(expected)) {
                throw invalid();
            }
        }

        private boolean consume(char expected) {
            if (!hasNext() || current() != expected) {
                return false;
            }
            index++;
            return true;
        }

        private boolean hasNext() {
            return index < source.length();
        }

        private char current() {
            return source.charAt(index);
        }

        private IOException invalid() {
            return new IOException("Authorization response is not strict JSON.");
        }
    }
    private abstract static class CancellableNetworkOperation {
        volatile boolean cancelled;
        volatile Future<?> future;
        private volatile HttpsURLConnection connection;

        final synchronized void bind(HttpsURLConnection next) {
            connection = next;
            if (cancelled && next != null) {
                next.disconnect();
            }
        }

        final synchronized void unbind(HttpsURLConnection current) {
            if (connection == current) {
                connection = null;
            }
        }

        final synchronized void cancel() {
            cancelled = true;
            Future<?> pending = future;
            if (pending != null) {
                pending.cancel(true);
            }
            HttpsURLConnection active = connection;
            if (active != null) {
                active.disconnect();
            }
        }
    }

    private static final class NetworkAuthorizationRequest extends CancellableNetworkOperation {
        final String operationId;
        final String deliveryId;
        final String noticeId;
        final String displayEpoch;
        final String sessionMarker;
        final String bindingGeneration;
        final String tokenGeneration;
        final String installationId;
        final String sessionId;
        final String authorizationBearer;
        final String apiOrigin;
        final String idempotencyKey;

        NetworkAuthorizationRequest(
                Operation operation,
                String installationId,
                String apiOrigin,
                String sessionId,
                String authorizationBearer
        ) {
            this.operationId = operation.operationId;
            this.deliveryId = operation.deliveryId;
            this.noticeId = operation.noticeId;
            this.displayEpoch = operation.displayEpoch;
            this.sessionMarker = operation.sessionMarker;
            this.bindingGeneration = operation.bindingGeneration;
            this.tokenGeneration = operation.tokenGeneration;
            this.installationId = installationId;
            this.sessionId = sessionId;
            this.authorizationBearer = authorizationBearer;
            this.apiOrigin = apiOrigin;
            this.idempotencyKey = UUID.randomUUID().toString();
        }

        static NetworkAuthorizationRequest capture(
                Operation operation,
                String installationId,
                String apiOrigin,
                String sessionId,
                String authorizationBearer
        ) {
            if (operation == null || !isUuid(operation.operationId) || !isUuid(operation.deliveryId)
                    || canonicalPositiveIntegerString(operation.noticeId) == null
                    || canonicalUint64(operation.displayEpoch) == null || !validSessionMarker(operation.sessionMarker)
                    || storedPositiveJsSafeInteger(operation.bindingGeneration) == null
                    || storedPositiveJsSafeInteger(operation.tokenGeneration) == null
                    || !isUuid(installationId) || !isUuid(sessionId) || authorizationBearer(authorizationBearer) == null
                    || !CoordinatorEngine.isHttpsOrigin(apiOrigin)) {
                return null;
            }
            return new NetworkAuthorizationRequest(
                    operation,
                    installationId,
                    apiOrigin,
                    sessionId,
                    authorizationBearer
            );
        }
    }


    private static final class UsedReceipt {
        final Receipt receipt;
        final long expiresAtMillis;

        UsedReceipt(Receipt receipt, long ignored) {
            this.receipt = receipt;
            this.expiresAtMillis = receipt.expiresAtMillis;
        }

        JSONObject toJson() throws JSONException {
            return receipt.toJson();
        }

        static UsedReceipt fromJson(String authorizationId, JSONObject object) throws JSONException {
            if (!hasExactKeys(
                    object,
                    "delivery_id",
                    "notice_id",
                    "display_epoch",
                    "binding_generation",
                    "token_generation",
                    "expires_at_millis"
            )) {
                throw new JSONException("Invalid used authorization receipt.");
            }
            DataOnlyPayload payload = DataOnlyPayload.fromValues(
                    object.optString("delivery_id", null), object.optString("notice_id", null)
            );
            String displayEpoch = canonicalUint64(object.opt("display_epoch"));
            String bindingGeneration = storedPositiveJsSafeInteger(object.opt("binding_generation"));
            String tokenGeneration = storedPositiveJsSafeInteger(object.opt("token_generation"));
            Long expiresAtMillis = exactLong(object.opt("expires_at_millis"));
            if (opaqueId(authorizationId) == null || payload == null || displayEpoch == null
                    || bindingGeneration == null || tokenGeneration == null || expiresAtMillis == null
                    || expiresAtMillis <= 0) {
                throw new JSONException("Invalid used authorization receipt.");
            }
            return new UsedReceipt(new Receipt(authorizationId, payload.deliveryId, payload.noticeId,
                    displayEpoch, bindingGeneration, tokenGeneration, expiresAtMillis), 0);
        }
    }

    private static final class RegistryEntry {
        static final String PHASE_SCHEDULING = "scheduling";
        static final String PHASE_SCHEDULED = "scheduled";
        final int notificationId;
        final String noticeId;
        final String displayEpoch;
        final String phase;
        final long createdAtMillis;

        RegistryEntry(int notificationId, String noticeId, String displayEpoch, String phase, long createdAtMillis) {
            this.notificationId = notificationId;
            this.noticeId = noticeId;
            this.displayEpoch = displayEpoch;
            this.phase = phase;
            this.createdAtMillis = createdAtMillis;
        }

        boolean matches(String noticeId, String displayEpoch) {
            return this.noticeId.equals(noticeId) && this.displayEpoch.equals(displayEpoch);
        }

        RegistryEntry withPhase(String phase) {
            return new RegistryEntry(notificationId, noticeId, displayEpoch, phase, createdAtMillis);
        }

        JSONObject toJson() throws JSONException {
            JSONObject result = new JSONObject();
            result.put("local_notification_id", notificationId);
            result.put("notice_id", noticeId);
            result.put("display_epoch", displayEpoch);
            result.put("phase", phase);
            result.put("created_at_millis", createdAtMillis);
            return result;
        }

        static RegistryEntry fromJson(JSONObject object) throws JSONException {
            if (!hasExactKeys(
                    object,
                    "local_notification_id",
                    "notice_id",
                    "display_epoch",
                    "phase",
                    "created_at_millis"
            )) {
                throw new JSONException("Invalid notification registry entry.");
            }
            Integer notificationId = positiveNotificationId(object.opt("local_notification_id"));
            String noticeId = object.optString("notice_id", null);
            String displayEpoch = canonicalUint64(object.opt("display_epoch"));
            String phase = object.optString("phase", null);
            Long createdAtMillis = exactLong(object.opt("created_at_millis"));
            if (notificationId == null || canonicalPositiveIntegerString(noticeId) == null
                    || displayEpoch == null || !(PHASE_SCHEDULING.equals(phase) || PHASE_SCHEDULED.equals(phase))
                    || createdAtMillis == null || createdAtMillis <= 0) {
                throw new JSONException("Invalid notification registry entry.");
            }
            return new RegistryEntry(notificationId, canonicalPositiveIntegerString(noticeId), displayEpoch, phase, createdAtMillis);
        }
    }

    private static final class Handoff {
        final String noticeId;
        final String displayEpoch;
        final long expiresAtMillis;

        Handoff(String noticeId, String displayEpoch, long expiresAtMillis) {
            this.noticeId = noticeId;
            this.displayEpoch = displayEpoch;
            this.expiresAtMillis = expiresAtMillis;
        }

        JSONObject toJson() throws JSONException {
            JSONObject result = new JSONObject();
            result.put("notice_id", noticeId);
            result.put("display_epoch", displayEpoch);
            result.put("expires_at_millis", expiresAtMillis);
            return result;
        }

        static Handoff fromJson(JSONObject object) throws JSONException {
            if (!hasExactKeys(object, "notice_id", "display_epoch", "expires_at_millis")) {
                throw new JSONException("Invalid data-only handoff.");
            }
            String noticeId = object.optString("notice_id", null);
            String displayEpoch = canonicalUint64(object.opt("display_epoch"));
            Long expiresAtMillis = exactLong(object.opt("expires_at_millis"));
            String canonicalNoticeId = canonicalPositiveIntegerString(noticeId);
            if (canonicalNoticeId == null || displayEpoch == null || expiresAtMillis == null || expiresAtMillis <= 0) {
                throw new JSONException("Invalid data-only handoff.");
            }
            return new Handoff(canonicalNoticeId, displayEpoch, expiresAtMillis);
        }
    }

    private static final class PendingTap {
        final String noticeId;
        final String displayEpoch;
        final long expiresAtMillis;

        PendingTap(String noticeId, String displayEpoch, long expiresAtMillis) {
            this.noticeId = noticeId;
            this.displayEpoch = displayEpoch;
            this.expiresAtMillis = expiresAtMillis;
        }

        JSONObject toJson() throws JSONException {
            JSONObject result = new JSONObject();
            result.put("notice_id", noticeId);
            result.put("display_epoch", displayEpoch);
            result.put("expires_at_millis", expiresAtMillis);
            return result;
        }

        static PendingTap fromJson(JSONObject object) throws JSONException {
            if (!hasExactKeys(object, "notice_id", "display_epoch", "expires_at_millis")) {
                throw new JSONException("Invalid pending tap.");
            }
            String noticeId = object.optString("notice_id", null);
            String displayEpoch = canonicalUint64(object.opt("display_epoch"));
            Long expiresAtMillis = exactLong(object.opt("expires_at_millis"));
            String canonicalNoticeId = canonicalPositiveIntegerString(noticeId);
            if (canonicalNoticeId == null || displayEpoch == null || expiresAtMillis == null || expiresAtMillis <= 0) {
                throw new JSONException("Invalid pending tap.");
            }
            return new PendingTap(canonicalNoticeId, displayEpoch, expiresAtMillis);
        }
    }

    private static final class State {
        static final String ADMISSION_OPEN = "open";
        static final String ADMISSION_CLOSING = "closing";
        static final String ADMISSION_CLOSED = "closed";
        static final String MUTATION_UNBOUND = "unbound";
        static final String MUTATION_BOUND = "bound";
        static final String MUTATION_AWAITING_FINALIZE = "awaiting_finalize";
        static final String MUTATION_READY_FOR_RELOGIN = "ready_for_relogin";
        static final String MUTATION_READY_FOR_REBIND = "ready_for_rebind";
        static final String MUTATION_DORMANT_REBIND = "dormant_rebind";
        static final String MUTATION_TERMINAL = "terminal";
        static final String MUTATION_CORRUPT_FAILURE = "corrupt_failure";
        static final String REASON_ACCOUNT_SWITCH = "account_switch";

        final String installationId;
        String displayEpoch;
        String admission;
        String mutationPhase;
        String mutationReason;
        String sessionMarker;
        String bindingGeneration;
        String tokenGeneration;
        boolean nextLaunchPurge;
        boolean localPrivacyBarrierFailed;
        boolean corruptState;
        int foregroundBannerCount;
        String pendingFcmToken;
        final Map<String, RegistryEntry> registry;
        final Map<String, Handoff> handoffs;
        final Map<String, PendingTap> pendingTaps;
        final Map<String, Operation> operations;
        final Map<String, UsedReceipt> usedReceipts;

        State(
                String installationId,
                String displayEpoch,
                String admission,
                String mutationPhase,
                String mutationReason,
                String sessionMarker,
                String bindingGeneration,
                String tokenGeneration,
                boolean nextLaunchPurge,
                boolean localPrivacyBarrierFailed,
                boolean corruptState,
                int foregroundBannerCount,
                String pendingFcmToken,
                Map<String, RegistryEntry> registry,
                Map<String, Handoff> handoffs,
                Map<String, PendingTap> pendingTaps,
                Map<String, Operation> operations,
                Map<String, UsedReceipt> usedReceipts
        ) {
            this.installationId = installationId;
            this.displayEpoch = displayEpoch;
            this.admission = admission;
            this.mutationPhase = mutationPhase;
            this.mutationReason = mutationReason;
            this.sessionMarker = sessionMarker;
            this.bindingGeneration = bindingGeneration;
            this.tokenGeneration = tokenGeneration;
            this.nextLaunchPurge = nextLaunchPurge;
            this.localPrivacyBarrierFailed = localPrivacyBarrierFailed;
            this.corruptState = corruptState;
            this.foregroundBannerCount = foregroundBannerCount;
            this.pendingFcmToken = pendingFcmToken;
            this.registry = registry;
            this.handoffs = handoffs;
            this.pendingTaps = pendingTaps;
            this.operations = operations;
            this.usedReceipts = usedReceipts;
        }

        static State initial(String installationId) {
            return new State(installationId, "0", ADMISSION_CLOSED, MUTATION_UNBOUND, null, null,
                    "0", "0", false, false, false, 0, null, new TreeMap<>(), new TreeMap<>(),
                    new TreeMap<>(), new TreeMap<>(), new TreeMap<>());
        }

        static State corruptRecovery(String installationId) {
            State recovered = initial(installationId);
            recovered.displayEpoch = CoordinatorEngine.MAX_UINT64.toString();
            recovered.mutationPhase = MUTATION_CORRUPT_FAILURE;
            recovered.admission = ADMISSION_CLOSING;
            recovered.nextLaunchPurge = true;
            recovered.localPrivacyBarrierFailed = true;
            recovered.corruptState = true;
            return recovered;
        }

        State copy() {
            return new State(installationId, displayEpoch, admission, mutationPhase, mutationReason, sessionMarker,
                    bindingGeneration, tokenGeneration, nextLaunchPurge, localPrivacyBarrierFailed,
                    corruptState, foregroundBannerCount, pendingFcmToken, new TreeMap<>(registry),
                    new TreeMap<>(handoffs), new TreeMap<>(pendingTaps), new TreeMap<>(operations),
                    new TreeMap<>(usedReceipts));
        }
        boolean hasPersistedBounds() {
            return registry.size() <= CoordinatorEngine.MAX_NOTIFICATION_REGISTRY
                    && handoffs.size() <= CoordinatorEngine.MAX_PENDING_HANDOFFS
                    && pendingTaps.size() <= CoordinatorEngine.MAX_PENDING_TAPS
                    && operations.size() <= CoordinatorEngine.MAX_PENDING_OPERATIONS
                    && usedReceipts.size() <= CoordinatorEngine.MAX_USED_RECEIPTS;
        }


        boolean operationsContainsDelivery(String deliveryId) {
            for (Operation operation : operations.values()) {
                if (deliveryId.equals(operation.deliveryId)) {
                    return true;
                }
            }
            return false;
        }

        List<Integer> notificationIds() {
            Set<Integer> ids = new HashSet<>();
            for (RegistryEntry entry : registry.values()) {
                ids.add(entry.notificationId);
            }
            return new ArrayList<>(ids);
        }

        JSONObject toJson() throws JSONException {
            JSONObject result = new JSONObject();
            result.put("version", CoordinatorEngine.STATE_VERSION);
            result.put("installation_id", installationId);
            result.put("display_epoch", displayEpoch);
            result.put("admission", admission);
            result.put("mutation_phase", mutationPhase);
            result.put("mutation_reason", mutationReason == null ? JSONObject.NULL : mutationReason);
            result.put("session_marker", sessionMarker == null ? JSONObject.NULL : sessionMarker);
            result.put("binding_generation", bindingGeneration);
            result.put("token_generation", tokenGeneration);
            result.put("next_launch_purge", nextLaunchPurge);
            result.put("local_privacy_barrier_failed", localPrivacyBarrierFailed);
            result.put("corrupt_state", corruptState);
            result.put("foreground_banner_count", foregroundBannerCount);
            result.put("pending_fcm_token", pendingFcmToken == null ? JSONObject.NULL : pendingFcmToken);
            result.put("local_notification_registry", mapToJson(registry, RegistryEntry::toJson));
            result.put("data_only_handoffs", mapToJson(handoffs, Handoff::toJson));
            result.put("pending_taps", mapToJson(pendingTaps, PendingTap::toJson));
            result.put("authorization_operations", mapToJson(operations, Operation::toJson));
            result.put("used_authorization_receipts", mapToJson(usedReceipts, UsedReceipt::toJson));
            return result;
        }

        static State fromJson(JSONObject object) throws JSONException {
            if (!hasExactKeysAllowNull(
                    object,
                    "version",
                    "installation_id",
                    "display_epoch",
                    "admission",
                    "mutation_phase",
                    "mutation_reason",
                    "session_marker",
                    "binding_generation",
                    "token_generation",
                    "next_launch_purge",
                    "local_privacy_barrier_failed",
                    "corrupt_state",
                    "foreground_banner_count",
                    "pending_fcm_token",
                    "local_notification_registry",
                    "data_only_handoffs",
                    "pending_taps",
                    "authorization_operations",
                    "used_authorization_receipts"
            )) {
                throw new JSONException("Invalid notification coordinator state.");
            }
            Long version = exactLong(object.opt("version"));
            String installationId = object.optString("installation_id", null);
            String displayEpoch = canonicalUint64(object.opt("display_epoch"));
            String admission = object.optString("admission", null);
            String mutationPhase = object.optString("mutation_phase", null);
            String mutationReason = nullableString(object.opt("mutation_reason"), 32);
            String sessionMarker = nullableString(object.opt("session_marker"), 64);
            String bindingGeneration = storedNonNegativeJsSafeInteger(object.opt("binding_generation"));
            String tokenGeneration = storedNonNegativeJsSafeInteger(object.opt("token_generation"));
            Object nextLaunchPurge = object.opt("next_launch_purge");
            Object barrierFailure = object.opt("local_privacy_barrier_failed");
            Object corrupt = object.opt("corrupt_state");
            Integer banners = nonNegativeInt(object.opt("foreground_banner_count"));
            String pendingToken = nullableString(object.opt("pending_fcm_token"), 4096);
            if (version == null || version != CoordinatorEngine.STATE_VERSION || !isUuid(installationId)
                    || displayEpoch == null || !validAdmission(admission) || !validMutationPhase(mutationPhase)
                    || !validMutationReason(mutationReason) || bindingGeneration == null || tokenGeneration == null
                    || !(nextLaunchPurge instanceof Boolean) || !(barrierFailure instanceof Boolean)
                    || !(corrupt instanceof Boolean) || banners == null || !validOptionalSessionMarker(sessionMarker)
                    || pendingToken != null && !isFcmToken(pendingToken)) {
                throw new JSONException("Invalid notification coordinator state.");
            }
            if (MUTATION_BOUND.equals(mutationPhase)
                    && (sessionMarker == null || !ADMISSION_OPEN.equals(admission)
                    || storedPositiveJsSafeInteger(bindingGeneration) == null
                    || storedPositiveJsSafeInteger(tokenGeneration) == null)) {
                throw new JSONException("Invalid bound notification coordinator state.");
            }
            if (!MUTATION_BOUND.equals(mutationPhase) && sessionMarker != null) {
                throw new JSONException("Unbound notification coordinator state retained a session marker.");
            }
            if (!hasValidMutationReceipt(mutationPhase, mutationReason)) {
                throw new JSONException("Invalid account mutation receipt state.");
            }
            if ((MUTATION_TERMINAL.equals(mutationPhase) || MUTATION_CORRUPT_FAILURE.equals(mutationPhase))
                    && ADMISSION_OPEN.equals(admission)) {
                throw new JSONException("Terminal coordinator state cannot admit display.");
            }
            return new State(installationId, displayEpoch, admission, mutationPhase, mutationReason, sessionMarker,
                    bindingGeneration, tokenGeneration, (Boolean) nextLaunchPurge,
                    (Boolean) barrierFailure, (Boolean) corrupt, banners, pendingToken,
                    parseRegistry(object.optJSONObject("local_notification_registry")),
                    parseHandoffs(object.optJSONObject("data_only_handoffs")),
                    parsePendingTaps(object.optJSONObject("pending_taps")),
                    parseOperations(object.optJSONObject("authorization_operations")),
                    parseUsedReceipts(object.optJSONObject("used_authorization_receipts")));
        }

        private interface JsonValueWriter<T> {
            JSONObject write(T value) throws JSONException;
        }

        private static <T> JSONObject mapToJson(Map<String, T> values, JsonValueWriter<T> writer)
                throws JSONException {
            JSONObject result = new JSONObject();
            for (Map.Entry<String, T> entry : values.entrySet()) {
                result.put(entry.getKey(), writer.write(entry.getValue()));
            }
            return result;
        }

        private static Map<String, RegistryEntry> parseRegistry(JSONObject object) throws JSONException {
            Map<String, RegistryEntry> result = new TreeMap<>();
            if (object == null || object.length() > CoordinatorEngine.MAX_NOTIFICATION_REGISTRY) {
                throw new JSONException("Invalid notification registry.");
            }
            Iterator<String> keys = object.keys();
            while (keys.hasNext()) {
                String deliveryId = keys.next();
                if (!isUuid(deliveryId)) {
                    throw new JSONException("Invalid notification registry key.");
                }
                result.put(deliveryId, RegistryEntry.fromJson(object.optJSONObject(deliveryId)));
            }
            return result;
        }

        private static Map<String, Handoff> parseHandoffs(JSONObject object) throws JSONException {
            Map<String, Handoff> result = new TreeMap<>();
            if (object == null || object.length() > CoordinatorEngine.MAX_PENDING_HANDOFFS) {
                throw new JSONException("Invalid data-only handoff registry.");
            }
            Iterator<String> keys = object.keys();
            while (keys.hasNext()) {
                String deliveryId = keys.next();
                if (!isUuid(deliveryId)) {
                    throw new JSONException("Invalid data-only handoff key.");
                }
                result.put(deliveryId, Handoff.fromJson(object.optJSONObject(deliveryId)));
            }
            return result;
        }

        private static Map<String, PendingTap> parsePendingTaps(JSONObject object) throws JSONException {
            Map<String, PendingTap> result = new TreeMap<>();
            if (object == null || object.length() > CoordinatorEngine.MAX_PENDING_TAPS) {
                throw new JSONException("Invalid pending tap registry.");
            }
            Iterator<String> keys = object.keys();
            while (keys.hasNext()) {
                String deliveryId = keys.next();
                if (!isUuid(deliveryId)) {
                    throw new JSONException("Invalid pending tap key.");
                }
                result.put(deliveryId, PendingTap.fromJson(object.optJSONObject(deliveryId)));
            }
            return result;
        }

        private static Map<String, Operation> parseOperations(JSONObject object) throws JSONException {
            Map<String, Operation> result = new TreeMap<>();
            if (object == null || object.length() > CoordinatorEngine.MAX_PENDING_OPERATIONS) {
                throw new JSONException("Invalid authorization operation registry.");
            }
            Iterator<String> keys = object.keys();
            while (keys.hasNext()) {
                String operationId = keys.next();
                result.put(operationId, Operation.fromJson(operationId, object.optJSONObject(operationId)));
            }
            return result;
        }

        private static Map<String, UsedReceipt> parseUsedReceipts(JSONObject object) throws JSONException {
            Map<String, UsedReceipt> result = new TreeMap<>();
            if (object == null || object.length() > CoordinatorEngine.MAX_USED_RECEIPTS) {
                throw new JSONException("Invalid used authorization receipt registry.");
            }
            Iterator<String> keys = object.keys();
            while (keys.hasNext()) {
                String authorizationId = keys.next();
                result.put(authorizationId, UsedReceipt.fromJson(authorizationId, object.optJSONObject(authorizationId)));
            }
            return result;
        }

        private static boolean validAdmission(String value) {
            return ADMISSION_OPEN.equals(value) || ADMISSION_CLOSING.equals(value) || ADMISSION_CLOSED.equals(value);
        }

        private static boolean validMutationPhase(String value) {
            return MUTATION_UNBOUND.equals(value) || MUTATION_BOUND.equals(value)
                    || MUTATION_AWAITING_FINALIZE.equals(value) || MUTATION_READY_FOR_RELOGIN.equals(value)
                    || MUTATION_READY_FOR_REBIND.equals(value) || MUTATION_DORMANT_REBIND.equals(value)
                    || MUTATION_TERMINAL.equals(value) || MUTATION_CORRUPT_FAILURE.equals(value);
        }

        private static boolean validMutationReason(String value) {
            return value == null || REASON_ACCOUNT_SWITCH.equals(value) || "logout".equals(value)
                    || "deletion".equals(value);
        }
        static boolean isCompletedMutationPhase(String value) {
            return MUTATION_READY_FOR_RELOGIN.equals(value) || MUTATION_READY_FOR_REBIND.equals(value)
                    || MUTATION_TERMINAL.equals(value);
        }

        static boolean hasDurableMutationReceipt(String phase, String reason) {
            return (MUTATION_AWAITING_FINALIZE.equals(phase) || isCompletedMutationPhase(phase))
                    && hasValidMutationReceipt(phase, reason);
        }
        private static boolean hasValidMutationReceipt(String phase, String reason) {
            if (!validMutationReason(reason)) {
                return false;
            }
            if (MUTATION_AWAITING_FINALIZE.equals(phase)) {
                return reason != null;
            }
            if (MUTATION_READY_FOR_RELOGIN.equals(phase)) {
                return "logout".equals(reason);
            }
            if (MUTATION_READY_FOR_REBIND.equals(phase)) {
                return REASON_ACCOUNT_SWITCH.equals(reason);
            }
            if (MUTATION_TERMINAL.equals(phase)) {
                return "deletion".equals(reason);
            }
            return reason == null;
        }
    }

    private static final class ZeroCounts {
        final int pendingCount;
        final int deliveredCount;
        final int foregroundBannerCount;
        final int registryCount;
        final int inflightCount;

        ZeroCounts(
                int pendingCount,
                int deliveredCount,
                int foregroundBannerCount,
                int registryCount,
                int inflightCount
        ) {
            this.pendingCount = pendingCount;
            this.deliveredCount = deliveredCount;
            this.foregroundBannerCount = foregroundBannerCount;
            this.registryCount = registryCount;
            this.inflightCount = inflightCount;
        }

        boolean isZero() {
            return pendingCount == 0 && deliveredCount == 0 && foregroundBannerCount == 0
                    && registryCount == 0 && inflightCount == 0;
        }

        JSObject toJson() {
            JSObject result = new JSObject();
            result.put("pending_count", pendingCount);
            result.put("delivered_count", deliveredCount);
            result.put("foreground_banner_count", foregroundBannerCount);
            result.put("registry_count", registryCount);
            result.put("inflight_count", inflightCount);
            return result;
        }
    }

    private static final class StateLoadResult {
        static final int MISSING = 0;
        static final int VALID = 1;
        static final int CORRUPT = 2;
        final int kind;
        final State state;

        StateLoadResult(int kind, State state) {
            this.kind = kind;
            this.state = state;
        }
    }

    /** AES-GCM state and credential store. This preference file is excluded from all backup paths. */
    private static final class EncryptedStateStore {
        private static final String PREFERENCES = "zerotime.notification-coordinator";
        private static final String STATE_KEY = "encrypted-state-v3";
        private static final String LEGACY_STATE_KEY_V2 = "encrypted-state-v2";
        private static final String LEGACY_STATE_KEY_V1 = "encrypted-state-v1";
        private static final String CREDENTIAL_KEY_PREFIX = "encrypted-credential-v1.";
        private static final String KEYSTORE = "AndroidKeyStore";
        private static final String KEY_ALIAS = "zerotime.notification-coordinator.aes-v1";
        private static final String SESSION_MARKER_KEY_ALIAS = "zerotime.notification-coordinator.hmac-v1";
        private static final int GCM_IV_BYTES = 12;
        private static final int GCM_TAG_BYTES = 16;
        private static final int MAX_CREDENTIAL_BYTES = 65_536;
        private static final int MAX_ENCRYPTED_CREDENTIAL_CHARS =
                4 * ((MAX_CREDENTIAL_BYTES + GCM_IV_BYTES + GCM_TAG_BYTES + 2) / 3);
        private static final SecureRandom RANDOM = new SecureRandom();
        private final SharedPreferences preferences;

        EncryptedStateStore(Context context) {
            preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
        }

        StateLoadResult load() {
            return load(true);
        }

        StateLoadResult loadReadOnly() {
            return load(false);
        }

        private StateLoadResult load(boolean createSecretKey) {
            String serialized;
            try {
                serialized = preferences.getString(STATE_KEY, null);
                if (serialized == null && (preferences.contains(LEGACY_STATE_KEY_V2)
                        || preferences.contains(LEGACY_STATE_KEY_V1))) {
                    return new StateLoadResult(StateLoadResult.CORRUPT, null);
                }
            } catch (ClassCastException exception) {
                return new StateLoadResult(StateLoadResult.CORRUPT, null);
            }
            if (serialized == null) {
                return new StateLoadResult(StateLoadResult.MISSING, null);
            }
            try {
                return new StateLoadResult(
                        StateLoadResult.VALID,
                        State.fromJson(new JSONObject(decrypt(serialized, null, createSecretKey)))
                );
            } catch (GeneralSecurityException | JSONException | RuntimeException exception) {
                return new StateLoadResult(StateLoadResult.CORRUPT, null);
            }
        }

        void save(State state) throws GeneralSecurityException, JSONException {
            String encrypted = encrypt(state.toJson().toString());
            if (!preferences.edit().putString(STATE_KEY, encrypted)
                    .remove(LEGACY_STATE_KEY_V2)
                    .remove(LEGACY_STATE_KEY_V1)
                    .commit()) {
                throw new GeneralSecurityException("Unable to persist notification coordinator state.");
            }
        }

        boolean markerStorageAvailable() {
            try {
                getOrCreateSecretKey();
                return true;
            } catch (GeneralSecurityException | RuntimeException exception) {
                return false;
            }
        }

        String loadCredential(String key) throws GeneralSecurityException {
            String serialized;
            try {
                serialized = preferences.getString(credentialPreferenceKey(key), null);
            } catch (ClassCastException exception) {
                throw new GeneralSecurityException("Invalid secure credential.", exception);
            }
            if (serialized == null) {
                return null;
            }
            if (serialized.length() > MAX_ENCRYPTED_CREDENTIAL_CHARS) {
                throw new GeneralSecurityException("Invalid secure credential.");
            }
            String value = decrypt(serialized, credentialAad(key));
            if (!isSecureCredentialValue(value)) {
                throw new GeneralSecurityException("Invalid secure credential.");
            }
            return value;
        }

        void saveCredential(String key, String value) throws GeneralSecurityException {
            if (!isSecureCredentialValue(value)) {
                throw new GeneralSecurityException("Invalid secure credential.");
            }
            String encrypted = encrypt(value, credentialAad(key));
            if (!preferences.edit().putString(credentialPreferenceKey(key), encrypted).commit()) {
                throw new GeneralSecurityException("Unable to persist secure credential.");
            }
        }

        void removeCredential(String key) throws GeneralSecurityException {
            if (!preferences.edit().remove(credentialPreferenceKey(key)).commit()) {
                throw new GeneralSecurityException("Unable to remove secure credential.");
            }
        }

        /** Removes authentication credentials without deleting lifecycle or recovery records. */
        void wipeAuthenticationCredentials() throws GeneralSecurityException {
            if (!preferences.edit()
                    .remove(credentialPreferenceKey("zerotime.native-auth.refresh.v1"))
                    .remove(credentialPreferenceKey("zerotime.native-auth.session.v1"))
                    .remove(credentialPreferenceKey("zerotime.native-auth.transient.v1"))
                    .commit()) {
                throw new GeneralSecurityException("Unable to wipe authentication credentials.");
            }
        }

        String sessionMarker(String sessionId) throws GeneralSecurityException {
            if (!isUuid(sessionId)) {
                throw new GeneralSecurityException("Invalid native session identifier.");
            }
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(getOrCreateSessionMarkerKey());
            return Base64.encodeToString(
                    mac.doFinal(sessionId.getBytes(StandardCharsets.UTF_8)),
                    Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING
            );
        }

        private static String credentialPreferenceKey(String key) {
            return CREDENTIAL_KEY_PREFIX + key;
        }

        private static byte[] credentialAad(String key) {
            return credentialPreferenceKey(key).getBytes(StandardCharsets.UTF_8);
        }

        private String encrypt(String cleartext) throws GeneralSecurityException {
            return encrypt(cleartext, null);
        }

        private String encrypt(String cleartext, byte[] additionalData) throws GeneralSecurityException {
            byte[] iv = new byte[GCM_IV_BYTES];
            RANDOM.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, getOrCreateSecretKey(), new GCMParameterSpec(128, iv));
            if (additionalData != null) {
                cipher.updateAAD(additionalData);
            }
            byte[] ciphertext = cipher.doFinal(cleartext.getBytes(StandardCharsets.UTF_8));
            byte[] encoded = new byte[iv.length + ciphertext.length];
            System.arraycopy(iv, 0, encoded, 0, iv.length);
            System.arraycopy(ciphertext, 0, encoded, iv.length, ciphertext.length);
            return Base64.encodeToString(encoded, Base64.NO_WRAP);
        }

        private String decrypt(String encoded) throws GeneralSecurityException {
            return decrypt(encoded, null, true);
        }

        private String decrypt(String encoded, byte[] additionalData) throws GeneralSecurityException {
            return decrypt(encoded, additionalData, true);
        }

        private String decrypt(String encoded, byte[] additionalData, boolean createSecretKey)
                throws GeneralSecurityException {
            byte[] combined = Base64.decode(encoded, Base64.NO_WRAP);
            if (combined.length <= GCM_IV_BYTES) {
                throw new GeneralSecurityException("Invalid encrypted state.");
            }
            byte[] iv = new byte[GCM_IV_BYTES];
            byte[] ciphertext = new byte[combined.length - GCM_IV_BYTES];
            System.arraycopy(combined, 0, iv, 0, iv.length);
            System.arraycopy(combined, iv.length, ciphertext, 0, ciphertext.length);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(
                    Cipher.DECRYPT_MODE,
                    createSecretKey ? getOrCreateSecretKey() : getExistingSecretKey(),
                    new GCMParameterSpec(128, iv)
            );
            if (additionalData != null) {
                cipher.updateAAD(additionalData);
            }
            return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
        }

        private SecretKey getOrCreateSecretKey() throws GeneralSecurityException {
            return getSecretKey(true);
        }

        private SecretKey getExistingSecretKey() throws GeneralSecurityException {
            return getSecretKey(false);
        }

        private SecretKey getSecretKey(boolean createIfMissing) throws GeneralSecurityException {
            KeyStore keyStore = KeyStore.getInstance(KEYSTORE);
            try {
                keyStore.load(null);
            } catch (Exception exception) {
                throw new GeneralSecurityException("Unable to load Android Keystore.", exception);
            }
            if (!keyStore.containsAlias(KEY_ALIAS)) {
                if (!createIfMissing) {
                    throw new GeneralSecurityException("Notification coordinator key is unavailable.");
                }
                KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE);
                generator.init(new KeyGenParameterSpec.Builder(
                        KEY_ALIAS,
                        KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
                )
                        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                        .setKeySize(256)
                        .setRandomizedEncryptionRequired(true)
                        .setUserAuthenticationRequired(false)
                        .build());
                generator.generateKey();
            }
            Key key = keyStore.getKey(KEY_ALIAS, null);
            if (!(key instanceof SecretKey)) {
                throw new GeneralSecurityException("Android Keystore returned an invalid credential key.");
            }
            return (SecretKey) key;
        }
        private SecretKey getOrCreateSessionMarkerKey() throws GeneralSecurityException {
            KeyStore keyStore = KeyStore.getInstance(KEYSTORE);
            try {
                keyStore.load(null);
            } catch (Exception exception) {
                throw new GeneralSecurityException("Unable to load Android Keystore.", exception);
            }
            if (!keyStore.containsAlias(SESSION_MARKER_KEY_ALIAS)) {
                KeyGenerator generator = KeyGenerator.getInstance(
                        KeyProperties.KEY_ALGORITHM_HMAC_SHA256,
                        KEYSTORE
                );
                generator.init(new KeyGenParameterSpec.Builder(
                        SESSION_MARKER_KEY_ALIAS,
                        KeyProperties.PURPOSE_SIGN | KeyProperties.PURPOSE_VERIFY
                )
                        .setDigests(KeyProperties.DIGEST_SHA256)
                        .build());
                generator.generateKey();
            }
            Key key = keyStore.getKey(SESSION_MARKER_KEY_ALIAS, null);
            if (!(key instanceof SecretKey)) {
                throw new GeneralSecurityException("Android Keystore returned an invalid session marker key.");
            }
            return (SecretKey) key;
        }
    }

    private static boolean isUuid(String value) {
        return value != null && CoordinatorEngine.UUID_PATTERN.matcher(value).matches();
    }

    private static boolean validOptionalSessionMarker(String value) {
        return value == null || validSessionMarker(value);
    }

    private static boolean validSessionMarker(String value) {
        return value != null && value.length() == 43 && value.matches("^[A-Za-z0-9_-]{43}$");
    }

    private static String canonicalUint64(Object value) {
        if (!(value instanceof String)) {
            return null;
        }
        String text = (String) value;
        if (!CoordinatorEngine.UINT64_PATTERN.matcher(text).matches()) {
            return null;
        }
        try {
            return new BigInteger(text).compareTo(CoordinatorEngine.MAX_UINT64) <= 0 ? text : null;
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private static String positiveJsSafeInteger(Object value) {
        Long parsed = exactLong(value);
        if (parsed == null || parsed <= 0 || parsed > CoordinatorEngine.MAX_JS_SAFE_INTEGER) {
            return null;
        }
        return Long.toString(parsed);
    }
    private static String nonNegativeJsSafeInteger(Object value) {
        Long parsed = exactLong(value);
        if (parsed == null || parsed < 0 || parsed > CoordinatorEngine.MAX_JS_SAFE_INTEGER) {
            return null;
        }
        return Long.toString(parsed);
    }


    private static String storedNonNegativeJsSafeInteger(Object value) {
        if (!(value instanceof String)) {
            return null;
        }
        String text = (String) value;
        if (!CoordinatorEngine.UINT64_PATTERN.matcher(text).matches()) {
            return null;
        }
        try {
            long parsed = Long.parseLong(text);
            return parsed <= CoordinatorEngine.MAX_JS_SAFE_INTEGER ? text : null;
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private static String storedPositiveJsSafeInteger(Object value) {
        String parsed = storedNonNegativeJsSafeInteger(value);
        return parsed == null || "0".equals(parsed) ? null : parsed;
    }



    private static Long exactLong(Object value) {
        if (!(value instanceof Number)) {
            return null;
        }
        double numeric = ((Number) value).doubleValue();
        if (!Double.isFinite(numeric) || numeric != Math.rint(numeric)
                || numeric < Long.MIN_VALUE || numeric > Long.MAX_VALUE) {
            return null;
        }
        long parsed = ((Number) value).longValue();
        return (double) parsed == numeric ? parsed : null;
    }
    private static String canonicalPositiveIntegerString(String value) {
        if (value == null || !CoordinatorEngine.NOTICE_ID_PATTERN.matcher(value).matches()) {
            return null;
        }
        try {
            BigInteger parsed = new BigInteger(value);
            return parsed.signum() > 0 && parsed.compareTo(BigInteger.valueOf(CoordinatorEngine.MAX_JS_SAFE_INTEGER)) <= 0
                    && value.equals(parsed.toString()) ? value : null;
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private static String canonicalPositiveJsonInteger(Object value) {
        Long parsed = exactLong(value);
        return parsed == null || parsed <= 0 || parsed > CoordinatorEngine.MAX_JS_SAFE_INTEGER
                ? null : Long.toString(parsed);
    }

    private static boolean hasExactKeys(JSONObject object, String... names) {
        if (object == null || object.length() != names.length) {
            return false;
        }
        for (String name : names) {
            if (!object.has(name) || object.isNull(name)) {
                return false;
            }
        }
        return true;
    }
    private static boolean hasExactKeysAllowNull(JSONObject object, String... names) {
        if (object == null || object.length() != names.length) {
            return false;
        }
        for (String name : names) {
            if (!object.has(name)) {
                return false;
            }
        }
        return true;
    }


    private static Integer positiveNotificationId(Object value) {
        Long parsed = exactLong(value);
        if (parsed == null || parsed <= 0 || parsed > CoordinatorEngine.MAX_NOTIFICATION_ID) {
            return null;
        }
        return parsed.intValue();
    }

    private static Integer nonNegativeInt(Object value) {
        Long parsed = exactLong(value);
        if (parsed == null || parsed < 0 || parsed > Integer.MAX_VALUE) {
            return null;
        }
        return parsed.intValue();
    }

    private static String boundedString(Object value, int maxLength) {
        if (!(value instanceof String)) {
            return null;
        }
        String text = (String) value;
        return text.isEmpty() || text.length() > maxLength || !text.equals(text.trim()) ? null : text;
    }

    private static String publicNotificationTitle(Object value) {
        if (!(value instanceof String)) {
            return null;
        }
        String title = (String) value;
        BreakIterator characterIterator = BreakIterator.getCharacterInstance(Locale.ROOT);
        characterIterator.setText(title);
        int characterCount = 0;
        boolean hasNonWhitespace = false;
        for (int boundary = characterIterator.first();
                (boundary = characterIterator.next()) != BreakIterator.DONE;) {
            if (++characterCount > 512) {
                return null;
            }
        }
        for (int index = 0; index < title.length();) {
            int codePoint = title.codePointAt(index);
            if (Character.isISOControl(codePoint)) {
                return null;
            }
            if (!Character.isWhitespace(codePoint) && !Character.isSpaceChar(codePoint)) {
                hasNonWhitespace = true;
            }
            index += Character.charCount(codePoint);
        }
        return hasNonWhitespace ? title : null;
    }
    private static String nullableString(Object value, int maxLength) {
        return value == null || value == JSONObject.NULL ? null : boundedString(value, maxLength);
    }

    private static String opaqueId(Object value) {
        return value instanceof String && CoordinatorEngine.OPAQUE_ID_PATTERN.matcher((String) value).matches() ? (String) value : null;
    }
    private static String authorizationBearer(Object value) {
        String bearer = boundedString(value, 8192);
        if (bearer == null || !bearer.startsWith("Bearer ") || bearer.length() == "Bearer ".length()) {
            return null;
        }
        String token = bearer.substring("Bearer ".length());
        for (int index = 0; index < token.length(); index++) {
            if (Character.isWhitespace(token.charAt(index)) || Character.isISOControl(token.charAt(index))) {
                return null;
            }
        }
        return bearer;
    }

    private static String mutationReason(Object value) {
        if (!(value instanceof String)) {
            return null;
        }
        String reason = (String) value;
        return "logout".equals(reason) || State.REASON_ACCOUNT_SWITCH.equals(reason) || "deletion".equals(reason)
                ? reason : null;
    }

    private static String abortReason(Object value) {
        if (!(value instanceof String)) {
            return null;
        }
        String reason = (String) value;
        return "denied".equals(reason) || "invalid_authorization".equals(reason)
                || "expired_authorization".equals(reason) || "transport_failed".equals(reason)
                || "native_failed".equals(reason) || "stale_operation".equals(reason) ? reason : null;
    }

    private static Long parseUtcMillis(String value) {
        if (value == null) {
            return null;
        }
        Matcher match = CoordinatorEngine.UTC_PATTERN.matcher(value);
        if (!match.matches()) {
            return null;
        }
        String fraction = match.group(2);
        String normalized = match.group(1) + "." + (fraction == null ? "000" : (fraction + "000").substring(0, 3)) + "Z";
        SimpleDateFormat parser = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        parser.setLenient(false);
        parser.setTimeZone(TimeZone.getTimeZone("UTC"));
        try {
            Date parsed = parser.parse(normalized);
            return parsed == null ? null : parsed.getTime();
        } catch (ParseException exception) {
            return null;
        }
    }

    private static boolean isFcmToken(String token) {
        return token != null && token.length() > 0 && token.length() <= 4096 && token.equals(token.trim());
    }

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


    private static boolean isSecureCredentialValue(String value) {
        return value != null && !value.isEmpty()
                && value.getBytes(StandardCharsets.UTF_8).length <= EncryptedStateStore.MAX_CREDENTIAL_BYTES;
    }
}
