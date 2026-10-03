package com.moneymanager.backend.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public class PaymentRequestDtos {

    /** Friend identified by email and/or phone (at least one required). */
    public record PaymentRequestCreate(
            String email,
            String phone,
            @NotNull @DecimalMin("0.01") BigDecimal amount,
            String note
    ) {}

    public record PaymentRequestResponse(
            Long id,
            Long requesterId,
            String requesterName,
            String requesterUpiId,
            String requesterEmail,
            String requesterPhone,
            Long payerId,
            String payerName,
            String payerEmail,
            String payerPhone,
            BigDecimal amount,
            String note,
            String status,
            String upiPayLink
    ) {}
}
