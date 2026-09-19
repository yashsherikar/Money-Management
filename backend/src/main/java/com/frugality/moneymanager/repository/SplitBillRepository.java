package com.frugality.moneymanager.repository;

import com.frugality.moneymanager.entity.SplitBill;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SplitBillRepository extends JpaRepository<SplitBill, Long> {
    List<SplitBill> findByUserIdOrderByBillDateDesc(Long userId);
    Optional<SplitBill> findByIdAndUserId(Long id, Long userId);
}
