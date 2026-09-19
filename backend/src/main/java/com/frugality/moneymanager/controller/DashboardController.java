package com.frugality.moneymanager.controller;

import com.frugality.moneymanager.dto.DashboardDtos.DashboardSummary;
import com.frugality.moneymanager.entity.User;
import com.frugality.moneymanager.service.DashboardService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.YearMonth;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping("/summary")
    public DashboardSummary summary(@AuthenticationPrincipal User user,
                                     @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM") YearMonth month) {
        return dashboardService.summary(user, month != null ? month : YearMonth.now());
    }
}
