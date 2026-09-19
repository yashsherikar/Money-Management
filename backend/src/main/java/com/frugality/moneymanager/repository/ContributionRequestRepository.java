package com.frugality.moneymanager.repository;

import com.frugality.moneymanager.entity.ContributionRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ContributionRequestRepository extends JpaRepository<ContributionRequest, Long> {
    List<ContributionRequest> findByWishlistItemIdOrderByCreatedAtDesc(Long wishlistItemId);
    List<ContributionRequest> findByMemberIdOrderByCreatedAtDesc(Long memberId);
    List<ContributionRequest> findByRequesterIdOrderByCreatedAtDesc(Long requesterId);
    Optional<ContributionRequest> findByIdAndMemberId(Long id, Long memberId);
    Optional<ContributionRequest> findByIdAndRequesterId(Long id, Long requesterId);
}
