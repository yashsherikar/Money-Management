package com.moneymanager.backend.controller;

import com.moneymanager.backend.dto.RecurringTransactionDtos.*;
import com.moneymanager.backend.entity.User;
import com.moneymanager.backend.service.RecurringTransactionService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/recurring-transactions")
public class RecurringTransactionController {

    private final RecurringTransactionService recurringTransactionService;

    public RecurringTransactionController(RecurringTransactionService recurringTransactionService) {
        this.recurringTransactionService = recurringTransactionService;
    }

    @GetMapping
    public List<RecurringResponse> list(@AuthenticationPrincipal User user) {
        return recurringTransactionService.list(user);
    }

    @GetMapping("/due")
    public List<RecurringResponse> due(@AuthenticationPrincipal User user) {
        return recurringTransactionService.due(user);
    }

    @PostMapping("/{id}/confirm")
    public RecurringResponse confirm(@AuthenticationPrincipal User user, @PathVariable Long id) {
        return recurringTransactionService.confirmPaid(user, id);
    }

    @PostMapping
    public RecurringResponse create(@AuthenticationPrincipal User user, @Valid @RequestBody RecurringRequest request) {
        return recurringTransactionService.create(user, request);
    }

    @PutMapping("/{id}")
    public RecurringResponse update(@AuthenticationPrincipal User user, @PathVariable Long id,
                                     @Valid @RequestBody RecurringRequest request) {
        return recurringTransactionService.update(user, id, request);
    }

    @PatchMapping("/{id}/active")
    public RecurringResponse setActive(@AuthenticationPrincipal User user, @PathVariable Long id, @RequestParam boolean active) {
        return recurringTransactionService.setActive(user, id, active);
    }

    @DeleteMapping("/{id}")
    public void delete(@AuthenticationPrincipal User user, @PathVariable Long id) {
        recurringTransactionService.delete(user, id);
    }
}
