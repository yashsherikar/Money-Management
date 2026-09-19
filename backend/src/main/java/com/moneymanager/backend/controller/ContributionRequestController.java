package com.moneymanager.backend.controller;

import com.moneymanager.backend.dto.WishlistDtos.ContributionRequestResponse;
import com.moneymanager.backend.entity.User;
import com.moneymanager.backend.service.WishlistService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/contribution-requests")
public class ContributionRequestController {

    private final WishlistService wishlistService;

    public ContributionRequestController(WishlistService wishlistService) {
        this.wishlistService = wishlistService;
    }

    @GetMapping("/incoming")
    public List<ContributionRequestResponse> incoming(@AuthenticationPrincipal User user) {
        return wishlistService.incomingRequests(user);
    }

    @GetMapping("/outgoing")
    public List<ContributionRequestResponse> outgoing(@AuthenticationPrincipal User user) {
        return wishlistService.outgoingRequests(user);
    }

    @PatchMapping("/{id}/accept")
    public ContributionRequestResponse accept(@AuthenticationPrincipal User user, @PathVariable Long id) {
        return wishlistService.respond(user, id, true);
    }

    @PatchMapping("/{id}/decline")
    public ContributionRequestResponse decline(@AuthenticationPrincipal User user, @PathVariable Long id) {
        return wishlistService.respond(user, id, false);
    }

    @PatchMapping("/{id}/mark-paid")
    public ContributionRequestResponse markPaid(@AuthenticationPrincipal User user, @PathVariable Long id) {
        return wishlistService.markPaid(user, id);
    }
}
