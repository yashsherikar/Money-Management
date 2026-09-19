package com.frugality.moneymanager.dto;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;

public class EmiDtos {

    public record EmiRequest(
            @NotNull Long accountId,
            @NotBlank String loanName,
            @NotNull @DecimalMin("0.01") BigDecimal principal,
            @NotNull @DecimalMin("0") BigDecimal interestRate,
            @NotNull @Min(1) Integer tenureMonths,
            @NotNull @DecimalMin("0.01") BigDecimal emiAmount,
            @NotNull LocalDate startDate,
            @NotNull @Min(1) @Max(28) Integer dueDay
    ) {}

    public record EmiResponse(
            Long id,
            Long accountId,
            String loanName,
            BigDecimal principal,
            BigDecimal interestRate,
            Integer tenureMonths,
            BigDecimal emiAmount,
            LocalDate startDate,
            Integer dueDay,
            boolean active
    ) {}
}
