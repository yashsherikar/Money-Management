package com.moneymanager.backend.repository;

import com.moneymanager.backend.entity.UdharEntry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UdharEntryRepository extends JpaRepository<UdharEntry, Long> {
    List<UdharEntry> findByUserIdOrderByTxnDateDesc(Long userId);
    Optional<UdharEntry> findByIdAndUserId(Long id, Long userId);
}
