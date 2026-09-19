package com.moneymanager.backend.repository;

import com.moneymanager.backend.entity.WishRoomConnection;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface WishRoomConnectionRepository extends JpaRepository<WishRoomConnection, Long> {
    Optional<WishRoomConnection> findByUserId(Long userId);
}
