package com.frugality.moneymanager.repository;

import com.frugality.moneymanager.entity.InsurancePolicy;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface InsurancePolicyRepository extends JpaRepository<InsurancePolicy, Long> {
    List<InsurancePolicy> findByUserIdOrderByDueDateAsc(Long userId);
    Optional<InsurancePolicy> findByIdAndUserId(Long id, Long userId);
}
