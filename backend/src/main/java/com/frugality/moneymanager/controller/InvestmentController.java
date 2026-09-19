package com.frugality.moneymanager.controller;

import com.frugality.moneymanager.dto.InvestmentDtos.*;
import com.frugality.moneymanager.entity.User;
import com.frugality.moneymanager.service.InvestmentService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/investments")
public class InvestmentController {

    private final InvestmentService investmentService;

    public InvestmentController(InvestmentService investmentService) {
        this.investmentService = investmentService;
    }

    @GetMapping
    public List<InvestmentResponse> list(@AuthenticationPrincipal User user) {
        return investmentService.list(user);
    }

    @GetMapping("/summary")
    public PortfolioSummary summary(@AuthenticationPrincipal User user) {
        return investmentService.summary(user);
    }

    @PostMapping
    public InvestmentResponse create(@AuthenticationPrincipal User user, @Valid @RequestBody InvestmentRequest request) {
        return investmentService.create(user, request);
    }

    @PutMapping("/{id}/current-value")
    public InvestmentResponse updateCurrentValue(@AuthenticationPrincipal User user, @PathVariable Long id,
                                                  @Valid @RequestBody CurrentValueRequest request) {
        return investmentService.updateCurrentValue(user, id, request);
    }

    @PostMapping("/{id}/transactions")
    public InvestmentResponse addTransaction(@AuthenticationPrincipal User user, @PathVariable Long id,
                                              @Valid @RequestBody InvestmentTxnRequest request) {
        return investmentService.addTransaction(user, id, request);
    }

    @DeleteMapping("/transactions/{txnId}")
    public void deleteTransaction(@AuthenticationPrincipal User user, @PathVariable Long txnId) {
        investmentService.deleteTransaction(user, txnId);
    }

    @DeleteMapping("/{id}")
    public void delete(@AuthenticationPrincipal User user, @PathVariable Long id) {
        investmentService.delete(user, id);
    }
}
