package com.moneymanager.backend.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public class EmergencyFundDtos {

    public record EmergencyFundRequest(
            @NotNull Long sourceAccountId,
            @NotNull Long targetAccountId,
            @NotNull @DecimalMin("0.01") BigDecimal amount,
            @NotNull @Min(1) @Max(28) Integer dayOfMonth
    ) {}

    public record EmergencyFundResponse(
            Long id,
            Long sourceAccountId,
            String sourceAccountName,
            Long targetAccountId,
            String targetAccountName,
            BigDecimal amount,
            int dayOfMonth,
            boolean active
    ) {}
}
