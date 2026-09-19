package com.moneymanager.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "investment_transactions")
@Getter
@Setter
@NoArgsConstructor
public class InvestmentTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "investment_id", nullable = false)
    private Investment investment;

    @Column(name = "txn_date", nullable = false)
    private LocalDate txnDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private InvestmentTxnType type;

    @Column(nullable = false)
    private BigDecimal amount;
}
