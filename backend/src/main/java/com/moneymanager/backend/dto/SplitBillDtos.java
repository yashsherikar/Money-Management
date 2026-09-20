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
            String email
    ) {}

    public record SplitBillRequest(
            @NotBlank String title,
            @NotNull @DecimalMin("0.01") BigDecimal totalAmount,
            Long accountId,
            @NotNull LocalDate billDate,
            String note,
            @NotEmpty @Valid List<ParticipantRequest> participants
    ) {}

    public record ParticipantResponse(
            Long id,
            String name,
            BigDecimal shareAmount,
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
            BigDecimal collected,
            BigDecimal pending,
            List<ParticipantResponse> participants
    ) {}
}
