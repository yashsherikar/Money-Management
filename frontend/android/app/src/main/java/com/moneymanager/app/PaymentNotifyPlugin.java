package com.moneymanager.app;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.provider.Settings;
import android.text.TextUtils;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Bridge for UPI payment NotificationListenerService.
 * Settings toggle opens the system notification-access screen once.
 */
@CapacitorPlugin(name = "PaymentNotify")
public class PaymentNotifyPlugin extends Plugin {

    private static PaymentNotifyPlugin instance;
    private static String lastTitle = "";
    private static String lastText = "";
    private static String lastPackage = "";
    private static long lastAt = 0;

    @Override
    public void load() {
        instance = this;
    }

    @PluginMethod
    public void isEnabled(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("enabled", isNotificationServiceEnabled(getContext()));
        call.resolve(ret);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void getLastRaw(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("title", lastTitle);
        ret.put("text", lastText);
        ret.put("packageName", lastPackage);
        ret.put("at", lastAt);
        call.resolve(ret);
    }

    static void onUpiNotification(String packageName, String title, String text) {
        lastPackage = packageName == null ? "" : packageName;
        lastTitle = title == null ? "" : title;
        lastText = text == null ? "" : text;
        lastAt = System.currentTimeMillis();

        PaymentNotifyPlugin plugin = instance;
        if (plugin == null) return;

        JSObject data = new JSObject();
        data.put("packageName", lastPackage);
        data.put("title", lastTitle);
        data.put("text", lastText);
        data.put("at", lastAt);
        plugin.notifyListeners("upiPaymentNotify", data);
    }

    static boolean isNotificationServiceEnabled(Context context) {
        String flat = Settings.Secure.getString(
                context.getContentResolver(),
                "enabled_notification_listeners");
        if (flat == null || flat.isEmpty()) return false;
        String pkg = context.getPackageName();
        ComponentName expected = new ComponentName(context, UpiPaymentNotificationListener.class);
        TextUtils.SimpleStringSplitter splitter = new TextUtils.SimpleStringSplitter(':');
        splitter.setString(flat);
        while (splitter.hasNext()) {
            String component = splitter.next();
            ComponentName cn = ComponentName.unflattenFromString(component);
            if (cn != null && cn.equals(expected)) return true;
            if (component != null && component.contains(pkg)
                    && component.contains("UpiPaymentNotificationListener")) {
                return true;
            }
        }
        return false;
    }
}
