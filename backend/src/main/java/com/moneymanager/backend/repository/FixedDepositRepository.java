package com.moneymanager.backend.repository;

import com.moneymanager.backend.entity.FixedDeposit;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FixedDepositRepository extends JpaRepository<FixedDeposit, Long> {
    List<FixedDeposit> findByUserIdOrderByMaturityDateAsc(Long userId);
    Optional<FixedDeposit> findByIdAndUserId(Long id, Long userId);
}
