package com.moneymanager.app;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Telephony;
import android.telephony.SmsMessage;
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
 * Reads bank/UPI debit SMS for P2P pay confirmation.
 * Late SMS (5–15 min) are picked up via RECEIVE_SMS and by scanning inbox.
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
    private BroadcastReceiver smsReceiver;
    private boolean receiverRegistered = false;

    @Override
    public void load() {
        instance = this;
        ensureReceiver();
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        ensureReceiver();
    }

    @Override
    protected void handleOnDestroy() {
        unregisterReceiverQuietly();
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
            JSObject ret = new JSObject();
            ret.put("sms", "granted");
            ret.put("granted", true);
            ensureReceiver();
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
        if (ok) ensureReceiver();
        call.resolve(ret);
    }

    /** Scan inbox for recent SMS (covers late delivery while app was backgrounded). */
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
            // default: last 24 hours
            sinceMs = System.currentTimeMillis() - 24L * 60L * 60L * 1000L;
        }
        int limit = 80;
        try {
            Integer lim = call.getInt("limit");
            if (lim != null && lim > 0) limit = Math.min(lim, 200);
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
        ensureReceiver();
        JSObject ret = new JSObject();
        ret.put("watching", receiverRegistered);
        call.resolve(ret);
    }

    private boolean hasSmsPermission() {
        Context ctx = getContext();
        if (ctx == null) return false;
        return ContextCompat.checkSelfPermission(ctx, Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED
                && ContextCompat.checkSelfPermission(ctx, Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED;
    }

    private void ensureReceiver() {
        if (!hasSmsPermission() || receiverRegistered || getContext() == null) return;
        if (smsReceiver == null) {
            smsReceiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context context, Intent intent) {
                    if (intent == null || intent.getAction() == null) return;
                    if (!Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())
                            && !"android.provider.Telephony.SMS_RECEIVED".equals(intent.getAction())) {
                        return;
                    }
                    try {
                        Bundle bundle = intent.getExtras();
                        if (bundle == null) return;
                        Object[] pdus = (Object[]) bundle.get("pdus");
                        if (pdus == null || pdus.length == 0) return;
                        String format = bundle.getString("format");
                        StringBuilder body = new StringBuilder();
                        String address = "";
                        long ts = System.currentTimeMillis();
                        for (Object pdu : pdus) {
                            SmsMessage msg;
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && format != null) {
                                msg = SmsMessage.createFromPdu((byte[]) pdu, format);
                            } else {
                                msg = SmsMessage.createFromPdu((byte[]) pdu);
                            }
                            if (msg == null) continue;
                            if (address.isEmpty() && msg.getDisplayOriginatingAddress() != null) {
                                address = msg.getDisplayOriginatingAddress();
                            }
                            if (msg.getTimestampMillis() > 0) ts = msg.getTimestampMillis();
                            String part = msg.getMessageBody();
                            if (part != null) body.append(part);
                        }
                        String text = body.toString().trim();
                        if (text.isEmpty()) return;
                        if (!looksLikePaymentSms(text)) return;
                        emitSms(address, text, ts);
                    } catch (Exception ignored) { }
                }
            };
        }
        try {
            IntentFilter filter = new IntentFilter(Telephony.Sms.Intents.SMS_RECEIVED_ACTION);
            filter.setPriority(999);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                getContext().registerReceiver(smsReceiver, filter, Context.RECEIVER_EXPORTED);
            } else {
                getContext().registerReceiver(smsReceiver, filter);
            }
            receiverRegistered = true;
        } catch (Exception e) {
            receiverRegistered = false;
        }
    }

    private void unregisterReceiverQuietly() {
        if (!receiverRegistered || smsReceiver == null || getContext() == null) return;
        try {
            getContext().unregisterReceiver(smsReceiver);
        } catch (Exception ignored) { }
        receiverRegistered = false;
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
        boolean money = b.contains("rs.") || b.contains("rs ") || b.contains("inr") || b.contains("₹")
                || b.contains("debited") || b.contains("spent") || b.contains("paid")
                || b.contains("sent") || b.contains("upi") || b.contains("txn")
                || b.contains("transaction") || b.contains("withdrawn");
        return money;
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
