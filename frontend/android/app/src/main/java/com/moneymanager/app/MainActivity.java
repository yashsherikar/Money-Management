package com.moneymanager.app;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        deliverNotificationUrl(getIntent());
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        deliverNotificationUrl(intent);
    }

    /** Set by MyFirebaseMessagingService's PendingIntents (tapping the notification body, or its
     *  "Paid"/"View" buttons). Pushed into the WebView as a plain DOM event once the page has had
     *  a moment to load and register its listener — see mm-notification-tap in main.jsx. */
    private void deliverNotificationUrl(Intent intent) {
        if (intent == null) return;
        String url = intent.getStringExtra("notificationUrl");
        if (url == null) return;
        intent.removeExtra("notificationUrl");
        String escaped = url.replace("\\", "\\\\").replace("'", "\\'");
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().evaluateJavascript(
                        "window.dispatchEvent(new CustomEvent('mm-notification-tap', { detail: { url: '" + escaped + "' } }));",
                        null
                );
            }
        }, 1500);
    }
}
