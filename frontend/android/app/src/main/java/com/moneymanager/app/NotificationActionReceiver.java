package com.moneymanager.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import androidx.core.app.NotificationManagerCompat;

/** Handles the "Pay now" notification action: launches the user's UPI app (GPay etc.) directly
 *  with the pay link, without ever opening Money Manager. Nothing else needs a receiver — "Paid"
 *  and "View" both just open the app via a plain Activity PendingIntent in
 *  MyFirebaseMessagingService. */
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
        if (payUrl == null) return;
        try {
            Intent upiIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(payUrl));
            upiIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(upiIntent);
        } catch (Exception ignored) {
            // No UPI app installed, or the link was malformed — nothing to recover to from a
            // background receiver with no UI of its own.
        }
    }
}
