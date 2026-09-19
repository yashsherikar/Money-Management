package com.frugality.moneymanager.controller;

import com.frugality.moneymanager.dto.UdharDtos.*;
import com.frugality.moneymanager.entity.User;
import com.frugality.moneymanager.service.UdharService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/udhar")
public class UdharController {

    private final UdharService udharService;

    public UdharController(UdharService udharService) {
        this.udharService = udharService;
    }

    @GetMapping
    public List<UdharResponse> list(@AuthenticationPrincipal User user) {
        return udharService.list(user);
    }

    @GetMapping("/summary")
    public UdharSummary summary(@AuthenticationPrincipal User user) {
        return udharService.summary(user);
    }

    @PostMapping
    public UdharResponse create(@AuthenticationPrincipal User user, @Valid @RequestBody UdharRequest request) {
        return udharService.create(user, request);
    }

    @PatchMapping("/{id}/settle")
    public UdharResponse settle(@AuthenticationPrincipal User user, @PathVariable Long id) {
        return udharService.settle(user, id);
    }

    @DeleteMapping("/{id}")
    public void delete(@AuthenticationPrincipal User user, @PathVariable Long id) {
        udharService.delete(user, id);
    }
}
