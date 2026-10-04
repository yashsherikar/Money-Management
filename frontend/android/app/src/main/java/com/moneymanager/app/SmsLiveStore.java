package com.moneymanager.app;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Queues live SMS received while the app process is dead.
 * Thread-safe so credit+debit (or many SMS) arriving together are not lost.
 * Never reads the SMS inbox — only messages that arrived via RECEIVE_SMS.
 */
public final class SmsLiveStore {
    private static final String PREFS = "mm_sms_live";
    private static final String KEY_QUEUE = "queue";
    private static final String KEY_LISTEN = "listen_from";
    /** Burst of bank + UPI + cashback SMS in one minute needs headroom. */
    private static final int MAX = 80;
    private static final Object LOCK = new Object();

    private SmsLiveStore() {}

    public static void setListenFrom(Context ctx, long ms) {
        if (ctx == null || ms <= 0) return;
        synchronized (LOCK) {
            prefs(ctx).edit().putLong(KEY_LISTEN, ms).commit();
        }
    }

    public static long getListenFrom(Context ctx) {
        if (ctx == null) return 0L;
        synchronized (LOCK) {
            return prefs(ctx).getLong(KEY_LISTEN, 0L);
        }
    }

    /** Arm listening at "now" if never set (first permission grant). */
    public static long ensureListenFrom(Context ctx) {
        synchronized (LOCK) {
            long existing = prefs(ctx).getLong(KEY_LISTEN, 0L);
            if (existing > 0) return existing;
            long now = System.currentTimeMillis();
            prefs(ctx).edit().putLong(KEY_LISTEN, now).commit();
            return now;
        }
    }

    public static void enqueue(Context ctx, String address, String body, long date) {
        if (ctx == null || body == null || body.isBlank()) return;
        synchronized (LOCK) {
            long listen = prefs(ctx).getLong(KEY_LISTEN, 0L);
            // Not armed yet — ignore (avoids queuing before user allows SMS)
            if (listen <= 0) return;
            long ts = date > 0 ? date : System.currentTimeMillis();
            if (ts < listen - 30_000L) return;

            try {
                JSONArray arr = readArrayUnlocked(ctx);
                // Exact dedupe: same sender + body + second (keeps distinct debit/credit)
                String key = dedupeKey(address, body, ts);
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject o = arr.optJSONObject(i);
                    if (o == null) continue;
                    if (key.equals(dedupeKey(o.optString("address", ""), o.optString("body", ""), o.optLong("date", 0L)))) {
                        return;
                    }
                }
                JSONObject row = new JSONObject();
                row.put("address", address == null ? "" : address);
                row.put("body", body);
                row.put("date", ts);
                arr.put(row);
                while (arr.length() > MAX) {
                    arr.remove(0);
                }
                // commit() so a process kill right after SMS still persists the queue
                prefs(ctx).edit().putString(KEY_QUEUE, arr.toString()).commit();
            } catch (Exception ignored) { }
        }
    }

    /** Return queued live SMS and clear the store. */
    public static JSArray drain(Context ctx) {
        JSArray out = new JSArray();
        if (ctx == null) return out;
        synchronized (LOCK) {
            try {
                JSONArray arr = readArrayUnlocked(ctx);
                prefs(ctx).edit().putString(KEY_QUEUE, "[]").commit();
                long listen = prefs(ctx).getLong(KEY_LISTEN, 0L);
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject o = arr.optJSONObject(i);
                    if (o == null) continue;
                    long date = o.optLong("date", 0L);
                    if (listen > 0 && date > 0 && date < listen - 30_000L) continue;
                    JSObject row = new JSObject();
                    row.put("address", o.optString("address", ""));
                    row.put("body", o.optString("body", ""));
                    row.put("date", date > 0 ? date : System.currentTimeMillis());
                    out.put(row);
                }
            } catch (Exception ignored) { }
        }
        return out;
    }

    private static String dedupeKey(String address, String body, long ts) {
        String a = address == null ? "" : address.trim();
        String b = body == null ? "" : body.trim();
        long sec = ts > 0 ? (ts / 1000L) : 0L;
        return a + "|" + b + "|" + sec;
    }

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static JSONArray readArrayUnlocked(Context ctx) {
        try {
            String raw = prefs(ctx).getString(KEY_QUEUE, "[]");
            if (raw == null || raw.isBlank()) return new JSONArray();
            return new JSONArray(raw);
        } catch (Exception e) {
            return new JSONArray();
        }
    }
}
