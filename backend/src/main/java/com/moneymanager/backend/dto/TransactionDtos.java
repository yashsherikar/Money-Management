package com.moneymanager.backend.dto;

import com.moneymanager.backend.entity.TransactionType;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;

public class TransactionDtos {

    public record TransactionRequest(
            @NotNull Long accountId,
            Long categoryId,
            @NotNull TransactionType type,
            @NotNull @DecimalMin(value = "0.01") BigDecimal amount,
            String description,
            @NotNull LocalDate txnDate
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
            LocalDate txnDate
    ) {}
}
