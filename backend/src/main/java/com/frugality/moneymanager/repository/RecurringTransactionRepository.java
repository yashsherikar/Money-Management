package com.frugality.moneymanager.repository;

import com.frugality.moneymanager.entity.RecurringTransaction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RecurringTransactionRepository extends JpaRepository<RecurringTransaction, Long> {
    List<RecurringTransaction> findByUserIdOrderByDayOfMonthAsc(Long userId);
    Optional<RecurringTransaction> findByIdAndUserId(Long id, Long userId);
    List<RecurringTransaction> findByActiveTrue();
}
