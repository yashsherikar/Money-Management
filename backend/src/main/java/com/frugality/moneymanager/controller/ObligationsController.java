package com.frugality.moneymanager.controller;

import com.frugality.moneymanager.dto.ObligationsDtos.ObligationsSummary;
import com.frugality.moneymanager.entity.User;
import com.frugality.moneymanager.service.ObligationsService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/obligations")
public class ObligationsController {

    private final ObligationsService obligationsService;

    public ObligationsController(ObligationsService obligationsService) {
        this.obligationsService = obligationsService;
    }

    @GetMapping("/summary")
    public ObligationsSummary summary(@AuthenticationPrincipal User user) {
        return obligationsService.summary(user);
    }
}
