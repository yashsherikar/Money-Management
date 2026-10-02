package com.moneymanager.app;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

/**
 * Reads GPay / PhonePe payment notifications (user must enable Notification Access).
 * Raw title/text is forwarded to JS for parsing — formats vary by app version.
 */
public class UpiPaymentNotificationListener extends NotificationListenerService {

    private static final String GPAY = "com.google.android.apps.nbu.paisa.user";
    private static final String PHONEPE = "com.phonepe.app";
    private static final String PAYTM = "net.one97.paytm";

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null) return;
        String pkg = sbn.getPackageName();
        if (pkg == null) return;
        if (!GPAY.equals(pkg) && !PHONEPE.equals(pkg) && !PAYTM.equals(pkg)) return;

        Notification n = sbn.getNotification();
        if (n == null) return;
        Bundle extras = n.extras;
        if (extras == null) return;

        CharSequence titleCs = extras.getCharSequence(Notification.EXTRA_TITLE);
        CharSequence textCs = extras.getCharSequence(Notification.EXTRA_TEXT);
        CharSequence bigCs = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);

        String title = titleCs == null ? "" : titleCs.toString();
        String text = textCs == null ? "" : textCs.toString();
        if (bigCs != null && bigCs.length() > text.length()) {
            text = bigCs.toString();
        }

        // Ignore empty / non-payment-looking noise lightly on native side
        String blob = (title + " " + text).toLowerCase();
        if (blob.isBlank()) return;
        if (!(blob.contains("paid") || blob.contains("sent") || blob.contains("payment")
                || blob.contains("₹") || blob.contains("rs") || blob.contains("upi"))) {
            return;
        }

        PaymentNotifyPlugin.onUpiNotification(pkg, title, text);
    }
}
