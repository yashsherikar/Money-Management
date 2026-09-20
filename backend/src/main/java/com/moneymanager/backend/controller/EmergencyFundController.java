package com.moneymanager.backend.controller;

import com.moneymanager.backend.dto.EmergencyFundDtos.*;
import com.moneymanager.backend.entity.User;
import com.moneymanager.backend.service.EmergencyFundService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/emergency-fund")
public class EmergencyFundController {

    private final EmergencyFundService emergencyFundService;

    public EmergencyFundController(EmergencyFundService emergencyFundService) {
        this.emergencyFundService = emergencyFundService;
    }

    @GetMapping
    public List<EmergencyFundResponse> list(@AuthenticationPrincipal User user) {
        return emergencyFundService.list(user);
    }

    @GetMapping("/due")
    public List<EmergencyFundResponse> due(@AuthenticationPrincipal User user) {
        return emergencyFundService.due(user);
    }

    @PostMapping
    public EmergencyFundResponse create(@AuthenticationPrincipal User user, @Valid @RequestBody EmergencyFundRequest request) {
        return emergencyFundService.create(user, request);
    }

    @PostMapping("/{id}/confirm")
    public EmergencyFundResponse confirm(@AuthenticationPrincipal User user, @PathVariable Long id) {
        return emergencyFundService.confirmContribution(user, id);
    }

    @PatchMapping("/{id}/active")
    public EmergencyFundResponse setActive(@AuthenticationPrincipal User user, @PathVariable Long id, @RequestParam boolean active) {
        return emergencyFundService.setActive(user, id, active);
    }

    @DeleteMapping("/{id}")
    public void delete(@AuthenticationPrincipal User user, @PathVariable Long id) {
        emergencyFundService.delete(user, id);
    }
}
