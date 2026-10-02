package com.moneymanager.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import androidx.core.app.NotificationManagerCompat;

/** "Pay now" on a notification: open UPI with an opaque URI (keeps @ intact). */
public class NotificationActionReceiver extends BroadcastReceiver {

    public static final String ACTION_PAY = "com.moneymanager.app.ACTION_PAY";

    @Override
    public void onReceive(Context context, Intent intent) {
        int notificationId = intent.getIntExtra("notificationId", -1);
        String tag = intent.getStringExtra("notificationTag");
        if (tag != null && !tag.isEmpty() && notificationId != -1) {
            NotificationManagerCompat.from(context).cancel(tag, notificationId);
        } else if (notificationId != -1) {
            NotificationManagerCompat.from(context).cancel(notificationId);
        }
        String payUrl = intent.getStringExtra("payUrl");
        if (payUrl == null || payUrl.isBlank()) return;
        try {
            String clean = UpiLauncherPlugin.rebuildCleanUpiUrl(payUrl.trim());
            Uri uri = UpiLauncherPlugin.uriFromCleanUpi(clean);
            Intent view = new Intent(Intent.ACTION_VIEW, uri);
            view.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            // Prefer GPay tez:// when possible
            try {
                String q = clean.substring(clean.indexOf('?') + 1);
                Intent tez = new Intent(Intent.ACTION_VIEW, Uri.parse("tez://upi/pay?" + q));
                tez.setPackage("com.google.android.apps.nbu.paisa.user");
                tez.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(tez);
                return;
            } catch (Exception ignored) { }
            context.startActivity(Intent.createChooser(view, "Pay with UPI"));
        } catch (Exception ignored) {
            // No UPI app / bad link
        }
    }
}
