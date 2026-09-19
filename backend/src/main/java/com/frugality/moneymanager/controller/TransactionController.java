package com.frugality.moneymanager.controller;

import com.frugality.moneymanager.dto.TransactionDtos.*;
import com.frugality.moneymanager.entity.User;
import com.frugality.moneymanager.service.TransactionService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

@RestController
@RequestMapping("/api/transactions")
public class TransactionController {

    private final TransactionService transactionService;

    public TransactionController(TransactionService transactionService) {
        this.transactionService = transactionService;
    }

    @GetMapping
    public List<TransactionResponse> list(@AuthenticationPrincipal User user,
                                           @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                           @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        YearMonth currentMonth = YearMonth.now();
        LocalDate effectiveFrom = from != null ? from : currentMonth.atDay(1);
        LocalDate effectiveTo = to != null ? to : currentMonth.atEndOfMonth();
        return transactionService.list(user, effectiveFrom, effectiveTo);
    }

    @PostMapping
    public TransactionResponse create(@AuthenticationPrincipal User user, @Valid @RequestBody TransactionRequest request) {
        return transactionService.create(user, request);
    }

    @PutMapping("/{id}")
    public TransactionResponse update(@AuthenticationPrincipal User user, @PathVariable Long id,
                                       @Valid @RequestBody TransactionRequest request) {
        return transactionService.update(user, id, request);
    }

    @DeleteMapping("/{id}")
    public void delete(@AuthenticationPrincipal User user, @PathVariable Long id) {
        transactionService.delete(user, id);
    }
}
