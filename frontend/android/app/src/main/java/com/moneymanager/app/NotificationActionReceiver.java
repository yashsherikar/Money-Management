package com.moneymanager.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.Parcelable;
import androidx.core.app.NotificationManagerCompat;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** "Pay now" on a notification: open the system UPI chooser (any installed UPI app). */
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
            context.startActivity(buildUpiChooser(context, payUrl.trim()));
        } catch (Exception ignored) {
            // No UPI app installed
        }
    }

    static Intent buildUpiChooser(Context context, String url) {
        Intent base = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        base.addCategory(Intent.CATEGORY_DEFAULT);
        base.addCategory(Intent.CATEGORY_BROWSABLE);

        PackageManager pm = context.getPackageManager();
        List<ResolveInfo> apps = pm.queryIntentActivities(base, PackageManager.MATCH_DEFAULT_ONLY);
        Map<String, ResolveInfo> byPackage = new LinkedHashMap<>();
        for (ResolveInfo info : apps) {
            if (info.activityInfo == null) continue;
            byPackage.putIfAbsent(info.activityInfo.packageName, info);
        }

        if (byPackage.isEmpty()) {
            Intent fallback = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            return fallback;
        }

        List<Intent> targeted = new ArrayList<>();
        for (ResolveInfo info : byPackage.values()) {
            Intent specific = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            specific.setPackage(info.activityInfo.packageName);
            specific.setClassName(info.activityInfo.packageName, info.activityInfo.name);
            targeted.add(specific);
        }

        Intent result;
        if (targeted.size() == 1) {
            result = targeted.get(0);
        } else {
            Intent primary = targeted.remove(0);
            result = Intent.createChooser(primary, "Pay with any UPI app");
            result.putExtra(Intent.EXTRA_INITIAL_INTENTS, targeted.toArray(new Parcelable[0]));
        }
        result.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return result;
    }
}
