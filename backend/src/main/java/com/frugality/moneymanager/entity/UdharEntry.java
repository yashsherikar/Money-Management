package com.frugality.moneymanager.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "udhar_entries")
@Getter
@Setter
@NoArgsConstructor
public class UdharEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id")
    private Account account;

    @Column(name = "contact_name", nullable = false)
    private String contactName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private UdharType type;

    @Column(nullable = false)
    private BigDecimal amount;

    private String note;

    @Column(name = "txn_date", nullable = false)
    private LocalDate txnDate;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Column(nullable = false)
    private boolean settled = false;

    @Column(name = "settled_date")
    private LocalDate settledDate;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}
