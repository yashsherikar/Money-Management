package com.moneymanager.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

/**
 * Home-screen widget: today's and this month's spend. Shows the last totals the app saved
 * (SpendWidgetPlugin) — it never calls the server itself. Tap opens the app.
 */
public class SpendWidgetProvider extends AppWidgetProvider {

    static final String PREFS = "mm_spend_widget";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        render(context, manager, ids);
    }

    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, SpendWidgetProvider.class));
        if (ids.length > 0) render(context, manager, ids);
    }

    private static void render(Context context, AppWidgetManager manager, int[] ids) {
        SharedPreferences p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent tap = PendingIntent.getActivity(context, 0, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        for (int id : ids) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_spend);
            views.setTextViewText(R.id.widget_today, p.getString("today", "—"));
            views.setTextViewText(R.id.widget_month, p.getString("month", "—"));
            views.setTextViewText(R.id.widget_updated, p.getString("updated", "Open the app to load"));
            views.setOnClickPendingIntent(R.id.widget_root, tap);
            manager.updateAppWidget(id, views);
        }
    }
}
