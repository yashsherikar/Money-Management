package com.moneymanager.backend.controller;

import com.moneymanager.backend.dto.HistoryDtos.HistoryInsights;
import com.moneymanager.backend.entity.User;
import com.moneymanager.backend.service.HistoryService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/history")
public class HistoryController {

    private final HistoryService historyService;

    public HistoryController(HistoryService historyService) {
        this.historyService = historyService;
    }

    /**
     * Multi-month spend insights. {@code months=999} ≈ all available history (capped at 60).
     */
    @GetMapping("/insights")
    public HistoryInsights insights(@AuthenticationPrincipal User user,
                                     @RequestParam(defaultValue = "12") int months) {
        return historyService.insights(user, months);
    }
}
