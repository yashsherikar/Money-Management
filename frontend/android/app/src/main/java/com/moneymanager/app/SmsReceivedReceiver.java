package com.moneymanager.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.provider.Telephony;
import android.telephony.SmsMessage;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Manifest-registered so live SMS is captured even when the app is killed.
 * Handles bursts: multiple debit/credit/cashback SMS in one second are each
 * enqueued separately (PDU parts of the same SMS stay concatenated).
 */
public class SmsReceivedReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null || intent.getAction() == null) return;
        if (!Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())
                && !"android.provider.Telephony.SMS_RECEIVED".equals(intent.getAction())) {
            return;
        }

        // Keep receiver alive until every SMS in this burst is persisted
        final PendingResult pending = goAsync();
        try {
            Bundle bundle = intent.getExtras();
            if (bundle == null) return;
            Object[] pdus = (Object[]) bundle.get("pdus");
            if (pdus == null || pdus.length == 0) return;
            String format = bundle.getString("format");

            // Group PDU parts by originating address + SMSC timestamp so true multipart
            // fragments (which always share one identical submission timestamp) stay one
            // message, while two distinct bank SMS from the same sender arriving in the
            // same broadcast burst (different timestamps) are kept as separate messages
            // instead of being concatenated into one unparseable blob.
            Map<String, Assembled> bySender = new LinkedHashMap<>();
            List<Assembled> order = new ArrayList<>();

            for (Object pdu : pdus) {
                SmsMessage msg;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && format != null) {
                    msg = SmsMessage.createFromPdu((byte[]) pdu, format);
                } else {
                    msg = SmsMessage.createFromPdu((byte[]) pdu);
                }
                if (msg == null) continue;
                String address = msg.getDisplayOriginatingAddress();
                if (address == null) address = "";
                String part = msg.getMessageBody();
                if (part == null) part = "";
                long ts = msg.getTimestampMillis() > 0 ? msg.getTimestampMillis() : System.currentTimeMillis();

                String key = address + "|" + ts;
                Assembled row = bySender.get(key);
                if (row == null) {
                    row = new Assembled(address, ts);
                    bySender.put(key, row);
                    order.add(row);
                }
                row.body.append(part);
                if (ts > 0) row.ts = ts;
            }

            Context app = context.getApplicationContext();
            for (Assembled row : order) {
                String text = row.body.toString().trim();
                if (text.isEmpty()) continue;
                if (!SmsReaderPlugin.looksLikePaymentSms(text)) continue;

                // Always queue first — UI may be frozen / process about to die
                SmsLiveStore.enqueue(app, row.address, text, row.ts);
                SmsReaderPlugin.emitIfAlive(row.address, text, row.ts);
            }
        } catch (Exception ignored) {
        } finally {
            try {
                pending.finish();
            } catch (Exception ignored) { }
        }
    }

    private static final class Assembled {
        final String address;
        final StringBuilder body = new StringBuilder();
        long ts;

        Assembled(String address, long ts) {
            this.address = address == null ? "" : address;
            this.ts = ts;
        }
    }
}
