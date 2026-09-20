package com.moneymanager.backend.dto;

import com.moneymanager.backend.entity.AccountType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;

public class ProfileDtos {

    public record ProfileResponse(Long id, String email, String name, String upiId, String photo, boolean pinSet) {}

    public record UpdateProfileRequest(String name, String upiId) {}

    public record ChangePasswordRequest(
            @NotBlank String currentPassword,
            @NotBlank @Size(min = 6, message = "must be at least 6 characters") String newPassword
    ) {}

    public record SetPinRequest(
            @NotBlank String currentPassword,
            @NotBlank @Pattern(regexp = "\\d{4,6}", message = "must be 4-6 digits") String pin
    ) {}

    public record PhotoRequest(@NotBlank String photo) {}

    public record RevealBalanceRequest(@NotBlank String pin) {}

    public record AccountBalance(Long accountId, String accountName, AccountType type, BigDecimal balance) {}

    public record TotalBalanceResponse(BigDecimal totalBalance, BigDecimal cashOnHand, BigDecimal udharOwed, List<AccountBalance> byAccount) {}
}
