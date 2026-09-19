package com.frugality.moneymanager.dto;

import com.frugality.moneymanager.entity.TransactionType;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;

public class RecurringTransactionDtos {

    public record RecurringRequest(
            @NotNull Long accountId,
            Long categoryId,
            @NotNull TransactionType type,
            @NotNull @DecimalMin("0.01") BigDecimal amount,
            @NotBlank String description,
            @NotNull @Min(1) @Max(28) Integer dayOfMonth
    ) {}

    public record RecurringResponse(
            Long id,
            Long accountId,
            String accountName,
            Long categoryId,
            String categoryName,
            TransactionType type,
            BigDecimal amount,
            String description,
            Integer dayOfMonth,
            boolean active
    ) {}
}
