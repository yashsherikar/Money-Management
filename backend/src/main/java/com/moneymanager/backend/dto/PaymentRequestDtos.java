package com.moneymanager.backend.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public class PaymentRequestDtos {

    public record PaymentRequestCreate(
            @NotBlank @Email String email,
            @NotNull @DecimalMin("0.01") BigDecimal amount,
            String note
    ) {}

    public record PaymentRequestResponse(
            Long id,
            Long requesterId,
            String requesterName,
            String requesterUpiId,
            Long payerId,
            String payerName,
            BigDecimal amount,
            String note,
            String status,
            String upiPayLink
    ) {}
}
