package com.moneymanager.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "push_subscriptions")
@Getter
@Setter
@NoArgsConstructor
public class PushSubscription {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** Web push subscription (browser). Null for a native Android FCM subscription. */
    @Column(unique = true, length = 1000)
    private String endpoint;

    private String p256dh;

    private String auth;

    /** Native app FCM registration token (Capacitor/Android). Null for a browser web-push subscription. */
    @Column(name = "fcm_token", unique = true, length = 500)
    private String fcmToken;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}
