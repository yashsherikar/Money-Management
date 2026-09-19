package com.moneymanager.backend.repository;

import com.moneymanager.backend.entity.Emi;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface EmiRepository extends JpaRepository<Emi, Long> {
    List<Emi> findByUserIdOrderByStartDateDesc(Long userId);
    Optional<Emi> findByIdAndUserId(Long id, Long userId);
    List<Emi> findByActiveTrue();
}
