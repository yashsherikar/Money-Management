package com.moneymanager.backend.dto;

import com.moneymanager.backend.entity.WishlistStatus;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.List;

public class WishlistDtos {

    public record WishlistItemRequest(
            @NotBlank String name,
            @NotNull @DecimalMin("0.01") BigDecimal price,
            String productUrl,
            Long groupId
    ) {}

    public record WishlistItemResponse(
            Long id,
            String name,
            BigDecimal price,
            String productUrl,
            WishlistStatus status,
            Long groupId,
            String groupName
    ) {}

    public record AffordabilityResponse(
            BigDecimal price,
            BigDecimal availableFunds,
            BigDecimal shortfall,
            boolean affordable,
            boolean comfortable,
            String recommendation
    ) {}

    public record ContributionRequestCreate(
            @NotNull Long memberId,
            @NotNull @DecimalMin("0.01") BigDecimal amount
    ) {}

    public record ContributionRequestResponse(
            Long id,
            Long wishlistItemId,
            String wishlistItemName,
            Long requesterId,
            String requesterName,
            String requesterUpiId,
            Long memberId,
            String memberName,
            BigDecimal amount,
            String status,
            String upiPayLink
    ) {}

    public record BulkContributionRequest(
            List<ContributionRequestCreate> requests
    ) {}
}
