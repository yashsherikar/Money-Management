package com.moneymanager.app;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
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
import java.io.File;

/**
 * On-device OCR for bill / receipt photos via ML Kit Text Recognition.
 * Prefer {@link #recognizeFromUri} so full-resolution images never cross the JS bridge as base64.
 */
@CapacitorPlugin(name = "BillOcr")
public class BillOcrPlugin extends Plugin {

    @PluginMethod
    public void recognizeFromUri(PluginCall call) {
        String uriStr = call.getString("uri");
        if (uriStr == null || uriStr.isEmpty()) {
            call.reject("uri required");
            return;
        }
        try {
            Uri uri = Uri.parse(uriStr);
            if (uri.getScheme() == null || uri.getScheme().isEmpty()) {
                uri = Uri.fromFile(new File(uriStr));
            } else if ("file".equalsIgnoreCase(uri.getScheme()) && uri.getPath() != null) {
                uri = Uri.fromFile(new File(uri.getPath()));
            }
            // fromFilePath respects EXIF orientation (critical for camera photos)
            InputImage image = InputImage.fromFilePath(getContext(), uri);
            runOcr(image, call);
        } catch (Exception e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "could not open image");
        }
    }

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

        // Downscale very large photos for speed / bridge payloads
        int maxSide = 1600;
        int w = bitmap.getWidth();
        int h = bitmap.getHeight();
        if (Math.max(w, h) > maxSide) {
            float scale = maxSide / (float) Math.max(w, h);
            bitmap = Bitmap.createScaledBitmap(bitmap, Math.round(w * scale), Math.round(h * scale), true);
        }

        InputImage image = InputImage.fromBitmap(bitmap, 0);
        runOcr(image, call);
    }

    private void runOcr(InputImage image, PluginCall call) {
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
