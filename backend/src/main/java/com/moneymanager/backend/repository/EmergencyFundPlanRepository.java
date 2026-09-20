package com.moneymanager.backend.repository;

import com.moneymanager.backend.entity.EmergencyFundPlan;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface EmergencyFundPlanRepository extends JpaRepository<EmergencyFundPlan, Long> {
    List<EmergencyFundPlan> findByUserIdOrderByDayOfMonthAsc(Long userId);
    Optional<EmergencyFundPlan> findByIdAndUserId(Long id, Long userId);
    List<EmergencyFundPlan> findByActiveTrue();
}
