package com.moneymanager.backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public class WishRoomDtos {

    public record ConnectRequest(
            @NotBlank @Email String email,
            @NotBlank String password
    ) {}

    public record ConnectionStatus(
            boolean connected,
            String email,
            String name
    ) {}

    public record RoomSummary(
            String id,
            String name,
            int itemCount
    ) {}

    public record RoomItemSummary(
            String id,
            String title,
            Double price,
            String currency,
            String url,
            String imageUrl,
            String status
    ) {}

    public record ImportItemRequest(
            @NotBlank String roomId,
            @NotBlank String itemId
    ) {}
}
