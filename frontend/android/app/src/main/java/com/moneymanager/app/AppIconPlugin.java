package com.moneymanager.app;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.util.Locale;

/**
 * Icon of an app installed on this phone, for merchants we have no bundled logo for.
 * Looks up by exact package name, or by an exact (normalized) launcher label match —
 * never fuzzy, so a merchant can't pick up some unrelated app's icon.
 * Read-only: no app is launched or inspected beyond its label and icon.
 */
@CapacitorPlugin(name = "AppIcon")
public class AppIconPlugin extends Plugin {

    private static final int ICON_PX = 96;

    @PluginMethod
    public void find(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            PackageManager pm = getContext().getPackageManager();
            String target = null;

            String pkg = call.getString("packageName");
            if (pkg != null && !pkg.isEmpty()) {
                try {
                    pm.getApplicationInfo(pkg, 0);
                    target = pkg;
                } catch (PackageManager.NameNotFoundException ignored) { }
            }

            String name = call.getString("name");
            if (target == null && name != null) {
                String want = norm(name);
                if (want.length() >= 4) {
                    Intent launcher = new Intent(Intent.ACTION_MAIN);
                    launcher.addCategory(Intent.CATEGORY_LAUNCHER);
                    String self = getContext().getPackageName();
                    for (ResolveInfo ri : pm.queryIntentActivities(launcher, 0)) {
                        String p = ri.activityInfo.packageName;
                        if (p.equals(self)) continue;
                        if (want.equals(norm(String.valueOf(ri.loadLabel(pm))))) {
                            target = p;
                            break;
                        }
                    }
                }
            }

            if (target != null) {
                ret.put("icon", "data:image/png;base64," + toPngBase64(pm.getApplicationIcon(target)));
            }
        } catch (Exception ignored) {
            // No icon is a normal outcome — caller falls back to the letter icon.
        }
        call.resolve(ret);
    }

    private static String norm(String s) {
        return s.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
    }

    private static String toPngBase64(Drawable d) {
        Bitmap bmp = Bitmap.createBitmap(ICON_PX, ICON_PX, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bmp);
        d.setBounds(0, 0, ICON_PX, ICON_PX);
        d.draw(canvas);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        bmp.compress(Bitmap.CompressFormat.PNG, 100, out);
        bmp.recycle();
        return Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
    }
}
