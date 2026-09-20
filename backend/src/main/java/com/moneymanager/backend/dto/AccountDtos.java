package com.moneymanager.backend.dto;

import com.moneymanager.backend.entity.AccountType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public class AccountDtos {

    public record AccountRequest(
            @NotBlank String name,
            @NotNull AccountType type,
            BigDecimal balance,
            boolean isPrimary
    ) {}

    public record AccountResponse(
            Long id,
            String name,
            AccountType type,
            BigDecimal balance,
            boolean isPrimary
    ) {}
}
