package com.frugality.moneymanager.dto;

import com.frugality.moneymanager.entity.InsuranceType;
import com.frugality.moneymanager.entity.PremiumFrequency;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;

public class InsuranceDtos {

    public record InsuranceRequest(
            @NotNull InsuranceType type,
            @NotBlank String policyName,
            @NotNull @DecimalMin("0.01") BigDecimal premiumAmount,
            @NotNull LocalDate dueDate,
            @NotNull PremiumFrequency frequency
    ) {}

    public record InsuranceResponse(
            Long id,
            InsuranceType type,
            String policyName,
            BigDecimal premiumAmount,
            LocalDate dueDate,
            PremiumFrequency frequency,
            boolean active,
            long daysToDue,
            boolean dueSoon
    ) {}
}
