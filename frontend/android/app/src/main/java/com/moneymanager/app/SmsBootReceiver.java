package com.moneymanager.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * After reboot, keep the SMS listen window armed so live RECEIVE_SMS is accepted.
 * Does not read inbox history.
 */
public class SmsBootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null) return;
        try {
            SmsLiveStore.ensureListenFrom(context.getApplicationContext());
        } catch (Exception ignored) { }
    }
}
