package com.moneymanager.backend.dto;

import com.moneymanager.backend.entity.RecurrenceType;
import com.moneymanager.backend.entity.TransactionType;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;

public class RecurringTransactionDtos {

    public record RecurringRequest(
            @NotNull Long accountId,
            Long categoryId,
            @NotNull TransactionType type,
            @NotNull @DecimalMin("0.01") BigDecimal amount,
            @NotBlank String description,
            @NotNull RecurrenceType recurrenceType,
            @Min(1) @Max(28) Integer dayOfMonth,
            @Min(1) Integer intervalDays
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
            RecurrenceType recurrenceType,
            Integer dayOfMonth,
            Integer intervalDays,
            LocalDate nextDueDate,
            boolean active
    ) {}
}
