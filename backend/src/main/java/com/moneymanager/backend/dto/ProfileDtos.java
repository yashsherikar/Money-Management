package com.moneymanager.backend.dto;

public class ProfileDtos {

    public record ProfileResponse(Long id, String email, String name, String upiId) {}

    public record UpdateProfileRequest(String name, String upiId) {}
}
