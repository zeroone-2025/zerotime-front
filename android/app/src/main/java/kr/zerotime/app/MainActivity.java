package kr.zerotime.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Set;

public class MainActivity extends BridgeActivity {
    private static final int MAX_CALLBACK_QUERY_BYTES = 2_048;
    private static final int MAX_OAUTH_CODE_BYTES = 512;
    private static final int MAX_OAUTH_ERROR_BYTES = 128;
    private static final int MAX_OAUTH_ERROR_DESCRIPTION_BYTES = 1_024;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        Intent incoming = getIntent();
        Intent notificationTap = notificationTapIntent(incoming);
        if (notificationTap != null) {
            NativeNotificationCoordinatorPlugin.quarantineColdNotificationTap(
                    getApplicationContext(),
                    notificationTap
            );
        }
        if (!NativeNotificationCoordinatorPlugin.runUiColdLaunchPreflight(
                getApplicationContext()
        )) {
            throw new IllegalStateException("ZeroTime notification privacy check failed.");
        }
        registerPlugin(NativeNotificationCoordinatorPlugin.class);

        Intent bridgeIntent = bridgeIntent(incoming);
        setIntent(bridgeIntent);
        super.onCreate(savedInstanceState);
        this.bridge.getWebView().post(() -> {
            WebSettings settings = this.bridge.getWebView().getSettings();
            settings.setDomStorageEnabled(true);
            settings.setMixedContentMode(
                    this.bridge.getConfig().isMixedContentAllowed()
                            ? WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                            : WebSettings.MIXED_CONTENT_NEVER_ALLOW
            );
        });
    }

    @Override
    protected void onNewIntent(Intent intent) {
        Intent bridgeIntent = bridgeIntent(intent);
        Intent notificationTap = notificationTapIntent(intent);
        super.onNewIntent(bridgeIntent);
        setIntent(bridgeIntent);
        if (notificationTap != null) {
            NativeNotificationCoordinatorPlugin.handleNotificationTap(getApplicationContext(), notificationTap);
        }
    }

    static Intent sanitizedLaunchIntent(Context context, Intent incoming) {
        Intent destination = new Intent(context, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        Uri callback = verifiedNativeCallback(incoming);
        if (callback != null) {
            destination.setAction(Intent.ACTION_VIEW);
            destination.setData(callback);
            return destination;
        }

        Intent notificationTap = notificationTapIntent(incoming);
        if (notificationTap != null) {
            destination.setAction(notificationTap.getAction());
            destination.putExtras(notificationTap);
        }
        return destination;
    }

    private Intent bridgeIntent(Intent incoming) {
        Uri callback = verifiedNativeCallback(incoming);
        if (callback == null) {
            return new Intent();
        }
        return new Intent(Intent.ACTION_VIEW, callback);
    }


    private static Intent notificationTapIntent(Intent intent) {
        if (intent == null
                || !NativeNotificationCoordinatorPlugin.ACTION_NOTIFICATION_TAP.equals(intent.getAction())
                || intent.getData() != null
                || intent.getType() != null
                || (intent.getCategories() != null && !intent.getCategories().isEmpty())) {
            return null;
        }

        try {
            Bundle extras = intent.getExtras();
            if (extras == null
                    || extras.size() != 3
                    || !extras.keySet().contains(NativeNotificationCoordinatorPlugin.EXTRA_DELIVERY_ID)
                    || !extras.keySet().contains(NativeNotificationCoordinatorPlugin.EXTRA_NOTICE_ID)
                    || !extras.keySet().contains(NativeNotificationCoordinatorPlugin.EXTRA_DISPLAY_EPOCH)) {
                return null;
            }
            Object deliveryID = extras.get(NativeNotificationCoordinatorPlugin.EXTRA_DELIVERY_ID);
            Object noticeID = extras.get(NativeNotificationCoordinatorPlugin.EXTRA_NOTICE_ID);
            Object displayEpoch = extras.get(NativeNotificationCoordinatorPlugin.EXTRA_DISPLAY_EPOCH);
            if (!(deliveryID instanceof String)
                    || !(noticeID instanceof String)
                    || !(displayEpoch instanceof String)) {
                return null;
            }
            return new Intent(NativeNotificationCoordinatorPlugin.ACTION_NOTIFICATION_TAP)
                    .putExtra(NativeNotificationCoordinatorPlugin.EXTRA_DELIVERY_ID, (String) deliveryID)
                    .putExtra(NativeNotificationCoordinatorPlugin.EXTRA_NOTICE_ID, (String) noticeID)
                    .putExtra(NativeNotificationCoordinatorPlugin.EXTRA_DISPLAY_EPOCH, (String) displayEpoch);
        } catch (RuntimeException exception) {
            return null;
        }
    }

    private static Uri verifiedNativeCallback(Intent intent) {
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction()) || intent.getType() != null) {
            return null;
        }

        Uri callback = intent.getData();
        if (callback == null) {
            return null;
        }

        try {
            if (!callback.isHierarchical()
                    || !"https".equals(callback.getScheme())
                    || !"zerotime.kr".equals(callback.getEncodedAuthority())
                    || !"zerotime.kr".equals(callback.getHost())
                    || callback.getPort() != -1
                    || callback.getEncodedUserInfo() != null
                    || callback.getEncodedFragment() != null
                    || !"/auth/native/callback/".equals(callback.getEncodedPath())) {
                return null;
            }

            String encodedQuery = callback.getEncodedQuery();
            if (encodedQuery == null
                    || encodedQuery.getBytes(StandardCharsets.UTF_8).length > MAX_CALLBACK_QUERY_BYTES) {
                return null;
            }

            Set<String> names = callback.getQueryParameterNames();
            if (names.size() > 4
                    || !names.contains("state")
                    || !onlyNativeCallbackParameters(names)) {
                return null;
            }

            List<String> states = callback.getQueryParameters("state");
            List<String> codes = callback.getQueryParameters("code");
            List<String> errors = callback.getQueryParameters("error");
            List<String> descriptions = callback.getQueryParameters("error_description");
            if (states.size() != 1
                    || codes.size() > 1
                    || errors.size() > 1
                    || descriptions.size() > 1
                    || !isOpaqueState(states.get(0))) {
                return null;
            }

            Uri.Builder sanitized = new Uri.Builder()
                    .scheme("https")
                    .authority("zerotime.kr")
                    .path("/auth/native/callback/")
                    .appendQueryParameter("state", states.get(0));
            if (codes.size() == 1
                    && errors.isEmpty()
                    && descriptions.isEmpty()
                    && isBounded(codes.get(0), 32, MAX_OAUTH_CODE_BYTES, false)) {
                return sanitized.appendQueryParameter("code", codes.get(0)).build();
            }
            if (errors.size() == 1
                    && codes.isEmpty()
                    && isBounded(errors.get(0), 1, MAX_OAUTH_ERROR_BYTES, true)
                    && (descriptions.isEmpty()
                    || isBounded(descriptions.get(0), 1, MAX_OAUTH_ERROR_DESCRIPTION_BYTES, true))) {
                if (!descriptions.isEmpty()) {
                    sanitized.appendQueryParameter("error_description", descriptions.get(0));
                }
                return sanitized.appendQueryParameter("error", errors.get(0)).build();
            }
            return null;
        } catch (RuntimeException exception) {
            return null;
        }
    }

    private static boolean onlyNativeCallbackParameters(Set<String> names) {
        for (String name : names) {
            if (!"code".equals(name)
                    && !"state".equals(name)
                    && !"error".equals(name)
                    && !"error_description".equals(name)) {
                return false;
            }
        }
        return true;
    }

    private static boolean isOpaqueState(String value) {
        if (!isBounded(value, 43, 128, false)) {
            return false;
        }
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            if (!((character >= 'A' && character <= 'Z')
                    || (character >= 'a' && character <= 'z')
                    || (character >= '0' && character <= '9')
                    || character == '-'
                    || character == '_')) {
                return false;
            }
        }
        return true;
    }

    private static boolean isBounded(String value, int minimumBytes, int maximumBytes, boolean nonBlank) {
        if (value == null) {
            return false;
        }
        int length = value.getBytes(StandardCharsets.UTF_8).length;
        return length >= minimumBytes
                && length <= maximumBytes
                && (!nonBlank || !value.trim().isEmpty());
    }
}
