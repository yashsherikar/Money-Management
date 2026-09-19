package com.frugality.moneymanager.controller;

import com.frugality.moneymanager.dto.FixedDepositDtos.*;
import com.frugality.moneymanager.entity.User;
import com.frugality.moneymanager.service.FixedDepositService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/fixed-deposits")
public class FixedDepositController {

    private final FixedDepositService fixedDepositService;

    public FixedDepositController(FixedDepositService fixedDepositService) {
        this.fixedDepositService = fixedDepositService;
    }

    @GetMapping
    public List<FdResponse> list(@AuthenticationPrincipal User user) {
        return fixedDepositService.list(user);
    }

    @PostMapping
    public FdResponse create(@AuthenticationPrincipal User user, @Valid @RequestBody FdRequest request) {
        return fixedDepositService.create(user, request);
    }

    @PutMapping("/{id}")
    public FdResponse update(@AuthenticationPrincipal User user, @PathVariable Long id,
                              @Valid @RequestBody FdRequest request) {
        return fixedDepositService.update(user, id, request);
    }

    @DeleteMapping("/{id}")
    public void delete(@AuthenticationPrincipal User user, @PathVariable Long id) {
        fixedDepositService.delete(user, id);
    }
}
