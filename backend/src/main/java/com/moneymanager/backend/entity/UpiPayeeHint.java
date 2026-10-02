package com.moneymanager.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "upi_payee_hints")
@Getter
@Setter
@NoArgsConstructor
public class UpiPayeeHint {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Payee VPA (pa), stored lowercased for shared lookup across users. */
    @Column(name = "upi_id", nullable = false, unique = true, length = 255)
    private String upiId;

    /** Shared category name (e.g. Dining Out) — not a per-user category id. */
    @Column(name = "category_name", nullable = false, length = 100)
    private String categoryName;

    /** True when MCC is missing/0000 — person-to-person UPI, not a merchant. */
    @Column(name = "is_personal", nullable = false)
    private boolean personal = false;

    @Column(name = "display_name", length = 255)
    private String displayName;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @PrePersist
    @PreUpdate
    void touch() {
        updatedAt = Instant.now();
    }
}
