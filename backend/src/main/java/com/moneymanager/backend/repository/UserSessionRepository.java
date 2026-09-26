package com.moneymanager.backend.repository;

import com.moneymanager.backend.entity.UserSession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface UserSessionRepository extends JpaRepository<UserSession, Long> {
    List<UserSession> findByUserIdOrderByCreatedAtAsc(Long userId);
    boolean existsByJti(String jti);
    void deleteByJti(String jti);
}
