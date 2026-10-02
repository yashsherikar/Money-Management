package com.moneymanager.app;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.widget.Toast;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;

/**
 * UPI launcher.
 * Merchant VPAs: deep-link pay (upi:// / tez://) with mc + tr.
 * Personal/P2P: GPay often rejects intent pays with fake "bank limit" — use
 * {@link #copyAndOpen} or {@link #saveQrPng} instead.
 */
@CapacitorPlugin(name = "UpiLauncher")
public class UpiLauncherPlugin extends Plugin {

    private static final String GPAY = "com.google.android.apps.nbu.paisa.user";
    private static final String PHONEPE = "com.phonepe.app";
    private static final String PAYTM = "net.one97.paytm";
    private static final String BHIM = "in.org.npci.upiapp";

    @PluginMethod
    public void pay(PluginCall call) {
        try {
            String pa = sanitizePa(call.getString("pa"));
            String am = normalizeAmount(call.getString("am"));
            String pn = sanitizePn(call.getString("pn"));
            String app = call.getString("app");
            String mc = call.getString("mc");
            Boolean merchantFlag = call.getBoolean("merchant", false);
            if (am == null) throw new IllegalArgumentException("Bad amount");

            String query = "pa=" + pa + "&am=" + am + "&cu=INR";
            if (pn != null) query += "&pn=" + pn;
            if (Boolean.TRUE.equals(merchantFlag)) {
                if (mc != null && !mc.isBlank() && !mc.matches("0+")) {
                    query += "&mc=" + mc.trim();
                }
                query += "&tr=MM" + System.currentTimeMillis();
            }

            String upiUrl = "upi://pay?" + query;
            openWithBestIntent(call, upiUrl, query, pa, am, app);
        } catch (Exception e) {
            call.reject(e.getMessage() == null ? "Pay failed" : e.getMessage(), e);
        }
    }

    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isBlank()) {
            call.reject("missing url");
            return;
        }
        try {
            String pa = sanitizePa(extractParam(url, "pa"));
            String am = normalizeAmount(extractParam(url, "am"));
            String pn = sanitizePn(extractParam(url, "pn"));
            if (am == null) throw new IllegalArgumentException("Bad amount");
            String query = "pa=" + pa + "&am=" + am + "&cu=INR";
            if (pn != null) query += "&pn=" + pn;
            openWithBestIntent(call, "upi://pay?" + query, query, pa, am, call.getString("app"));
        } catch (Exception e) {
            call.reject(e.getMessage() == null ? "Open failed" : e.getMessage(), e);
        }
    }

    @PluginMethod
    public void copyPayLink(PluginCall call) {
        try {
            String pa = sanitizePa(call.getString("pa"));
            String am = normalizeAmount(call.getString("am"));
            if (am == null) throw new IllegalArgumentException("Bad amount");
            String url = "upi://pay?pa=" + pa + "&am=" + am + "&cu=INR";
            ClipboardManager cm = (ClipboardManager) getContext().getSystemService(Context.CLIPBOARD_SERVICE);
            cm.setPrimaryClip(ClipData.newPlainText("UPI", url));
            toast("Copied:\n" + url);
            JSObject ret = new JSObject();
            ret.put("copied", true);
            ret.put("url", url);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    /**
     * P2P-safe path.
     * GPay: paste into search often fails — open payee via deep link WITHOUT amount
     * (user types ₹ in GPay). Clipboard still set as backup.
     * PhonePe / Paytm / BHIM: copy VPA + open app home (paste works there).
     */
    @PluginMethod
    public void copyAndOpen(PluginCall call) {
        try {
            String pa = sanitizePa(call.getString("pa"));
            String am = normalizeAmount(call.getString("am"));
            String pn = sanitizePn(call.getString("pn"));
            String app = call.getString("app");
            if (am == null) throw new IllegalArgumentException("Bad amount");

            // Plain text only — GPay/PhonePe paste fields reject HTML/styled clips
            ClipboardManager cm = (ClipboardManager) getContext().getSystemService(Context.CLIPBOARD_SERVICE);
            ClipData clip = ClipData.newPlainText("text", pa);
            cm.setPrimaryClip(clip);

            PackageManager pm = getContext().getPackageManager();
            String pkg = resolvePackage(app);
            if (pkg == null || !isInstalled(pm, pkg)) {
                pkg = null;
                for (String candidate : new String[]{GPAY, PHONEPE, PAYTM, BHIM}) {
                    if (isInstalled(pm, candidate)) {
                        pkg = candidate;
                        break;
                    }
                }
            }
            if (pkg == null) {
                call.reject("No UPI app installed");
                return;
            }

            Intent launch;
            if (GPAY.equals(pkg)) {
                // No am= — avoids fake bank-limit; GPay opens this UPI ID for amount entry
                String query = "pa=" + pa + "&cu=INR";
                if (pn != null) query += "&pn=" + pn;
                launch = new Intent(Intent.ACTION_VIEW);
                launch.setData(Uri.parse("tez://upi/pay?" + query));
                launch.setPackage(GPAY);
                if (launch.resolveActivity(pm) == null) {
                    launch = new Intent(Intent.ACTION_VIEW, opaqueUpiUri(query));
                    launch.setPackage(GPAY);
                }
                if (launch.resolveActivity(pm) == null) {
                    // Last resort: home + clipboard (paste is flaky in GPay)
                    launch = pm.getLaunchIntentForPackage(GPAY);
                    toast("UPI ID copied\nGPay → New payment → paste, enter ₹" + am);
                } else {
                    toast("GPay opened for " + pa + "\nEnter ₹" + am + " there");
                }
            } else {
                launch = pm.getLaunchIntentForPackage(pkg);
                if (launch == null) {
                    call.reject("Could not open UPI app");
                    return;
                }
                toast("UPI ID copied — paste in app, send ₹" + am);
            }

            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            // Brief delay so clipboard is committed before GPay/PhonePe reads it
            final Intent toStart = launch;
            Activity activity = getActivity();
            if (activity != null) {
                activity.runOnUiThread(() ->
                        activity.getWindow().getDecorView().postDelayed(() -> {
                            try {
                                getContext().startActivity(toStart);
                            } catch (Exception e) {
                                toast("Could not open app");
                            }
                        }, 280));
            } else {
                getContext().startActivity(toStart);
            }

            JSObject ret = new JSObject();
            ret.put("copied", true);
            ret.put("pa", pa);
            ret.put("am", am);
            ret.put("opened", true);
            ret.put("gpayDeepLink", GPAY.equals(pkg));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage() == null ? "Copy/open failed" : e.getMessage(), e);
        }
    }

    /** Save a base64 PNG pay-QR into Pictures/MoneyManager (scan from gallery in GPay/PhonePe). */
    @PluginMethod
    public void saveQrPng(PluginCall call) {
        try {
            String base64 = call.getString("base64");
            String fileName = call.getString("fileName", "MM-Pay-QR.png");
            if (base64 == null || base64.isBlank()) {
                call.reject("missing base64");
                return;
            }
            if (fileName == null || fileName.isBlank()) fileName = "MM-Pay-QR.png";
            if (!fileName.toLowerCase(Locale.ROOT).endsWith(".png")) fileName = fileName + ".png";

            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            ContentResolver resolver = getContext().getContentResolver();
            Uri uri;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.Images.Media.DISPLAY_NAME, fileName);
                values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
                values.put(MediaStore.Images.Media.RELATIVE_PATH,
                        Environment.DIRECTORY_PICTURES + "/MoneyManager");
                values.put(MediaStore.Images.Media.IS_PENDING, 1);
                uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
                if (uri == null) throw new IllegalStateException("Could not create gallery row");
                try (OutputStream out = resolver.openOutputStream(uri)) {
                    if (out == null) throw new IllegalStateException("Could not open gallery stream");
                    out.write(bytes);
                }
                values.clear();
                values.put(MediaStore.Images.Media.IS_PENDING, 0);
                resolver.update(uri, values, null, null);
            } else {
                ContentValues values = new ContentValues();
                values.put(MediaStore.Images.Media.DISPLAY_NAME, fileName);
                values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
                uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
                if (uri == null) throw new IllegalStateException("Could not create gallery row");
                try (OutputStream out = resolver.openOutputStream(uri)) {
                    if (out == null) throw new IllegalStateException("Could not open gallery stream");
                    out.write(bytes);
                }
            }

            toast("QR saved to Gallery\nOpen GPay → Scan → Gallery");
            JSObject ret = new JSObject();
            ret.put("saved", true);
            ret.put("uri", uri.toString());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage() == null ? "Save QR failed" : e.getMessage(), e);
        }
    }

    private void openWithBestIntent(PluginCall call, String upiUrl, String query, String pa, String am, String app)
            throws Exception {
        try {
            ClipboardManager cm = (ClipboardManager) getContext().getSystemService(Context.CLIPBOARD_SERVICE);
            cm.setPrimaryClip(ClipData.newPlainText("UPI", upiUrl));
        } catch (Exception ignored) { }

        Uri opaqueUpi = opaqueUpiUri(query);
        String pkg = resolvePackage(app);
        PackageManager pm = getContext().getPackageManager();

        Intent intent = null;

        if (pkg == null || GPAY.equals(pkg)) {
            if (isInstalled(pm, GPAY)) {
                Intent tez = new Intent(Intent.ACTION_VIEW);
                tez.setData(Uri.parse("tez://upi/pay?" + query));
                tez.setPackage(GPAY);
                if (tez.resolveActivity(pm) != null) {
                    intent = tez;
                } else {
                    String intentUri = "intent://pay?" + query
                            + "#Intent;scheme=upi;package=" + GPAY + ";end";
                    Intent parsed = Intent.parseUri(intentUri, Intent.URI_INTENT_SCHEME);
                    if (parsed.resolveActivity(pm) != null) {
                        intent = parsed;
                    } else {
                        Intent gpay = new Intent(Intent.ACTION_VIEW, opaqueUpi);
                        gpay.setPackage(GPAY);
                        intent = gpay;
                    }
                }
            }
        }

        if (intent == null && pkg != null && isInstalled(pm, pkg)) {
            Intent specific = new Intent(Intent.ACTION_VIEW, opaqueUpi);
            specific.setPackage(pkg);
            List<ResolveInfo> matches = pm.queryIntentActivities(specific, 0);
            if (!matches.isEmpty() && matches.get(0).activityInfo != null) {
                specific.setClassName(matches.get(0).activityInfo.packageName, matches.get(0).activityInfo.name);
            }
            intent = specific;
        }

        if (intent == null) {
            Intent view = new Intent(Intent.ACTION_VIEW, opaqueUpi);
            intent = Intent.createChooser(view, "Pay with UPI");
        }

        String dataStr = intent.getData() != null ? intent.getData().toString() : upiUrl;
        toast("Sending to UPI:\n" + dataStr.replace("%40", "@"));

        startActivityForResult(call, intent, "upiPayResult");
    }

    @ActivityCallback
    private void upiPayResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject ret = new JSObject();
        ret.put("opened", true);
        ret.put("resultCode", result.getResultCode());
        call.resolve(ret);
    }

    static Uri opaqueUpiUri(String query) {
        return Uri.fromParts("upi", "//pay?" + query, null);
    }

    static String buildMinimalPayUrl(String paRaw, String amRaw) {
        String pa = sanitizePa(paRaw);
        String am = normalizeAmount(amRaw);
        if (am == null) throw new IllegalArgumentException("Bad amount");
        return "upi://pay?pa=" + pa + "&am=" + am + "&cu=INR";
    }

    static Uri uriFromCleanUpi(String cleanUrl) {
        int q = cleanUrl.indexOf('?');
        if (q < 0) throw new IllegalArgumentException("Invalid UPI link");
        return opaqueUpiUri(cleanUrl.substring(q + 1));
    }

    static String rebuildCleanUpiUrl(String url) {
        return buildMinimalPayUrl(extractParam(url, "pa"), extractParam(url, "am"));
    }

    private void toast(String msg) {
        Activity activity = getActivity();
        if (activity == null) return;
        activity.runOnUiThread(() -> Toast.makeText(getContext(), msg, Toast.LENGTH_LONG).show());
    }

    private static String sanitizePa(String paRaw) {
        if (paRaw == null || paRaw.isBlank()) throw new IllegalArgumentException("UPI ID missing");
        String pa = paRaw.trim().replaceAll("(?i)%40", "@");
        if (!pa.contains("@") || pa.contains("%") || pa.contains(" ") || pa.contains("&") || pa.contains("?")) {
            throw new IllegalArgumentException("UPI ID invalid: " + pa);
        }
        return pa;
    }

    private static String sanitizePn(String pnRaw) {
        if (pnRaw == null) return null;
        String t = pnRaw.trim();
        if (t.isEmpty()) return null;
        try {
            if (t.contains("%")) t = Uri.decode(t);
        } catch (Exception ignored) { }
        t = t.replaceAll("[&=?]", " ").replaceAll("\\s+", " ").trim();
        if (t.isEmpty()) return null;
        return URLEncoder.encode(t, StandardCharsets.UTF_8).replace("+", "%20");
    }

    private static String resolvePackage(String app) {
        if (app == null) return null;
        switch (app.toLowerCase(Locale.ROOT)) {
            case "gpay":
            case "google":
            case "tez":
                return GPAY;
            case "phonepe":
                return PHONEPE;
            case "paytm":
                return PAYTM;
            case "bhim":
                return BHIM;
            default:
                return null;
        }
    }

    private static boolean isInstalled(PackageManager pm, String pkg) {
        try {
            pm.getPackageInfo(pkg, 0);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    static String extractParam(String url, String key) {
        java.util.regex.Matcher m = java.util.regex.Pattern
                .compile("[?&]" + key + "=([^&]*)", java.util.regex.Pattern.CASE_INSENSITIVE)
                .matcher(url);
        return m.find() ? m.group(1) : null;
    }

    static String normalizeAmount(String raw) {
        if (raw == null) return null;
        String cleaned = raw.trim()
                .replace("₹", "")
                .replace(",", "")
                .replace("%20", "")
                .replace("%2E", ".")
                .replace("%2e", ".")
                .replace(" ", "");
        if (!cleaned.matches("\\d+(\\.\\d{1,2})?")) return null;
        try {
            double n = Double.parseDouble(cleaned);
            if (!(n >= 1.0) || n > 100000.0) return null;
            return String.format(Locale.US, "%.2f", n);
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
