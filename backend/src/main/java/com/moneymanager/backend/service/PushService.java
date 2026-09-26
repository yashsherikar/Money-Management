package com.moneymanager.backend.service;

import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.MessagingErrorCode;
import com.moneymanager.backend.dto.PushDtos.*;
import com.moneymanager.backend.entity.PushSubscription;
import com.moneymanager.backend.entity.User;
import com.moneymanager.backend.repository.PushSubscriptionRepository;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.Subscription;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.security.Security;
import java.util.ArrayList;
import java.util.List;

/** Sends push notifications: Web Push (VAPID) for browsers, FCM for the native Android app. */
@Service
public class PushService {

    private static final Logger log = LoggerFactory.getLogger(PushService.class);

    private final PushSubscriptionRepository subscriptionRepository;
    private final nl.martijndwars.webpush.PushService webPush;
    private final String publicKey;
    private final boolean webPushEnabled;
    private final boolean firebaseEnabled;

    public PushService(PushSubscriptionRepository subscriptionRepository,
                        @Value("${push.vapid.public-key}") String publicKey,
                        @Value("${push.vapid.private-key}") String privateKey,
                        @Value("${push.vapid.subject}") String subject,
                        boolean firebaseInitialized) throws Exception {
        this.subscriptionRepository = subscriptionRepository;
        this.publicKey = publicKey;
        this.webPushEnabled = StringUtils.hasText(publicKey) && StringUtils.hasText(privateKey);
        this.firebaseEnabled = firebaseInitialized;
        if (webPushEnabled) {
            Security.addProvider(new BouncyCastleProvider());
            this.webPush = new nl.martijndwars.webpush.PushService(publicKey, privateKey, subject);
        } else {
            this.webPush = null;
            log.warn("VAPID keys not configured — browser push notifications are disabled");
        }
    }

    public PushStatusResponse status() {
        return new PushStatusResponse(webPushEnabled);
    }

    public VapidKeyResponse vapidPublicKey() {
        return new VapidKeyResponse(webPushEnabled ? publicKey : null);
    }

    public void subscribe(User user, SubscribeRequest request) {
        PushSubscription sub = subscriptionRepository.findByEndpoint(request.endpoint())
                .orElseGet(PushSubscription::new);
        sub.setUser(user);
        sub.setEndpoint(request.endpoint());
        sub.setP256dh(request.p256dh());
        sub.setAuth(request.auth());
        subscriptionRepository.save(sub);
    }

    public void unsubscribe(User user, UnsubscribeRequest request) {
        subscriptionRepository.findByEndpointAndUserId(request.endpoint(), user.getId())
                .ifPresent(subscriptionRepository::delete);
    }

    /** Native app (Capacitor/Android) registers its FCM token here instead of a web-push subscription. */
    public void registerFcmToken(User user, String token) {
        PushSubscription sub = subscriptionRepository.findByFcmToken(token).orElseGet(PushSubscription::new);
        sub.setUser(user);
        sub.setFcmToken(token);
        subscriptionRepository.save(sub);
    }

    public void unregisterFcmToken(String token) {
        subscriptionRepository.findByFcmToken(token).ifPresent(subscriptionRepository::delete);
    }

    /** Best-effort: a push failure never blocks the action that triggered it (e.g. creating a request). */
    public void notifyUser(User user, String title, String body) {
        notifyUser(user, title, body, "/");
    }

    /** @param url in-app page to open when the notification (or its View action) is tapped. */
    public void notifyUser(User user, String title, String body, String url) {
        List<PushSubscription> subs = subscriptionRepository.findByUserId(user.getId());
        for (PushSubscription sub : subs) {
            if (sub.getFcmToken() != null) {
                sendFcm(sub, title, body, url);
            } else if (webPushEnabled) {
                sendWebPush(sub, webPushPayload(title, body, url));
            }
        }
    }

    private void sendWebPush(PushSubscription sub, String payload) {
        try {
            Subscription subscription = new Subscription(sub.getEndpoint(),
                    new Subscription.Keys(sub.getP256dh(), sub.getAuth()));
            var response = webPush.send(new Notification(subscription, payload));
            int status = response.getStatusLine().getStatusCode();
            if (status == HttpStatus.NOT_FOUND.value() || status == HttpStatus.GONE.value()) {
                subscriptionRepository.delete(sub);
            }
        } catch (Exception e) {
            log.warn("web push failed for subscription {}: {}", sub.getId(), e.getMessage());
        }
    }

