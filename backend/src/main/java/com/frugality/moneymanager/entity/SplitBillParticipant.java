package com.frugality.moneymanager.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "split_bill_participants")
@Getter
@Setter
@NoArgsConstructor
public class SplitBillParticipant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "split_bill_id", nullable = false)
    private SplitBill splitBill;

    @Column(nullable = false)
    private String name;

    @Column(name = "share_amount", nullable = false)
    private BigDecimal shareAmount;

    @Column(nullable = false)
    private boolean paid = false;

    @Column(name = "paid_date")
    private LocalDate paidDate;
}
