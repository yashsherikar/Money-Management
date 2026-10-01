package com.moneymanager.backend.controller;

import com.moneymanager.backend.dto.AppNotificationDtos.*;
import com.moneymanager.backend.entity.AppNotification;
import com.moneymanager.backend.entity.User;
import com.moneymanager.backend.repository.AppNotificationRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final AppNotificationRepository notificationRepository;

    public NotificationController(AppNotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public NotificationListResponse list(@AuthenticationPrincipal User user) {
        var notifications = notificationRepository.findTop50ByUserIdOrderByCreatedAtDesc(user.getId()).stream()
                .map(this::toResponse)
                .toList();
        long unread = notificationRepository.countByUserIdAndViewedFalse(user.getId());
        return new NotificationListResponse(notifications, unread);
    }

    @PatchMapping("/{id}/viewed")
    @Transactional
    public void markViewed(@AuthenticationPrincipal User user, @PathVariable Long id) {
        AppNotification n = notificationRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "notification not found"));
        n.setViewed(true);
        notificationRepository.save(n);
    }

    private NotificationResponse toResponse(AppNotification n) {
        return new NotificationResponse(n.getId(), n.getTitle(), n.getBody(), n.getUrl(),
                n.getActionType(), n.getPayUrl(), n.isViewed(), n.getCreatedAt());
    }
}
