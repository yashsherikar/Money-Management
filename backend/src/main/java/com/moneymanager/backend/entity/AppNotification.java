package com.moneymanager.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** In-app record of every push sent, so the bell icon can show history regardless of whether the
 *  OS notification was seen, dismissed, or never delivered (push disabled, token stale, etc). */
@Entity
@Table(name = "app_notifications")
@Getter
@Setter
@NoArgsConstructor
public class AppNotification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false, length = 1000)
    private String body;

    @Column(nullable = false)
    private String url;

    @Column(name = "action_type", nullable = false, length = 20)
    private String actionType;

    @Column(name = "pay_url", length = 1000)
    private String payUrl;

    @Column(nullable = false)
    private boolean viewed = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}
