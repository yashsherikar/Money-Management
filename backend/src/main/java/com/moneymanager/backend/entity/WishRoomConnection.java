package com.moneymanager.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "wishroom_connections")
@Getter
@Setter
@NoArgsConstructor
public class WishRoomConnection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(name = "wishroom_user_id", nullable = false)
    private String wishroomUserId;

    @Column(name = "wishroom_email", nullable = false)
    private String wishroomEmail;

    @Column(name = "wishroom_name")
    private String wishroomName;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String token;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}
