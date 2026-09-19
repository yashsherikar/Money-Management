package com.moneymanager.backend.repository;

import com.moneymanager.backend.entity.SplitBillParticipant;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SplitBillParticipantRepository extends JpaRepository<SplitBillParticipant, Long> {
    Optional<SplitBillParticipant> findByIdAndSplitBill_UserId(Long id, Long userId);
}
