package com.frugality.moneymanager.dto;

import com.frugality.moneymanager.entity.UdharType;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;

public class UdharDtos {

    public record UdharRequest(
            Long accountId,
            @NotBlank String contactName,
            @NotNull UdharType type,
            @NotNull @DecimalMin("0.01") BigDecimal amount,
            String note,
            @NotNull LocalDate txnDate,
            LocalDate dueDate
    ) {}

    public record UdharResponse(
            Long id,
            Long accountId,
            String accountName,
            String contactName,
            UdharType type,
            BigDecimal amount,
            String note,
            LocalDate txnDate,
            LocalDate dueDate,
            boolean settled,
            LocalDate settledDate
    ) {}

    public record UdharSummary(
            BigDecimal totalOwedToYou,
            BigDecimal totalYouOwe,
            BigDecimal netPosition
    ) {}
}
