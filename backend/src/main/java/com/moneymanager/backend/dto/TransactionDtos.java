package com.moneymanager.backend.dto;

import com.moneymanager.backend.entity.TransactionType;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public class TransactionDtos {

    public record TransactionRequest(
            @NotNull Long accountId,
            Long categoryId,
            @NotNull TransactionType type,
            @NotNull @DecimalMin(value = "0.01") BigDecimal amount,
            String description,
            String paymentId,
            @NotNull LocalDate txnDate,
            String merchantName
    ) {}

    public record TransactionResponse(
            Long id,
            Long accountId,
            String accountName,
            Long categoryId,
            String categoryName,
            TransactionType type,
            BigDecimal amount,
            String description,
            String paymentId,
            LocalDate txnDate,
            /** When the row was logged — used to order same-day txns by time. */
            Instant createdAt,
            /** True when this expense can still be opened as a split (≤ 2 days, not already split). */
            boolean canSplit,
            /** Set when this expense is already linked to a split bill. */
            Long splitBillId,
            String merchantName
    ) {}
}
