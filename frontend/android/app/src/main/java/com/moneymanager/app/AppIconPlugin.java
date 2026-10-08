package com.moneymanager.app;

import android.content.Intent;
import android.content.pm.ApplicationInfo;
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
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Icon of an app installed on this phone, for merchants we have no bundled logo for.
 * Looks up by exact package name, or by an exact (normalized) launcher label match —
 * never fuzzy, so a merchant can't pick up some unrelated app's icon.
 * Read-only: no app is launched or inspected beyond its label and icon.
 */
@CapacitorPlugin(name = "AppIcon")
public class AppIconPlugin extends Plugin {

    // Shown at ≤48dp; 64px keeps each cached icon a few KB in the WebView's small storage.
    private static final int ICON_PX = 64;

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
            if (target == null && name != null && norm(name).length() >= 3) {
                // "acko activa insurance" → ACKO. App label must appear in the text as whole
                // word(s); longest label wins ("Amazon Shopping" over "Amazon"). Only apps the
                // user installed — built-ins like Phone/Camera/Messages would match "phone bill".
                List<String> words = words(name);
                String whole = norm(name);
                Intent launcher = new Intent(Intent.ACTION_MAIN);
                launcher.addCategory(Intent.CATEGORY_LAUNCHER);
                String self = getContext().getPackageName();
                int bestLen = 0;
                for (ResolveInfo ri : pm.queryIntentActivities(launcher, 0)) {
                    ApplicationInfo ai = ri.activityInfo.applicationInfo;
                    if (ai.packageName.equals(self)) continue;
                    if ((ai.flags & ApplicationInfo.FLAG_SYSTEM) != 0) continue;
                    String label = String.valueOf(ri.loadLabel(pm));
                    // "Jar: Save Money in Gold" / "Swiggy - Food" → also try the brand part.
                    String brandPart = label.split("\\s*[:|\\u2013\\u2014]\\s*|\\s+-\\s+", 2)[0];
                    for (String candidate : new String[]{label, brandPart}) {
                        int len = norm(candidate).length();
                        if (len < 3 || len <= bestLen) continue;
                        if (labelMatches(words, whole, candidate)) {
                            target = ai.packageName;
                            bestLen = len;
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

    private static List<String> words(String s) {
        List<String> out = new ArrayList<>();
        for (String w : s.toLowerCase(Locale.ROOT).split("[^a-z0-9]+")) {
            if (!w.isEmpty()) out.add(w);
        }
        return out;
    }

    /**
     * App name appears in the text as whole word(s). 3-letter names ("Jar", "Jio") only in
     * short text (≤ 3 words: "Money jar", "SAFE JAR") — in a sentence they're usually an
     * ordinary word ("a jar of pickle").
     */
    static boolean labelMatches(List<String> words, String whole, String label) {
        String normLabel = norm(label);
        if (normLabel.length() < 3) return false;
        if (normLabel.equals(whole)) return true;
        if (normLabel.length() < 4 && words.size() > 3) return false;
        return containsRun(words, words(label));
    }

    /** True if `run` appears in `words` as consecutive whole words. */
    private static boolean containsRun(List<String> words, List<String> run) {
        if (run.isEmpty() || run.size() > words.size()) return false;
        for (int i = 0; i + run.size() <= words.size(); i++) {
            if (words.subList(i, i + run.size()).equals(run)) return true;
        }
        return false;
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
