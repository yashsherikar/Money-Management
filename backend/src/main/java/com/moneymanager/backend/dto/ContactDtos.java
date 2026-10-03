package com.moneymanager.backend.dto;

import java.util.List;

public class ContactDtos {

    public record ContactHit(
            Long id,
            String name,
            String email,
            String phone,
            String upiId
    ) {}

    public record ContactLookupResponse(List<ContactHit> results) {}
}
