package com.frugality.moneymanager.controller;

import com.frugality.moneymanager.dto.ProfileDtos.*;
import com.frugality.moneymanager.entity.User;
import com.frugality.moneymanager.service.ProfileService;
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
}
