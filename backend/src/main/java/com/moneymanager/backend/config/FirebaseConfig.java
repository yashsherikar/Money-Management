package com.moneymanager.backend.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;

import java.io.ByteArrayInputStream;
import java.util.Base64;

/**
 * Initializes the Firebase Admin SDK from a base64-encoded service account JSON,
 * so native app (Capacitor/Android) push notifications can be sent via FCM tokens.
 * Set FIREBASE_SERVICE_ACCOUNT_BASE64 on Render to enable this; native push is
 * simply skipped (not sent) if it's unset, same as the web-push VAPID keys.
 */
@Configuration
public class FirebaseConfig {

    private static final Logger log = LoggerFactory.getLogger(FirebaseConfig.class);

    @Bean
    public boolean firebaseInitialized(@Value("${firebase.service-account-base64:}") String serviceAccountBase64) {
        if (!StringUtils.hasText(serviceAccountBase64)) {
            log.warn("FIREBASE_SERVICE_ACCOUNT_BASE64 not configured — native app push notifications are disabled");
            return false;
        }
        try {
            byte[] decoded = Base64.getDecoder().decode(serviceAccountBase64);
            FirebaseOptions options = FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.fromStream(new ByteArrayInputStream(decoded)))
                    .build();
            if (FirebaseApp.getApps().isEmpty()) {
                FirebaseApp.initializeApp(options);
            }
            log.info("Firebase Admin SDK initialized — native app push notifications enabled");
            return true;
        } catch (Exception e) {
            log.warn("Failed to initialize Firebase Admin SDK: {}: {}", e.getClass().getSimpleName(), e.getMessage());
            return false;
        }
    }
}
