package com.moneymanager.backend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public class SplitBillDtos {

    public record ParticipantRequest(
            @NotBlank String name,
            @NotNull @DecimalMin("0.01") BigDecimal shareAmount,
            /** Optional 0.01–99.99 of the bill total. */
            BigDecimal sharePercent,
            String email
    ) {}

    public record SplitBillRequest(
            @NotBlank String title,
            @NotNull @DecimalMin("0.01") BigDecimal totalAmount,
            Long accountId,
            @NotNull LocalDate billDate,
            String note,
            /** When set, splits an existing expense (must be within 2 days). No double debit. */
            Long sourceTransactionId,
            Long categoryId,
            @NotEmpty @Valid List<ParticipantRequest> participants
    ) {}

    public record ParticipantResponse(
            Long id,
            String name,
            BigDecimal shareAmount,
            BigDecimal sharePercent,
            boolean paid,
            LocalDate paidDate,
            boolean linked
    ) {}

    /** What a linked participant sees on their own Requests page. */
    public record OwedSplitBillResponse(
            Long participantId,
            Long splitBillId,
            String title,
            BigDecimal shareAmount,
            boolean paid,
            String payerName,
            String upiPayLink
    ) {}

    public record SplitBillResponse(
            Long id,
            String title,
            BigDecimal totalAmount,
            Long accountId,
            String accountName,
            LocalDate billDate,
            String note,
            BigDecimal yourShare,
            BigDecimal yourSharePercent,
            BigDecimal collected,
            BigDecimal pending,
            Long sourceTransactionId,
            Long expenseTransactionId,
            List<ParticipantResponse> participants
    ) {}
}
