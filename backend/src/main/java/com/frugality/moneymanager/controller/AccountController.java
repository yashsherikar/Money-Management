package com.frugality.moneymanager.controller;

import com.frugality.moneymanager.dto.AccountDtos.*;
import com.frugality.moneymanager.entity.User;
import com.frugality.moneymanager.service.AccountService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/accounts")
public class AccountController {

    private final AccountService accountService;

    public AccountController(AccountService accountService) {
        this.accountService = accountService;
    }

    @GetMapping
    public List<AccountResponse> list(@AuthenticationPrincipal User user) {
        return accountService.list(user);
    }

    @PostMapping
    public AccountResponse create(@AuthenticationPrincipal User user, @Valid @RequestBody AccountRequest request) {
        return accountService.create(user, request);
    }

    @PutMapping("/{id}")
    public AccountResponse update(@AuthenticationPrincipal User user, @PathVariable Long id,
                                   @Valid @RequestBody AccountRequest request) {
        return accountService.update(user, id, request);
    }

    @DeleteMapping("/{id}")
    public void delete(@AuthenticationPrincipal User user, @PathVariable Long id) {
        accountService.delete(user, id);
    }
}
