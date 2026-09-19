package com.moneymanager.backend.controller;

import com.moneymanager.backend.dto.InsuranceDtos.*;
import com.moneymanager.backend.entity.User;
import com.moneymanager.backend.service.InsuranceService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/insurance-policies")
public class InsuranceController {

    private final InsuranceService insuranceService;

    public InsuranceController(InsuranceService insuranceService) {
        this.insuranceService = insuranceService;
    }

    @GetMapping
    public List<InsuranceResponse> list(@AuthenticationPrincipal User user) {
        return insuranceService.list(user);
    }

    @PostMapping
    public InsuranceResponse create(@AuthenticationPrincipal User user, @Valid @RequestBody InsuranceRequest request) {
        return insuranceService.create(user, request);
    }

    @PutMapping("/{id}")
    public InsuranceResponse update(@AuthenticationPrincipal User user, @PathVariable Long id,
                                     @Valid @RequestBody InsuranceRequest request) {
        return insuranceService.update(user, id, request);
    }

    @DeleteMapping("/{id}")
    public void delete(@AuthenticationPrincipal User user, @PathVariable Long id) {
        insuranceService.delete(user, id);
    }
}
