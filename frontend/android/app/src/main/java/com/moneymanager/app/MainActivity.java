package com.moneymanager.app;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(UpiLauncherPlugin.class);
        super.onCreate(savedInstanceState);
        deliverNotificationTap(getIntent());
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        deliverNotificationTap(intent);
    }

    /** FCM notification taps (body, Paid, or View) → WebView mm-notification-tap event. */
    private void deliverNotificationTap(Intent intent) {
        if (intent == null) return;
        String url = intent.getStringExtra("notificationUrl");
        if (url == null) return;

        boolean paid = intent.getBooleanExtra("notificationPaid", false);
        String relatedType = intent.getStringExtra("relatedType");
        String relatedId = intent.getStringExtra("relatedId");

        intent.removeExtra("notificationUrl");
        intent.removeExtra("notificationPaid");
        intent.removeExtra("relatedType");
        intent.removeExtra("relatedId");

        String js = buildTapEventJs(url, paid, relatedType, relatedId);
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().evaluateJavascript(js, null);
            }
        }, 1500);
    }

    private static String jsString(String value) {
        if (value == null) return "null";
        return "'" + value.replace("\\", "\\\\").replace("'", "\\'") + "'";
    }

    private static String buildTapEventJs(String url, boolean paid, String relatedType, String relatedId) {
        StringBuilder detail = new StringBuilder("{ url: ");
        detail.append(jsString(url));
        detail.append(", paid: ").append(paid ? "true" : "false");
        if (relatedType != null) {
            detail.append(", relatedType: ").append(jsString(relatedType));
        }
        if (relatedId != null) {
            detail.append(", relatedId: ").append(jsString(relatedId));
        }
        detail.append(" }");
        return "window.dispatchEvent(new CustomEvent('mm-notification-tap', { detail: " + detail + " }));";
    }
}