    private void sendFcm(PushSubscription sub, String title, String body, String url) {
        if (!firebaseEnabled) return;
        try {
            com.google.firebase.messaging.Notification notification = com.google.firebase.messaging.Notification.builder()
                    .setTitle(title)
                    .setBody(body)
                    .build();
            Message message = Message.builder()
                    .setToken(sub.getFcmToken())
                    .setNotification(notification)
                    .putData("url", url)
                    .build();
            FirebaseMessaging.getInstance().send(message);
        } catch (FirebaseMessagingException e) {
            if (e.getMessagingErrorCode() == MessagingErrorCode.UNREGISTERED) {
                subscriptionRepository.delete(sub);
            }
            log.warn("FCM push failed for subscription {}: {}", sub.getId(), e.getMessage());
        } catch (Exception e) {
            log.warn("FCM push failed for subscription {}: {}", sub.getId(), e.getMessage());
        }
    }

    /** Self-test: sends a real push and reports exactly what happened per subscription, instead of swallowing errors. */
    public TestPushResponse sendTest(User user) {
        List<PushSubscription> subs = subscriptionRepository.findByUserId(user.getId());
        List<String> results = new ArrayList<>();
        if (subs.isEmpty()) {
            results.add("No push subscription found for this account — turn on Push in Settings, or open the native app once, first");
            return new TestPushResponse(webPushEnabled, 0, results);
        }
        for (PushSubscription sub : subs) {
            if (sub.getFcmToken() != null) {
                if (!firebaseEnabled) {
                    results.add("Subscription " + sub.getId() + " (native app): Firebase not configured on the server");
                    continue;
                }
                try {
                    com.google.firebase.messaging.Notification notification = com.google.firebase.messaging.Notification.builder()
                            .setTitle("Test notification")
                            .setBody("If you see this, native push notifications work.")
                            .build();
                    Message message = Message.builder()
                            .setToken(sub.getFcmToken())
                            .setNotification(notification)
                            .putData("url", "/")
                            .build();
                    String response = FirebaseMessaging.getInstance().send(message);
                    results.add("Subscription " + sub.getId() + " (native app): sent, id " + response);
                } catch (FirebaseMessagingException e) {
                    if (e.getMessagingErrorCode() == MessagingErrorCode.UNREGISTERED) {
                        subscriptionRepository.delete(sub);
                        results.add("Subscription " + sub.getId() + " (native app): expired (removed)");
                    } else {
                        results.add("Subscription " + sub.getId() + " (native app): FAILED — " + e.getMessagingErrorCode() + ": " + e.getMessage());
                    }
                } catch (Exception e) {
                    results.add("Subscription " + sub.getId() + " (native app): FAILED — " + e.getClass().getSimpleName() + ": " + e.getMessage());
                }
                continue;
            }
            if (!webPushEnabled) {
                results.add("Subscription " + sub.getId() + " (browser): VAPID keys not configured on the server");
                continue;
            }
            try {
                Subscription subscription = new Subscription(sub.getEndpoint(),
                        new Subscription.Keys(sub.getP256dh(), sub.getAuth()));
                var response = webPush.send(new Notification(subscription, webPushPayload("Test notification", "If you see this, push notifications work.", "/")));
                int status = response.getStatusLine().getStatusCode();
                if (status == HttpStatus.NOT_FOUND.value() || status == HttpStatus.GONE.value()) {
                    subscriptionRepository.delete(sub);
                    results.add("Subscription " + sub.getId() + " (browser): expired (removed) — re-enable push in Settings");
                } else {
                    results.add("Subscription " + sub.getId() + " (browser): sent, status " + status);
                }
            } catch (Exception e) {
                results.add("Subscription " + sub.getId() + " (browser): FAILED — " + e.getClass().getSimpleName() + ": " + e.getMessage());
            }
        }
        return new TestPushResponse(webPushEnabled, subs.size(), results);
    }

    private String webPushPayload(String title, String body, String url) {
        return "{\"title\":" + jsonString(title) + ",\"body\":" + jsonString(body) + ",\"url\":" + jsonString(url) + "}";
    }

    private String jsonString(String value) {
        return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }
}
