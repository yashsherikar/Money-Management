package com.moneymanager.backend.controller;

import com.moneymanager.backend.dto.AppNotificationDtos.*;
import com.moneymanager.backend.entity.AppNotification;
import com.moneymanager.backend.entity.User;
import com.moneymanager.backend.repository.AppNotificationRepository;
import com.moneymanager.backend.service.PushService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final AppNotificationRepository notificationRepository;
    private final PushService pushService;

    public NotificationController(AppNotificationRepository notificationRepository, PushService pushService) {
        this.notificationRepository = notificationRepository;
        this.pushService = pushService;
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

    /**
     * User already paid — clear "Pay now" / "Paid" actions on this notification (and related ones).
     */
    @PatchMapping("/{id}/clear-pay-action")
    @Transactional
    public NotificationResponse clearPayAction(@AuthenticationPrincipal User user, @PathVariable Long id) {
        AppNotification n = notificationRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "notification not found"));
        if (n.getRelatedType() != null && n.getRelatedId() != null) {
            pushService.resolveRelated(n.getRelatedType(), n.getRelatedId());
            n = notificationRepository.findByIdAndUserId(id, user.getId()).orElse(n);
        } else {
            n.setActionType(PushService.ACTION_VIEW_ONLY);
            n.setPayUrl(null);
            n.setViewed(true);
            notificationRepository.save(n);
        }
        return toResponse(n);
    }

    private NotificationResponse toResponse(AppNotification n) {
        return new NotificationResponse(n.getId(), n.getTitle(), n.getBody(), n.getUrl(),
                n.getActionType(), n.getPayUrl(), n.getRelatedType(), n.getRelatedId(),
                n.isViewed(), n.getCreatedAt());
    }
}
