package com.moneymanager.app;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

/**
 * On-device OCR for bill / receipt photos via ML Kit Text Recognition.
 */
@CapacitorPlugin(name = "BillOcr")
public class BillOcrPlugin extends Plugin {

    @PluginMethod
    public void recognize(PluginCall call) {
        String base64 = call.getString("base64");
        if (base64 == null || base64.isEmpty()) {
            call.reject("base64 image required");
            return;
        }
        // Allow data-URL prefix
        int comma = base64.indexOf(',');
        if (comma >= 0) base64 = base64.substring(comma + 1);

        byte[] bytes;
        try {
            bytes = Base64.decode(base64, Base64.DEFAULT);
        } catch (IllegalArgumentException e) {
            call.reject("invalid base64");
            return;
        }
        Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        if (bitmap == null) {
            call.reject("could not decode image");
            return;
        }

        // Downscale very large photos for speed
        int maxSide = 1600;
        int w = bitmap.getWidth();
        int h = bitmap.getHeight();
        if (Math.max(w, h) > maxSide) {
            float scale = maxSide / (float) Math.max(w, h);
            bitmap = Bitmap.createScaledBitmap(bitmap, Math.round(w * scale), Math.round(h * scale), true);
        }

        InputImage image = InputImage.fromBitmap(bitmap, 0);
        TextRecognizer recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        recognizer.process(image)
                .addOnSuccessListener(result -> {
                    JSObject ret = new JSObject();
                    ret.put("text", result.getText() != null ? result.getText() : "");
                    call.resolve(ret);
                })
                .addOnFailureListener(e -> call.reject(e.getMessage() != null ? e.getMessage() : "ocr_failed"));
    }
}
