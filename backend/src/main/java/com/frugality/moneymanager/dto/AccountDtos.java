package com.frugality.moneymanager.dto;

import com.frugality.moneymanager.entity.AccountType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public class AccountDtos {

    public record AccountRequest(
            @NotBlank String name,
            @NotNull AccountType type,
            BigDecimal balance
    ) {}

    public record AccountResponse(
            Long id,
            String name,
            AccountType type,
            BigDecimal balance
    ) {}
}
