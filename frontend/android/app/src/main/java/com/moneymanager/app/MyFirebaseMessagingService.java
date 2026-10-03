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
    /** Stable local id used with a string tag so a later CANCEL can remove the same tray entry. */
    private static final int RELATED_NOTIFICATION_ID = 41001;

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        Map<String, String> data = remoteMessage.getData();
        if (data.isEmpty()) return;

        String actionType = data.getOrDefault("actionType", "VIEW_ONLY");
        String tag = data.get("tag");

        if ("CANCEL".equals(actionType)) {
            if (tag != null && !tag.isEmpty()) {
                NotificationManagerCompat.from(this).cancel(tag, RELATED_NOTIFICATION_ID);
            }
            return;
        }

        String title = data.getOrDefault("title", "Money Manager");
        String body = data.getOrDefault("body", "");
        String url = data.getOrDefault("url", "/");
        String payUrl = data.get("payUrl");
        String relatedType = data.get("relatedType");
        String relatedId = data.get("relatedId");

        ensureChannel();

        boolean tagged = tag != null && !tag.isEmpty();
        int notificationId = tagged ? RELATED_NOTIFICATION_ID : (int) System.currentTimeMillis();
        PendingIntent openApp = tapPendingIntent(notificationId, url, tag, false, relatedType, relatedId);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_notify)
                .setColor(getColor(R.color.notification_color))
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setAutoCancel(true)
                .setContentIntent(openApp);

        switch (actionType) {
            case "PAID_VIEW":
                builder.addAction(0, "Paid", tapPendingIntent(notificationId, url, tag, true, relatedType, relatedId));
                builder.addAction(0, "View", openApp);
                break;
            case "PAY_VIEW":
                if (payUrl != null) {
                    builder.addAction(0, "Pay now", payPendingIntent(notificationId, payUrl, tag));
                }
                builder.addAction(0, "View", openApp);
                break;
            default:
                builder.addAction(0, "View", openApp);
        }

        NotificationManagerCompat manager = NotificationManagerCompat.from(this);
        if (!manager.areNotificationsEnabled()) {
            return;
        }
        if (tagged) {
            manager.notify(tag, RELATED_NOTIFICATION_ID, builder.build());
        } else {
            manager.notify(notificationId, builder.build());
        }
    }

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        // Capacitor re-registers on next app open via enableNativePush; keep SharedPreferences
        // so a cold start can refresh the backend even if the registration event is skipped.
        getSharedPreferences("CapacitorStorage", MODE_PRIVATE)
                .edit()
                .putString("fcmToken", token)
                .apply();
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Money Manager", NotificationManager.IMPORTANCE_HIGH);
            channel.enableVibration(true);
            channel.setShowBadge(true);
            manager.createNotificationChannel(channel);
        }
    }

    private PendingIntent tapPendingIntent(int notificationId, String url, String tag, boolean markPaid,
                                           String relatedType, String relatedId) {
        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra("notificationUrl", url);
        intent.putExtra("notificationPaid", markPaid);
        if (relatedType != null) intent.putExtra("relatedType", relatedType);
        if (relatedId != null) intent.putExtra("relatedId", relatedId);
        int requestCode = tag != null ? (tag.hashCode() ^ (markPaid ? 0x791 : 0)) : (notificationId ^ (markPaid ? 1 : 0));
        return PendingIntent.getActivity(this, requestCode, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Opens the user's UPI app directly with the pay link — never opens Money Manager itself. */
    private PendingIntent payPendingIntent(int notificationId, String payUrl, String tag) {
        Intent intent = new Intent(this, NotificationActionReceiver.class);
        intent.setAction(NotificationActionReceiver.ACTION_PAY);
        intent.putExtra("notificationId", notificationId);
        intent.putExtra("payUrl", payUrl);
        if (tag != null) {
            intent.putExtra("notificationTag", tag);
        }
        int requestCode = tag != null ? (tag.hashCode() ^ 0x5A5A) : notificationId;
        return PendingIntent.getBroadcast(this, requestCode, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
