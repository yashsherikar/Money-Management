package com.moneymanager.backend.service;

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

/** Sends Web Push notifications (browser/phone push, works even when the app is closed). */
@Service
public class PushService {

    private static final Logger log = LoggerFactory.getLogger(PushService.class);

    private final PushSubscriptionRepository subscriptionRepository;
    private final nl.martijndwars.webpush.PushService webPush;
    private final String publicKey;
    private final boolean enabled;

    public PushService(PushSubscriptionRepository subscriptionRepository,
                        @Value("${push.vapid.public-key}") String publicKey,
                        @Value("${push.vapid.private-key}") String privateKey,
                        @Value("${push.vapid.subject}") String subject) throws Exception {
        this.subscriptionRepository = subscriptionRepository;
        this.publicKey = publicKey;
        this.enabled = StringUtils.hasText(publicKey) && StringUtils.hasText(privateKey);
        if (enabled) {
            Security.addProvider(new BouncyCastleProvider());
            this.webPush = new nl.martijndwars.webpush.PushService(publicKey, privateKey, subject);
        } else {
            this.webPush = null;
            log.warn("VAPID keys not configured — push notifications are disabled");
        }
    }

    public PushStatusResponse status() {
        return new PushStatusResponse(enabled);
    }

    public VapidKeyResponse vapidPublicKey() {
        return new VapidKeyResponse(enabled ? publicKey : null);
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

    /** Best-effort: a push failure never blocks the action that triggered it (e.g. creating a request). */
    public void notifyUser(User user, String title, String body) {
        if (!enabled) return;
        List<PushSubscription> subs = subscriptionRepository.findByUserId(user.getId());
        String payload = "{\"title\":" + jsonString(title) + ",\"body\":" + jsonString(body) + "}";

        for (PushSubscription sub : subs) {
            try {
                Subscription subscription = new Subscription(sub.getEndpoint(),
                        new Subscription.Keys(sub.getP256dh(), sub.getAuth()));
                var response = webPush.send(new Notification(subscription, payload));
                int status = response.getStatusLine().getStatusCode();
                if (status == HttpStatus.NOT_FOUND.value() || status == HttpStatus.GONE.value()) {
                    subscriptionRepository.delete(sub);
                }
            } catch (Exception e) {
                log.warn("push notification failed for user {}: {}", user.getId(), e.getMessage());
            }
        }
    }

    /** Self-test: sends a real push and reports exactly what happened per subscription, instead of swallowing errors. */
    public TestPushResponse sendTest(User user) {
        List<PushSubscription> subs = subscriptionRepository.findByUserId(user.getId());
        List<String> results = new ArrayList<>();
        if (!enabled) {
            results.add("VAPID keys not configured on the server");
            return new TestPushResponse(false, subs.size(), results);
        }
        if (subs.isEmpty()) {
            results.add("No push subscription found for this account — turn on the Push notifications toggle in Profile first");
            return new TestPushResponse(true, 0, results);
        }
        String payload = "{\"title\":" + jsonString("Test notification") + ",\"body\":" + jsonString("If you see this, push notifications work.") + "}";
        for (PushSubscription sub : subs) {
            try {
                Subscription subscription = new Subscription(sub.getEndpoint(),
                        new Subscription.Keys(sub.getP256dh(), sub.getAuth()));
                var response = webPush.send(new Notification(subscription, payload));
                int status = response.getStatusLine().getStatusCode();
                if (status == HttpStatus.NOT_FOUND.value() || status == HttpStatus.GONE.value()) {
                    subscriptionRepository.delete(sub);
                    results.add("Subscription " + sub.getId() + ": expired (removed) — re-enable push in Profile");
                } else {
                    results.add("Subscription " + sub.getId() + ": sent, status " + status);
                }
            } catch (Exception e) {
                results.add("Subscription " + sub.getId() + ": FAILED — " + e.getClass().getSimpleName() + ": " + e.getMessage());
            }
        }
        return new TestPushResponse(true, subs.size(), results);
    }

    private String jsonString(String value) {
        return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }
}
