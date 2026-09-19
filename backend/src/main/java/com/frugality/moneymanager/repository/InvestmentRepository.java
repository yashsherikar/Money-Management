package com.frugality.moneymanager.repository;

import com.frugality.moneymanager.entity.Investment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface InvestmentRepository extends JpaRepository<Investment, Long> {
    List<Investment> findByUserIdOrderByCreatedAtDesc(Long userId);
    Optional<Investment> findByIdAndUserId(Long id, Long userId);
}
