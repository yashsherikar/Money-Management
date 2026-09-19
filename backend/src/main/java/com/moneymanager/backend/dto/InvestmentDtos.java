package com.moneymanager.backend.dto;

import com.moneymanager.backend.entity.InvestmentTxnType;
import com.moneymanager.backend.entity.InvestmentType;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public class InvestmentDtos {

    public record InvestmentRequest(
            @NotBlank String name,
            @NotNull InvestmentType type,
            String note
    ) {}

    public record CurrentValueRequest(
            @NotNull @DecimalMin("0") BigDecimal currentValue
    ) {}

    public record InvestmentTxnRequest(
            @NotNull LocalDate txnDate,
            @NotNull InvestmentTxnType type,
            @NotNull @DecimalMin("0.01") BigDecimal amount
    ) {}

    public record InvestmentTxnResponse(
            Long id,
            LocalDate txnDate,
            InvestmentTxnType type,
            BigDecimal amount
    ) {}

    public record InvestmentResponse(
            Long id,
            String name,
            InvestmentType type,
            String note,
            BigDecimal currentValue,
            BigDecimal totalInvested,
            BigDecimal totalRedeemed,
            BigDecimal gain,
            Double xirrPercent,
            List<InvestmentTxnResponse> transactions
    ) {}

    public record PortfolioSummary(
            BigDecimal totalCurrentValue,
            BigDecimal totalInvested,
            BigDecimal totalRedeemed,
            BigDecimal overallGain,
            Double overallXirrPercent
    ) {}
}
