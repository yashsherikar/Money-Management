package com.frugality.moneymanager.repository;

import com.frugality.moneymanager.entity.SplitBillParticipant;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SplitBillParticipantRepository extends JpaRepository<SplitBillParticipant, Long> {
    Optional<SplitBillParticipant> findByIdAndSplitBill_UserId(Long id, Long userId);
}
