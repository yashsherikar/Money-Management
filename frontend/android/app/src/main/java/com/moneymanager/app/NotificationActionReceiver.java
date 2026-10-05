package com.moneymanager.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import androidx.core.app.NotificationManagerCompat;

/** "Pay now" on a notification: open UPI with a standard hierarchical URI. */
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
            // Standard hierarchical URI (host="pay") — an opaque Uri.fromParts has no host at
            // all, so it can't match any UPI app's registered intent-filter. That mismatch is
            // what was silently breaking this for every app, not just GPay.
            Uri uri = Uri.parse(clean);
            Intent view = new Intent(Intent.ACTION_VIEW, uri);
            view.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            String q = clean.substring(clean.indexOf('?') + 1);
            Intent tez = new Intent(Intent.ACTION_VIEW, Uri.parse("tez://upi/pay?" + q));
            tez.setPackage("com.google.android.apps.nbu.paisa.user");
            tez.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (tez.resolveActivity(context.getPackageManager()) != null) {
                context.startActivity(tez);
                return;
            }
            context.startActivity(Intent.createChooser(view, "Pay with UPI"));
        } catch (Exception ignored) {
            // No UPI app / bad link
        }
    }
}
