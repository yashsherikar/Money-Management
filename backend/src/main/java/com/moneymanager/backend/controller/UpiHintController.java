package com.moneymanager.backend.controller;

import com.moneymanager.backend.dto.UpiHintDtos.UpiHintRequest;
import com.moneymanager.backend.dto.UpiHintDtos.UpiHintResponse;
import com.moneymanager.backend.entity.User;
import com.moneymanager.backend.service.UpiHintService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/upi-hints")
public class UpiHintController {

    private final UpiHintService upiHintService;

    public UpiHintController(UpiHintService upiHintService) {
        this.upiHintService = upiHintService;
    }

    @GetMapping
    public UpiHintResponse get(@AuthenticationPrincipal User user, @RequestParam String upiId) {
        return upiHintService.find(upiId);
    }

    @PutMapping
    public UpiHintResponse save(@AuthenticationPrincipal User user, @Valid @RequestBody UpiHintRequest request) {
        return upiHintService.save(request);
    }
}
