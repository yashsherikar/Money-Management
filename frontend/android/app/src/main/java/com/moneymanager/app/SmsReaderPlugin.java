package com.moneymanager.app;

import android.Manifest;
import android.content.ContentResolver;
import android.content.Context;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.provider.Telephony;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Live bank/UPI SMS via manifest RECEIVE_SMS (works when app is killed).
 * Inbox readRecent is only for explicit bill-match checks — money flow never scans history.
 */
@CapacitorPlugin(
        name = "SmsReader",
        permissions = {
                @Permission(
                        alias = "sms",
                        strings = {
                                Manifest.permission.RECEIVE_SMS,
                                Manifest.permission.READ_SMS
                        }
                )
        }
)
public class SmsReaderPlugin extends Plugin {

    private static SmsReaderPlugin instance;

    @Override
    public void load() {
        instance = this;
    }

    @Override
    protected void handleOnDestroy() {
        if (instance == this) instance = null;
        super.handleOnDestroy();
    }

    @PluginMethod
    public void checkPermissions(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("sms", getPermissionState("sms").toString());
        ret.put("granted", hasSmsPermission());
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        if (hasSmsPermission()) {
            // Arm live listen window at now if first grant path
            SmsLiveStore.ensureListenFrom(getContext());
            JSObject ret = new JSObject();
            ret.put("sms", "granted");
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }
        requestPermissionForAlias("sms", call, "smsPermCallback");
    }

    @PermissionCallback
    private void smsPermCallback(PluginCall call) {
        JSObject ret = new JSObject();
        boolean ok = getPermissionState("sms") == PermissionState.GRANTED;
        ret.put("sms", getPermissionState("sms").toString());
        ret.put("granted", ok);
        if (ok) {
            // First allow → only SMS from this moment forward (native side)
            SmsLiveStore.setListenFrom(getContext(), System.currentTimeMillis());
        }
        call.resolve(ret);
    }

    /** Sync JS listen-from so killed-app queue ignores older live SMS. */
    @PluginMethod
    public void setListenFrom(PluginCall call) {
        long ms = 0L;
        try {
            Double v = call.getDouble("sinceMs");
            if (v != null) ms = v.longValue();
        } catch (Exception ignored) { }
        if (ms <= 0) ms = System.currentTimeMillis();
        SmsLiveStore.setListenFrom(getContext(), ms);
        JSObject ret = new JSObject();
        ret.put("sinceMs", ms);
        call.resolve(ret);
    }

    /**
     * Drain live SMS captured while app was killed.
     * Not an inbox history read — only RECEIVE_SMS queue.
     */
    @PluginMethod
    public void drainLiveQueue(PluginCall call) {
        if (!hasSmsPermission()) {
            call.reject("SMS permission not granted");
            return;
        }
        JSArray messages = SmsLiveStore.drain(getContext());
        JSObject ret = new JSObject();
        ret.put("messages", messages);
        call.resolve(ret);
    }

    /**
     * Optional inbox read for bill-scan match only (JS money watcher must not call this).
     * Still filtered by sinceMs (listen-from).
     */
    @PluginMethod
    public void readRecent(PluginCall call) {
        if (!hasSmsPermission()) {
            call.reject("SMS permission not granted");
            return;
        }
        long sinceMs = 0;
        try {
            Double since = call.getDouble("sinceMs");
            if (since != null) sinceMs = since.longValue();
        } catch (Exception ignored) { }
        if (sinceMs <= 0) {
            sinceMs = SmsLiveStore.getListenFrom(getContext());
        }
        if (sinceMs <= 0) {
            // Not armed — refuse to dump inbox history
            JSObject ret = new JSObject();
            ret.put("messages", new JSArray());
            call.resolve(ret);
            return;
        }
        int limit = 40;
        try {
            Integer lim = call.getInt("limit");
            if (lim != null && lim > 0) limit = Math.min(lim, 80);
        } catch (Exception ignored) { }

        try {
            JSArray messages = queryInbox(sinceMs, limit);
            JSObject ret = new JSObject();
            ret.put("messages", messages);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage() == null ? "SMS read failed" : e.getMessage(), e);
        }
    }

    @PluginMethod
    public void startWatch(PluginCall call) {
        if (!hasSmsPermission()) {
            call.reject("SMS permission not granted");
            return;
        }
        try {
            Double since = call.getDouble("sinceMs");
            if (since != null && since > 0) {
                SmsLiveStore.setListenFrom(getContext(), since.longValue());
            } else {
                SmsLiveStore.ensureListenFrom(getContext());
            }
        } catch (Exception ignored) {
            SmsLiveStore.ensureListenFrom(getContext());
        }
        // Manifest receiver handles live SMS; nothing else to register.
        JSObject ret = new JSObject();
        ret.put("watching", true);
        call.resolve(ret);
    }

    private boolean hasSmsPermission() {
        Context ctx = getContext();
        if (ctx == null) return false;
        return ContextCompat.checkSelfPermission(ctx, Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED
                && ContextCompat.checkSelfPermission(ctx, Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED;
    }

    private JSArray queryInbox(long sinceMs, int limit) {
        JSArray out = new JSArray();
        ContentResolver cr = getContext().getContentResolver();
        Uri uri = Telephony.Sms.Inbox.CONTENT_URI;
        String[] projection = new String[]{
                Telephony.Sms._ID,
                Telephony.Sms.ADDRESS,
                Telephony.Sms.BODY,
                Telephony.Sms.DATE
        };
        String selection = Telephony.Sms.DATE + ">=?";
        String[] args = new String[]{String.valueOf(sinceMs)};
        try (Cursor c = cr.query(uri, projection, selection, args, Telephony.Sms.DATE + " DESC")) {
            if (c == null) return out;
            int n = 0;
            while (c.moveToNext() && n < limit) {
                String address = c.getString(1);
                String body = c.getString(2);
                long date = c.getLong(3);
                if (body == null || body.isBlank()) continue;
                if (!looksLikePaymentSms(body)) continue;
                JSObject row = new JSObject();
                row.put("address", address == null ? "" : address);
                row.put("body", body);
                row.put("date", date);
                out.put(row);
                n++;
            }
        }
        return out;
    }

    /** Cheap filter so we don't flood JS with OTP / promo SMS. */
    static boolean looksLikePaymentSms(String body) {
        if (body == null) return false;
        String b = body.toLowerCase();
        if (b.contains("otp") || b.contains("one time") || b.contains("verification code")) return false;
        return b.contains("rs.") || b.contains("rs ") || b.contains("inr") || b.contains("₹")
                || b.contains("debited") || b.contains("credited") || b.contains("spent") || b.contains("paid")
                || b.contains("received") || b.contains("deposited") || b.contains("sent")
                || b.contains("upi") || b.contains("txn") || b.contains("transaction")
                || b.contains("withdrawn") || b.contains("imps") || b.contains("neft") || b.contains("rtgs");
    }

    /** @return true if delivered to a live WebView bridge */
    static boolean emitIfAlive(String address, String body, long date) {
        SmsReaderPlugin plugin = instance;
        if (plugin == null) return false;
        emitSms(address, body, date);
        return true;
    }

    static void emitSms(String address, String body, long date) {
        SmsReaderPlugin plugin = instance;
        if (plugin == null) return;
        JSObject data = new JSObject();
        data.put("address", address == null ? "" : address);
        data.put("body", body == null ? "" : body);
        data.put("date", date);
        plugin.notifyListeners("bankSms", data);
    }
}
