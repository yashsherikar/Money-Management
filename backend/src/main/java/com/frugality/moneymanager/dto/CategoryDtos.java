package com.frugality.moneymanager.dto;

import jakarta.validation.constraints.NotBlank;

public class CategoryDtos {

    public record CategoryRequest(
            @NotBlank String name,
            boolean essential
    ) {}

    public record CategoryResponse(
            Long id,
            String name,
            boolean essential,
            boolean isDefault
    ) {}
}
