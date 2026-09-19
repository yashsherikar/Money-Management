package com.moneymanager.backend.controller;

import com.moneymanager.backend.dto.EmiDtos.*;
import com.moneymanager.backend.entity.User;
import com.moneymanager.backend.service.EmiService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/emis")
public class EmiController {

    private final EmiService emiService;

    public EmiController(EmiService emiService) {
        this.emiService = emiService;
    }

    @GetMapping
    public List<EmiResponse> list(@AuthenticationPrincipal User user) {
        return emiService.list(user);
    }

    @PostMapping
    public EmiResponse create(@AuthenticationPrincipal User user, @Valid @RequestBody EmiRequest request) {
        return emiService.create(user, request);
    }

    @PutMapping("/{id}")
    public EmiResponse update(@AuthenticationPrincipal User user, @PathVariable Long id,
                               @Valid @RequestBody EmiRequest request) {
        return emiService.update(user, id, request);
    }

    @PatchMapping("/{id}/active")
    public EmiResponse setActive(@AuthenticationPrincipal User user, @PathVariable Long id, @RequestParam boolean active) {
        return emiService.setActive(user, id, active);
    }

    @DeleteMapping("/{id}")
    public void delete(@AuthenticationPrincipal User user, @PathVariable Long id) {
        emiService.delete(user, id);
    }
}
