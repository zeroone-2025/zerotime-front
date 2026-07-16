package kr.zerotime.app;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.widget.TextView;

public class LaunchGateActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        continueLaunch(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        continueLaunch(intent);
    }

    private void continueLaunch(Intent incoming) {
        Intent sanitized = MainActivity.sanitizedLaunchIntent(this, incoming);
        NativeNotificationCoordinatorPlugin.quarantineColdNotificationTap(
                getApplicationContext(),
                sanitized
        );
        if (!NativeNotificationCoordinatorPlugin.runUiColdLaunchPreflight(
                getApplicationContext()
        )) {
            showRecovery();
            return;
        }
        startActivity(sanitized);
        finish();
    }

    private void showRecovery() {
        TextView failure = new TextView(this);
        failure.setText("ZeroTime notification privacy check failed.");
        setContentView(failure);
    }
}
