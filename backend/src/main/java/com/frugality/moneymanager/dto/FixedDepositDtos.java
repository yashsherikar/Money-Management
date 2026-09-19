package com.frugality.moneymanager.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;

public class FixedDepositDtos {

    public record FdRequest(
            @NotBlank String bankName,
            @NotNull @DecimalMin("0.01") BigDecimal principal,
            @NotNull @DecimalMin("0") BigDecimal interestRate,
            @NotNull LocalDate startDate,
            @NotNull LocalDate maturityDate,
            @NotNull @DecimalMin("0.01") BigDecimal maturityAmount
    ) {}

    public record FdResponse(
            Long id,
            String bankName,
            BigDecimal principal,
            BigDecimal interestRate,
            LocalDate startDate,
            LocalDate maturityDate,
            BigDecimal maturityAmount,
            long daysToMaturity,
            boolean maturingSoon
    ) {}
}
