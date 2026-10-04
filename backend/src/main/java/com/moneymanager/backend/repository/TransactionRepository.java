package com.moneymanager.backend.repository;

import com.moneymanager.backend.entity.Transaction;
import com.moneymanager.backend.entity.TransactionType;
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

    /** Exclude internal self-transfers (description starts with Transfer:) from spend/earn totals. */
    @Query("select coalesce(sum(t.amount), 0) from Transaction t " +
            "where t.user.id = :userId and t.type = :type and t.txnDate between :from and :to " +
            "and (t.description is null or lower(t.description) not like 'transfer:%')")
    BigDecimal sumByUserAndTypeAndRange(@Param("userId") Long userId,
                                         @Param("type") TransactionType type,
                                         @Param("from") LocalDate from,
                                         @Param("to") LocalDate to);

    /** Dashboard: primary bank account only (secondary banks stay on Transactions). */
    @Query("select coalesce(sum(t.amount), 0) from Transaction t " +
            "where t.user.id = :userId and t.account.id = :accountId and t.type = :type " +
            "and t.txnDate between :from and :to " +
            "and (t.description is null or lower(t.description) not like 'transfer:%')")
    BigDecimal sumByUserAccountAndTypeAndRange(@Param("userId") Long userId,
                                                @Param("accountId") Long accountId,
                                                @Param("type") TransactionType type,
                                                @Param("from") LocalDate from,
                                                @Param("to") LocalDate to);

    @Query("select t.category.id, coalesce(sum(t.amount), 0) from Transaction t " +
            "where t.user.id = :userId and t.type = 'EXPENSE' and t.txnDate between :from and :to " +
            "and (t.description is null or lower(t.description) not like 'transfer:%') " +
            "group by t.category.id")
    List<Object[]> sumExpenseByCategory(@Param("userId") Long userId,
                                         @Param("from") LocalDate from,
                                         @Param("to") LocalDate to);

    @Query("select t.category.id, coalesce(sum(t.amount), 0) from Transaction t " +
            "where t.user.id = :userId and t.account.id = :accountId and t.type = 'EXPENSE' " +
            "and t.txnDate between :from and :to " +
            "and (t.description is null or lower(t.description) not like 'transfer:%') " +
            "group by t.category.id")
    List<Object[]> sumExpenseByCategoryForAccount(@Param("userId") Long userId,
                                                   @Param("accountId") Long accountId,
                                                   @Param("from") LocalDate from,
                                                   @Param("to") LocalDate to);

    @Query("select t from Transaction t join fetch t.category where t.user.id = :userId and t.type = 'EXPENSE' " +
            "and t.category.essential = false and t.fromRecurring = false " +
            "and t.txnDate between :from and :to " +
            "and (t.description is null or lower(t.description) not like 'transfer:%') " +
            "and not exists (select 1 from RecurringTransaction r where r.user.id = :userId " +
            "  and r.description = t.description and r.amount = t.amount) " +
            "order by t.amount desc")
    List<Transaction> findNonEssentialExpenses(@Param("userId") Long userId,
                                                @Param("from") LocalDate from,
                                                @Param("to") LocalDate to);

    @Query("select t from Transaction t join fetch t.category where t.user.id = :userId " +
            "and t.account.id = :accountId and t.type = 'EXPENSE' " +
            "and t.category.essential = false and t.fromRecurring = false " +
            "and t.txnDate between :from and :to " +
            "and (t.description is null or lower(t.description) not like 'transfer:%') " +
            "and not exists (select 1 from RecurringTransaction r where r.user.id = :userId " +
            "  and r.description = t.description and r.amount = t.amount) " +
            "order by t.amount desc")
    List<Transaction> findNonEssentialExpensesForAccount(@Param("userId") Long userId,
                                                          @Param("accountId") Long accountId,
                                                          @Param("from") LocalDate from,
                                                          @Param("to") LocalDate to);

    /** History insights: expenses across all accounts (exclude self-transfers). */
    @Query("select t from Transaction t left join fetch t.category " +
            "where t.user.id = :userId and t.type = 'EXPENSE' and t.txnDate between :from and :to " +
            "and (t.description is null or lower(t.description) not like 'transfer:%') " +
            "order by t.txnDate desc")
    List<Transaction> findExpensesForHistory(@Param("userId") Long userId,
                                              @Param("from") LocalDate from,
                                              @Param("to") LocalDate to);

    @Query("select min(t.txnDate) from Transaction t where t.user.id = :userId")
    LocalDate findEarliestTxnDate(@Param("userId") Long userId);
}
