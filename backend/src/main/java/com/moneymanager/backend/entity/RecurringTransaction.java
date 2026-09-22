package com.moneymanager.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "recurring_transactions")
@Getter
@Setter
@NoArgsConstructor
public class RecurringTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "account_id", nullable = false)
    private Account account;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private Category category;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TransactionType type;

    @Column(nullable = false)
    private BigDecimal amount;

    @Column(nullable = false)
    private String description;

    @Column(name = "day_of_month")
    private Integer dayOfMonth;

    @Enumerated(EnumType.STRING)
    @Column(name = "recurrence_type", nullable = false)
    private RecurrenceType recurrenceType = RecurrenceType.MONTHLY;

    /** For RecurrenceType.INTERVAL_DAYS — e.g. 28 for a 28-day recharge validity. */
    @Column(name = "interval_days")
    private Integer intervalDays;

    /** For RecurrenceType.INTERVAL_DAYS — the anchor date the next due date counts forward from. */
    @Column(name = "last_logged_date")
    private LocalDate lastLoggedDate;

    @Column(nullable = false)
    private boolean active = true;

    /** Year-month (yyyy-MM) this was last auto-logged (MONTHLY type), prevents double-logging. */
    @Column(name = "last_logged_month")
    private String lastLoggedMonth;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}
