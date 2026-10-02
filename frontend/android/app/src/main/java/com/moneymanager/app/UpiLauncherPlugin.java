package com.moneymanager.app;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.Parcelable;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Opens a standard {@code upi://pay?...} link and shows a chooser with every
 * installed UPI app (GPay, PhonePe, Paytm, BHIM, WhatsApp, Amazon Pay, …) —
 * never hard-wires a single package.
 */
@CapacitorPlugin(name = "UpiLauncher")
public class UpiLauncherPlugin extends Plugin {

    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isBlank()) {
            call.reject("missing url");
            return;
        }
        url = url.trim();

        String reject = validateUpiUrl(url);
        if (reject != null) {
            call.reject(reject);
            return;
        }

        try {
            Intent base = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            base.addCategory(Intent.CATEGORY_DEFAULT);
            base.addCategory(Intent.CATEGORY_BROWSABLE);

            PackageManager pm = getContext().getPackageManager();
            List<ResolveInfo> apps = pm.queryIntentActivities(base, PackageManager.MATCH_DEFAULT_ONLY);

            // Deduplicate by package (some apps register multiple activities for upi://)
            Map<String, ResolveInfo> byPackage = new LinkedHashMap<>();
            for (ResolveInfo info : apps) {
                if (info.activityInfo == null) continue;
                byPackage.putIfAbsent(info.activityInfo.packageName, info);
            }

            if (byPackage.isEmpty()) {
                call.reject("No UPI app found. Install PhonePe, GPay, Paytm, BHIM, or any UPI app.");
                return;
            }

            List<Intent> targeted = new ArrayList<>();
            for (ResolveInfo info : byPackage.values()) {
                Intent specific = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                specific.setPackage(info.activityInfo.packageName);
                specific.setClassName(info.activityInfo.packageName, info.activityInfo.name);
                targeted.add(specific);
            }

            Intent chooser;
            if (targeted.size() == 1) {
                chooser = targeted.get(0);
            } else {
                Intent primary = targeted.remove(0);
                chooser = Intent.createChooser(primary, "Pay with any UPI app");
                chooser.putExtra(
                        Intent.EXTRA_INITIAL_INTENTS,
                        targeted.toArray(new Parcelable[0])
                );
            }

            Activity activity = getActivity();
            if (activity != null) {
                activity.startActivity(chooser);
            } else {
                chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(chooser);
            }

            JSObject ret = new JSObject();
            ret.put("opened", true);
            ret.put("appCount", byPackage.size());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Could not open a UPI app. Try PhonePe, GPay, Paytm, or BHIM.", e);
        }
    }

    /** Mirror of JS assertSafeUpiLink — belt and suspenders on the native side. */
    static String validateUpiUrl(String url) {
        String lower = url.toLowerCase();
        if (!lower.startsWith("upi://pay?")) {
            return "Payment link must start with upi://pay?";
        }
        if (lower.contains("%40")) {
            return "UPI ID is wrongly encoded — payment blocked";
        }
        if (!url.matches("(?i).*[?&]pa=[^&]*@[^&]*.*")) {
            return "UPI ID missing @ — payment blocked";
        }
        if (!url.matches("(?i).*[?&]am=\\d+\\.\\d{2}(?:&|$).*")) {
            return "Amount must be like 10.00 — payment blocked";
        }
        int amCount = 0;
        int paCount = 0;
        for (String part : url.substring(url.indexOf('?') + 1).split("&")) {
            String key = part.split("=", 2)[0].toLowerCase();
            if ("am".equals(key)) amCount++;
            if ("pa".equals(key)) paCount++;
        }
        if (amCount != 1) return "Duplicate amount in link — payment blocked";
        if (paCount != 1) return "Duplicate UPI ID in link — payment blocked";
        if (lower.matches(".*[?&](sign|mode|orgid|mam)=.*")) {
            return "Unsafe merchant fields in link — payment blocked";
        }
        return null;
    }
}
