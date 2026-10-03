package com.moneymanager.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.provider.Telephony;
import android.telephony.SmsMessage;

/**
 * Manifest-registered so live SMS is captured even when the app is killed.
 * Does not read inbox history — only the SMS that just arrived.
 */
public class SmsReceivedReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null || intent.getAction() == null) return;
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
            if (!SmsReaderPlugin.looksLikePaymentSms(text)) return;

            // App open → deliver to JS immediately; killed → queue for next open
            if (SmsReaderPlugin.emitIfAlive(address, text, ts)) {
                return;
            }
            SmsLiveStore.enqueue(context, address, text, ts);
        } catch (Exception ignored) { }
    }
}
