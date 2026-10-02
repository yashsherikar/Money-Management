package com.moneymanager.backend.dto;

import jakarta.validation.constraints.NotBlank;

public class UpiHintDtos {

    public record UpiHintResponse(
            String upiId,
            String categoryName,
            boolean personal,
            String displayName
    ) {}

    public record UpiHintRequest(
            @NotBlank String upiId,
            @NotBlank String categoryName,
            boolean personal,
            String displayName
    ) {}
}
