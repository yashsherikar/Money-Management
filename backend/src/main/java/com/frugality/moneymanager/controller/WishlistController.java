package com.frugality.moneymanager.controller;

import com.frugality.moneymanager.dto.WishlistDtos.*;
import com.frugality.moneymanager.entity.User;
import com.frugality.moneymanager.service.WishlistService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/wishlist")
public class WishlistController {

    private final WishlistService wishlistService;

    public WishlistController(WishlistService wishlistService) {
        this.wishlistService = wishlistService;
    }

    @GetMapping
    public List<WishlistItemResponse> list(@AuthenticationPrincipal User user) {
        return wishlistService.list(user);
    }

    @PostMapping
    public WishlistItemResponse create(@AuthenticationPrincipal User user, @Valid @RequestBody WishlistItemRequest request) {
        return wishlistService.create(user, request);
    }

    @DeleteMapping("/{id}")
    public void delete(@AuthenticationPrincipal User user, @PathVariable Long id) {
        wishlistService.delete(user, id);
    }

    @PatchMapping("/{id}/purchased")
    public WishlistItemResponse markPurchased(@AuthenticationPrincipal User user, @PathVariable Long id) {
        return wishlistService.markPurchased(user, id);
    }

    @GetMapping("/{id}/affordability")
    public AffordabilityResponse affordability(@AuthenticationPrincipal User user, @PathVariable Long id) {
        return wishlistService.affordability(user, id);
    }

    @PostMapping("/{id}/contribution-requests")
    public List<ContributionRequestResponse> requestContributions(@AuthenticationPrincipal User user, @PathVariable Long id,
                                                                    @Valid @RequestBody BulkContributionRequest request) {
        return wishlistService.requestContributions(user, id, request);
    }
}
