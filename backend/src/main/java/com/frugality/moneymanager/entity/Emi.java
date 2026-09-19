package com.frugality.moneymanager.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "emis")
@Getter
@Setter
@NoArgsConstructor
public class Emi {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "account_id", nullable = false)
    private Account account;

    @Column(name = "loan_name", nullable = false)
    private String loanName;

    @Column(nullable = false)
    private BigDecimal principal;

    @Column(name = "interest_rate", nullable = false)
    private BigDecimal interestRate;

    @Column(name = "tenure_months", nullable = false)
    private Integer tenureMonths;

    @Column(name = "emi_amount", nullable = false)
    private BigDecimal emiAmount;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "due_day", nullable = false)
    private Integer dueDay;

    @Column(nullable = false)
    private boolean active = true;

    /** Year-month (yyyy-MM) the EMI was last auto-logged as an expense, prevents double-logging. */
    @Column(name = "last_logged_month")
    private String lastLoggedMonth;
}
