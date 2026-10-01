package com.moneymanager.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * Replaces Capacitor's default MessagingService (removed in AndroidManifest.xml — only one
 * FirebaseMessagingService can exist per app) so every push is built here with the right action
 * buttons, in every app state. Messages from PushService.java on the backend are data-only (no
 * "notification" payload), which is what makes this always run: a "notification" payload gets
 * auto-displayed by the OS with no way to add custom actions, and worse, a data-only message with
 * no custom handling shows nothing at all once the app is killed.
 */
public class MyFirebaseMessagingService extends FirebaseMessagingService {

    private static final String CHANNEL_ID = "money_manager_default";

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        Map<String, String> data = remoteMessage.getData();
        if (data.isEmpty()) return;

        String title = data.getOrDefault("title", "Money Manager");
        String body = data.getOrDefault("body", "");
        String url = data.getOrDefault("url", "/");
        String actionType = data.getOrDefault("actionType", "VIEW_ONLY");
        String payUrl = data.get("payUrl");

        ensureChannel();

        int notificationId = (int) System.currentTimeMillis();
        PendingIntent openApp = viewPendingIntent(notificationId, url);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_notify)
                .setColor(getColor(R.color.notification_color))
                .setContentTitle(title)
                .setContentText(body)
                .setAutoCancel(true)
                .setContentIntent(openApp);

        switch (actionType) {
            case "PAID_VIEW":
                // Both open the app — "Paid" lands on a one-tap confirm inside, same as tapping
                // the notification itself; there's no separate silent background action for it.
                builder.addAction(0, "Paid", openApp);
                builder.addAction(0, "View", openApp);
                break;
            case "PAY_VIEW":
                if (payUrl != null) {
                    builder.addAction(0, "Pay now", payPendingIntent(notificationId, payUrl));
                }
                builder.addAction(0, "View", openApp);
                break;
            default:
                builder.addAction(0, "View", openApp);
        }

        NotificationManagerCompat.from(this).notify(notificationId, builder.build());
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Money Manager", NotificationManager.IMPORTANCE_HIGH);
            manager.createNotificationChannel(channel);
        }
    }

    private PendingIntent viewPendingIntent(int notificationId, String url) {
        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra("notificationUrl", url);
        return PendingIntent.getActivity(this, notificationId, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Opens the user's UPI app directly with the pay link — never opens Money Manager itself. */
    private PendingIntent payPendingIntent(int notificationId, String payUrl) {
        Intent intent = new Intent(this, NotificationActionReceiver.class);
        intent.setAction(NotificationActionReceiver.ACTION_PAY);
        intent.putExtra("notificationId", notificationId);
        intent.putExtra("payUrl", payUrl);
        return PendingIntent.getBroadcast(this, notificationId, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
