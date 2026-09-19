package com.moneymanager.backend.controller;

import com.moneymanager.backend.dto.SplitBillDtos.*;
import com.moneymanager.backend.entity.User;
import com.moneymanager.backend.service.SplitBillService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/split-bills")
public class SplitBillController {

    private final SplitBillService splitBillService;

    public SplitBillController(SplitBillService splitBillService) {
        this.splitBillService = splitBillService;
    }

    @GetMapping
    public List<SplitBillResponse> list(@AuthenticationPrincipal User user) {
        return splitBillService.list(user);
    }

    @PostMapping
    public SplitBillResponse create(@AuthenticationPrincipal User user, @Valid @RequestBody SplitBillRequest request) {
        return splitBillService.create(user, request);
    }

    @PutMapping("/participants/{participantId}/pay")
    public SplitBillResponse markPaid(@AuthenticationPrincipal User user, @PathVariable Long participantId) {
        return splitBillService.markParticipantPaid(user, participantId);
    }

    @DeleteMapping("/{id}")
    public void delete(@AuthenticationPrincipal User user, @PathVariable Long id) {
        splitBillService.delete(user, id);
    }
}
