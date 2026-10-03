package com.moneymanager.backend.repository;

import com.moneymanager.backend.entity.SplitBill;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface SplitBillRepository extends JpaRepository<SplitBill, Long> {
    List<SplitBill> findByUserIdOrderByBillDateDesc(Long userId);
    Optional<SplitBill> findByIdAndUserId(Long id, Long userId);
    Optional<SplitBill> findBySourceTransactionId(Long sourceTransactionId);
    boolean existsBySourceTransactionId(Long sourceTransactionId);

    @Query("select s from SplitBill s where s.user.id = :userId and (" +
            "s.sourceTransaction.id in :txnIds or s.expenseTransaction.id in :txnIds)")
    List<SplitBill> findLinkedToTransactions(@Param("userId") Long userId,
                                             @Param("txnIds") Collection<Long> txnIds);
}
