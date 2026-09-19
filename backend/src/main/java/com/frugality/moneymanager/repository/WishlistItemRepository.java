package com.frugality.moneymanager.repository;

import com.frugality.moneymanager.entity.WishlistItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WishlistItemRepository extends JpaRepository<WishlistItem, Long> {
    List<WishlistItem> findByUserIdOrderByCreatedAtDesc(Long userId);
    Optional<WishlistItem> findByIdAndUserId(Long id, Long userId);
}
