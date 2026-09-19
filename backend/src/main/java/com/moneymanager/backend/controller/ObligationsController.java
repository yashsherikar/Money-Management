package com.moneymanager.backend.controller;

import com.moneymanager.backend.dto.ObligationsDtos.ObligationsSummary;
import com.moneymanager.backend.entity.User;
import com.moneymanager.backend.service.ObligationsService;
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
