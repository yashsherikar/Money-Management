package com.moneymanager.backend.controller;

import com.moneymanager.backend.dto.ProfileDtos.*;
import com.moneymanager.backend.entity.User;
import com.moneymanager.backend.service.ProfileService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/profile")
public class ProfileController {

    private final ProfileService profileService;

    public ProfileController(ProfileService profileService) {
        this.profileService = profileService;
    }

    @GetMapping
    public ProfileResponse get(@AuthenticationPrincipal User user) {
        return profileService.get(user);
    }

    @PutMapping
    public ProfileResponse update(@AuthenticationPrincipal User user, @RequestBody UpdateProfileRequest request) {
        return profileService.update(user, request);
    }

    @PutMapping("/password")
    public ProfileResponse changePassword(@AuthenticationPrincipal User user, @Valid @RequestBody ChangePasswordRequest request) {
        return profileService.changePassword(user, request);
    }

    @PutMapping("/pin")
    public ProfileResponse setPin(@AuthenticationPrincipal User user, @Valid @RequestBody SetPinRequest request) {
        return profileService.setPin(user, request);
    }

    @PutMapping("/photo")
    public ProfileResponse updatePhoto(@AuthenticationPrincipal User user, @Valid @RequestBody PhotoRequest request) {
        return profileService.updatePhoto(user, request);
    }

    @DeleteMapping("/photo")
    public ProfileResponse removePhoto(@AuthenticationPrincipal User user) {
        return profileService.removePhoto(user);
    }

    @PostMapping("/reveal-balance")
    public TotalBalanceResponse revealBalance(@AuthenticationPrincipal User user, @Valid @RequestBody RevealBalanceRequest request) {
        return profileService.revealBalance(user, request);
    }
}
