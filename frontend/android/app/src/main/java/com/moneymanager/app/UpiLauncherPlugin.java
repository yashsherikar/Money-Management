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
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Opens a clean {@code upi://pay?...} Intent.
 * <p>
 * Critical: never hand GPay a URI built only via {@link Uri#parse(String)} on the full
 * string — Android re-serializes {@code @} in {@code pa=} as {@code %40}, which often
 * shows the right amount on screen but fails after PIN with "exceeded bank limit".
 * We rebuild with {@link Uri.Builder#encodedQuery(String)} so {@code @} and {@code am=}
 * stay exact.
 */
@CapacitorPlugin(name = "UpiLauncher")
public class UpiLauncherPlugin extends Plugin {

    private static final Pattern PA = Pattern.compile("[?&]pa=([^&]*)", Pattern.CASE_INSENSITIVE);
    private static final Pattern AM = Pattern.compile("[?&]am=([^&]*)", Pattern.CASE_INSENSITIVE);
    private static final Pattern PN = Pattern.compile("[?&]pn=([^&]*)", Pattern.CASE_INSENSITIVE);
    private static final Pattern TN = Pattern.compile("[?&]tn=([^&]*)", Pattern.CASE_INSENSITIVE);
    private static final Pattern CU = Pattern.compile("[?&]cu=([^&]*)", Pattern.CASE_INSENSITIVE);

    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isBlank()) {
            call.reject("missing url");
            return;
        }

        String clean;
        try {
            clean = rebuildCleanUpiUrl(url.trim());
        } catch (IllegalArgumentException e) {
            call.reject(e.getMessage());
            return;
        }

        try {
            Uri uri = uriFromCleanUpi(clean);
            Intent base = new Intent(Intent.ACTION_VIEW, uri);
            base.addCategory(Intent.CATEGORY_DEFAULT);
            base.addCategory(Intent.CATEGORY_BROWSABLE);

            PackageManager pm = getContext().getPackageManager();
            List<ResolveInfo> apps = pm.queryIntentActivities(base, PackageManager.MATCH_DEFAULT_ONLY);

            Map<String, ResolveInfo> byPackage = new LinkedHashMap<>();
            for (ResolveInfo info : apps) {
                if (info.activityInfo == null) continue;
                byPackage.putIfAbsent(info.activityInfo.packageName, info);
            }

            if (byPackage.isEmpty()) {
                // Still try a plain VIEW — some devices hide packages from queries
                Activity activity = getActivity();
                Intent fallback = new Intent(Intent.ACTION_VIEW, uri);
                if (activity != null) {
                    activity.startActivity(Intent.createChooser(fallback, "Pay with UPI"));
                } else {
                    fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(Intent.createChooser(fallback, "Pay with UPI"));
                }
                JSObject ret = new JSObject();
                ret.put("opened", true);
                ret.put("url", clean);
                call.resolve(ret);
                return;
            }

            List<Intent> targeted = new ArrayList<>();
            for (ResolveInfo info : byPackage.values()) {
                // Package only — do NOT setClassName (wrong activity can corrupt the UPI payload)
                Intent specific = new Intent(Intent.ACTION_VIEW, uri);
                specific.setPackage(info.activityInfo.packageName);
                targeted.add(specific);
            }

            Intent launch;
            if (targeted.size() == 1) {
                launch = targeted.get(0);
            } else {
                Intent primary = targeted.remove(0);
                launch = Intent.createChooser(primary, "Pay with any UPI app");
                launch.putExtra(Intent.EXTRA_INITIAL_INTENTS, targeted.toArray(new Parcelable[0]));
            }

            Activity activity = getActivity();
            if (activity != null) {
                activity.startActivity(launch);
            } else {
                launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(launch);
            }

            JSObject ret = new JSObject();
            ret.put("opened", true);
            ret.put("url", clean);
            ret.put("appCount", byPackage.size());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Could not open a UPI app. Try PhonePe, GPay, Paytm, or BHIM.", e);
        }
    }

    /** Build hierarchical upi://pay URI without re-encoding @ or amount. */
    static Uri uriFromCleanUpi(String cleanUrl) {
        int q = cleanUrl.indexOf('?');
        if (q < 0) throw new IllegalArgumentException("Invalid UPI link");
        String query = cleanUrl.substring(q + 1);
        return new Uri.Builder()
                .scheme("upi")
                .authority("pay")
                .encodedQuery(query)
                .build();
    }

    /**
     * Parse with regex (not Uri.getQueryParameter) and rebuild a minimal NPCI link:
     * {@code upi://pay?pa=…&pn=…&am=x.xx&cu=INR&tn=…}
     */
    static String rebuildCleanUpiUrl(String url) {
        String lower = url.toLowerCase(Locale.ROOT);
        if (!lower.startsWith("upi://pay?")) {
            throw new IllegalArgumentException("Payment link must start with upi://pay?");
        }
        if (lower.contains("%40")) {
            throw new IllegalArgumentException("UPI ID is wrongly encoded — payment blocked");
        }

        String pa = first(PA, url);
        String am = first(AM, url);
        String pn = first(PN, url);
        String tn = first(TN, url);
        String cu = first(CU, url);

        if (pa == null || pa.isBlank()) {
            throw new IllegalArgumentException("UPI ID missing — payment blocked");
        }
        pa = pa.trim();
        pa = pa.replaceAll("(?i)%40", "@");
        if (!pa.contains("@") || pa.contains("%")) {
            throw new IllegalArgumentException("UPI ID invalid — payment blocked");
        }

        if (am == null || am.isBlank()) {
            throw new IllegalArgumentException("Amount missing — payment blocked");
        }
        am = normalizeAmount(am);
        if (am == null) {
            throw new IllegalArgumentException("Amount must be like 10.00 — payment blocked");
        }

        if (countKeys(url, "am") != 1 || countKeys(url, "pa") != 1) {
            throw new IllegalArgumentException("Duplicate amount/UPI ID — payment blocked");
        }
        if (lower.matches(".*[?&](sign|mode|orgid|mam)=.*")) {
            throw new IllegalArgumentException("Unsafe merchant fields — payment blocked");
        }

        StringBuilder q = new StringBuilder();
        q.append("pa=").append(pa);
        if (pn != null && !pn.isBlank()) {
            q.append("&pn=").append(safeParam(pn));
        }
        q.append("&am=").append(am);
        q.append("&cu=").append(cu != null && !cu.isBlank() ? safeParam(cu) : "INR");
        if (tn != null && !tn.isBlank()) {
            q.append("&tn=").append(safeParam(tn));
        }

        String clean = "upi://pay?" + q;
        if (clean.toLowerCase(Locale.ROOT).contains("%40")) {
            throw new IllegalArgumentException("UPI ID encoding failed — payment blocked");
        }
        return clean;
    }

    static String normalizeAmount(String raw) {
        String cleaned = raw.trim()
                .replace("₹", "")
                .replace(",", "")
                .replace("%20", "")
                .replace(" ", "");
        // Reject if dots were stripped elsewhere into a huge integer from a decimal
        if (!cleaned.matches("\\d+(\\.\\d{1,2})?")) {
            // already percent-encoded digits? decode common case
            cleaned = cleaned.replace("%2E", ".").replace("%2e", ".");
            if (!cleaned.matches("\\d+(\\.\\d{1,2})?")) return null;
        }
        try {
            double n = Double.parseDouble(cleaned);
            if (!(n >= 1.0) || n > 100000.0) return null;
            return String.format(Locale.US, "%.2f", n);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** Keep already-encoded values; encode only raw unsafe chars. Never touch @ in values we control. */
    static String safeParam(String value) {
        String v = value.trim();
        if (v.contains("%")) return v; // already encoded from JS
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < v.length(); i++) {
            char c = v.charAt(i);
            if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')
                    || c == '-' || c == '_' || c == '.' || c == '~' || c == '@') {
                out.append(c);
            } else if (c == ' ') {
                out.append("%20");
            } else {
                out.append(String.format(Locale.US, "%%%02X", (int) c));
            }
        }
        return out.toString();
    }

    static String first(Pattern p, String url) {
        Matcher m = p.matcher(url);
        return m.find() ? m.group(1) : null;
    }

    static int countKeys(String url, String key) {
        int n = 0;
        Matcher m = Pattern.compile("[?&]" + key + "=", Pattern.CASE_INSENSITIVE).matcher(url);
        while (m.find()) n++;
        return n;
    }
}
