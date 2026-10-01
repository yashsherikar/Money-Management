package com.moneymanager.backend.service;

import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.MessagingErrorCode;
import com.moneymanager.backend.dto.PushDtos.*;
import com.moneymanager.backend.entity.AppNotification;
import com.moneymanager.backend.entity.PushSubscription;
import com.moneymanager.backend.entity.User;
import com.moneymanager.backend.repository.AppNotificationRepository;
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
    /** Caps stale/duplicate device registrations (e.g. a reinstalled app getting a new FCM
     *  token each time) from piling up and causing the same notification to fire once per
     *  stale row. FIFO: the oldest subscription is evicted when a new one pushes past this. */
    private static final int MAX_SUBSCRIPTIONS_PER_USER = 3;

    private final PushSubscriptionRepository subscriptionRepository;
    private final AppNotificationRepository notificationRepository;
    private final nl.martijndwars.webpush.PushService webPush;
    private final String publicKey;
    private final boolean webPushEnabled;
    private final boolean firebaseEnabled;

    public PushService(PushSubscriptionRepository subscriptionRepository,
                        AppNotificationRepository notificationRepository,
                        @Value("${push.vapid.public-key}") String publicKey,
                        @Value("${push.vapid.private-key}") String privateKey,
                        @Value("${push.vapid.subject}") String subject,
                        boolean firebaseInitialized) throws Exception {
        this.subscriptionRepository = subscriptionRepository;
        this.notificationRepository = notificationRepository;
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
        enforceSubscriptionLimit(user);
    }

    public void unsubscribe(User user, UnsubscribeRequest request) {
        subscriptionRepository.findByEndpointAndUserId(request.endpoint(), user.getId())
                .ifPresent(subscriptionRepository::delete);
    }

    /** Native app (Capacitor/Android) registers its FCM token here instead of a web-push subscription.
     *  Looked up by deviceId first (a stable id the client generates once per install) so a token
     *  rotation — which FCM does on its own, not just on reinstall — updates this row in place
     *  instead of leaving the old token behind as a second row that still gets notified. */
    public void registerFcmToken(User user, String token, String deviceId) {
        PushSubscription sub = null;
        if (StringUtils.hasText(deviceId)) {
            sub = subscriptionRepository.findByDeviceId(deviceId).orElse(null);
        }
        if (sub == null) {
            sub = subscriptionRepository.findByFcmToken(token).orElseGet(PushSubscription::new);
        }
        sub.setUser(user);
        sub.setFcmToken(token);
        if (StringUtils.hasText(deviceId)) {
            sub.setDeviceId(deviceId);
        }
        subscriptionRepository.save(sub);
        enforceSubscriptionLimit(user);
    }

    private void enforceSubscriptionLimit(User user) {
        List<PushSubscription> subs = subscriptionRepository.findByUserIdOrderByCreatedAtAsc(user.getId());
        int excess = subs.size() - MAX_SUBSCRIPTIONS_PER_USER;
        if (excess > 0) {
            subscriptionRepository.deleteAll(subs.subList(0, excess));
        }
    }

    public void unregisterFcmToken(String token) {
        subscriptionRepository.findByFcmToken(token).ifPresent(subscriptionRepository::delete);
    }

    /** Which action buttons the native notification shows: PAID_VIEW ("Paid"/"View") for things
     *  you confirm you did, PAY_VIEW ("Pay now"/"View") for requests where someone owes money
     *  and "Pay now" opens a UPI link directly, VIEW_ONLY for plain informational pushes. */
    public static final String ACTION_PAID_VIEW = "PAID_VIEW";
    public static final String ACTION_PAY_VIEW = "PAY_VIEW";
    public static final String ACTION_VIEW_ONLY = "VIEW_ONLY";

    /** Best-effort: a push failure never blocks the action that triggered it (e.g. creating a request). */
    public void notifyUser(User user, String title, String body) {
        notifyUser(user, title, body, "/", ACTION_VIEW_ONLY, null);
    }

    /** @param url in-app page to open when the notification (or its View action) is tapped. */
    public void notifyUser(User user, String title, String body, String url) {
        notifyUser(user, title, body, url, ACTION_VIEW_ONLY, null);
    }

    public void notifyUser(User user, String title, String body, String url, String actionType) {
        notifyUser(user, title, body, url, actionType, null);
    }

    /** @param payUrl only used with ACTION_PAY_VIEW — the upi://pay link "Pay now" opens directly. */
    public void notifyUser(User user, String title, String body, String url, String actionType, String payUrl) {
        AppNotification record = new AppNotification();
        record.setUser(user);
        record.setTitle(title);
        record.setBody(body);
        record.setUrl(url);
        record.setActionType(actionType);
        record.setPayUrl(payUrl);
        notificationRepository.save(record);

        List<PushSubscription> subs = subscriptionRepository.findByUserId(user.getId());
        for (PushSubscription sub : subs) {
            if (sub.getFcmToken() != null) {
                sendFcm(sub, title, body, url, actionType, payUrl);
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

    /** Data-only message (no .setNotification()) so the app's own FirebaseMessagingService always
     *  runs — even with the app killed — and can build a notification with action buttons itself.
     *  A "notification" message would get auto-displayed by the OS instead, with no way to add
     *  custom actions to it. */
    private void sendFcm(PushSubscription sub, String title, String body, String url, String actionType, String payUrl) {
        if (!firebaseEnabled) return;
        try {
            Message.Builder message = Message.builder()
                    .setToken(sub.getFcmToken())
                    .putData("title", title)
                    .putData("body", body)
                    .putData("url", url)
                    .putData("actionType", actionType);
            if (StringUtils.hasText(payUrl)) {
                message.putData("payUrl", payUrl);
            }
            FirebaseMessaging.getInstance().send(message.build());
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
                    Message message = Message.builder()
                            .setToken(sub.getFcmToken())
                            .putData("title", "Test notification")
                            .putData("body", "If you see this, native push notifications work.")
                            .putData("url", "/")
                            .putData("actionType", ACTION_VIEW_ONLY)
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
