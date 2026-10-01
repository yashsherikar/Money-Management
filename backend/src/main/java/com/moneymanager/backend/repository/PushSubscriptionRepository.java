package com.moneymanager.backend.repository;

import com.moneymanager.backend.entity.PushSubscription;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, Long> {
    List<PushSubscription> findByUserId(Long userId);
    List<PushSubscription> findByUserIdOrderByCreatedAtAsc(Long userId);
    Optional<PushSubscription> findByEndpoint(String endpoint);
    Optional<PushSubscription> findByEndpointAndUserId(String endpoint, Long userId);
    Optional<PushSubscription> findByFcmToken(String fcmToken);
    void deleteByUserIdAndFcmTokenIsNull(Long userId);
}
