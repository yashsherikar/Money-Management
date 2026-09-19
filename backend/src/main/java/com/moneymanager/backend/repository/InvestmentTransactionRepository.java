package com.moneymanager.backend.repository;

import com.moneymanager.backend.entity.InvestmentTransaction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface InvestmentTransactionRepository extends JpaRepository<InvestmentTransaction, Long> {
    List<InvestmentTransaction> findByInvestmentIdOrderByTxnDateAsc(Long investmentId);
    Optional<InvestmentTransaction> findByIdAndInvestment_UserId(Long id, Long userId);
}
