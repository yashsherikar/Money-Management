package com.moneymanager.app;

import android.content.Context;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** App → home-screen widget: save the already-formatted totals and redraw the widget. */
@CapacitorPlugin(name = "SpendWidget")
public class SpendWidgetPlugin extends Plugin {

    @PluginMethod
    public void update(PluginCall call) {
        Context ctx = getContext();
        ctx.getSharedPreferences(SpendWidgetProvider.PREFS, Context.MODE_PRIVATE).edit()
                .putString("today", call.getString("today", "—"))
                .putString("month", call.getString("month", "—"))
                .putString("updated", call.getString("updated", ""))
                .apply();
        SpendWidgetProvider.refreshAll(ctx);
        call.resolve();
    }
}
