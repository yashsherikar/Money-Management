package com.moneymanager.backend.controller;

import com.moneymanager.backend.dto.ProfileDtos.*;
import com.moneymanager.backend.entity.User;
import com.moneymanager.backend.service.ProfileService;
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
