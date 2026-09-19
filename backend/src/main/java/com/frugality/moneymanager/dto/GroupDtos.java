package com.frugality.moneymanager.dto;

import jakarta.validation.constraints.NotBlank;

import java.time.Instant;
import java.util.List;

public class GroupDtos {

    public record CreateGroupRequest(@NotBlank String name) {}

    public record JoinGroupRequest(@NotBlank String inviteCode) {}

    public record MemberSummary(Long userId, String name, String email) {}

    public record GroupResponse(
            Long id,
            String name,
            String inviteCode,
            Long ownerId,
            Instant createdAt,
            List<MemberSummary> members
    ) {}
}
