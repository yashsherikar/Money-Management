package com.frugality.moneymanager.repository;

import com.frugality.moneymanager.entity.Transaction;
import com.frugality.moneymanager.entity.TransactionType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface TransactionRepository extends JpaRepository<Transaction, Long> {

    List<Transaction> findByUserIdAndTxnDateBetweenOrderByTxnDateDesc(Long userId, LocalDate from, LocalDate to);

    Optional<Transaction> findByIdAndUserId(Long id, Long userId);

    @Query("select coalesce(sum(t.amount), 0) from Transaction t " +
            "where t.user.id = :userId and t.type = :type and t.txnDate between :from and :to")
    BigDecimal sumByUserAndTypeAndRange(@Param("userId") Long userId,
                                         @Param("type") TransactionType type,
                                         @Param("from") LocalDate from,
                                         @Param("to") LocalDate to);

    @Query("select t.category.id, coalesce(sum(t.amount), 0) from Transaction t " +
            "where t.user.id = :userId and t.type = 'EXPENSE' and t.txnDate between :from and :to " +
            "group by t.category.id")
    List<Object[]> sumExpenseByCategory(@Param("userId") Long userId,
                                         @Param("from") LocalDate from,
                                         @Param("to") LocalDate to);

    @Query("select t from Transaction t where t.user.id = :userId and t.type = 'EXPENSE' " +
            "and t.category.essential = false and t.txnDate between :from and :to order by t.amount desc")
    List<Transaction> findNonEssentialExpenses(@Param("userId") Long userId,
                                                @Param("from") LocalDate from,
                                                @Param("to") LocalDate to);
}
