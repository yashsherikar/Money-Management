package com.moneymanager.backend.repository;

import com.moneymanager.backend.entity.AppNotification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AppNotificationRepository extends JpaRepository<AppNotification, Long> {
    List<AppNotification> findTop50ByUserIdOrderByCreatedAtDesc(Long userId);
    long countByUserIdAndViewedFalse(Long userId);
    Optional<AppNotification> findByIdAndUserId(Long id, Long userId);
    List<AppNotification> findByRelatedTypeAndRelatedId(String relatedType, Long relatedId);
}
