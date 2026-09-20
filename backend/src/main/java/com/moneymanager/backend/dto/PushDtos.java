package com.moneymanager.backend.dto;

import jakarta.validation.constraints.NotBlank;

public class PushDtos {

    public record VapidKeyResponse(String publicKey) {}

    public record SubscribeRequest(
            @NotBlank String endpoint,
            @NotBlank String p256dh,
            @NotBlank String auth
    ) {}

    public record UnsubscribeRequest(@NotBlank String endpoint) {}

    public record PushStatusResponse(boolean available) {}
}
