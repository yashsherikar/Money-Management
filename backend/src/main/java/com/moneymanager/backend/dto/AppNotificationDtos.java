package com.moneymanager.backend.dto;

import java.time.Instant;
import java.util.List;

public class AppNotificationDtos {

    public record NotificationResponse(
            Long id,
            String title,
            String body,
            String url,
            String actionType,
            String payUrl,
            String relatedType,
            Long relatedId,
            boolean viewed,
            Instant createdAt
    ) {}

    public record NotificationListResponse(List<NotificationResponse> notifications, long unreadCount) {}
}
