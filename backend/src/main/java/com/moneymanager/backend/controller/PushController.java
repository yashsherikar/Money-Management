package com.moneymanager.backend.controller;

import com.moneymanager.backend.dto.PushDtos.*;
import com.moneymanager.backend.entity.User;
import com.moneymanager.backend.service.PushService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/push")
public class PushController {

    private final PushService pushService;

    public PushController(PushService pushService) {
        this.pushService = pushService;
    }

    @GetMapping("/status")
    public PushStatusResponse status() {
        return pushService.status();
    }

    @GetMapping("/vapid-public-key")
    public VapidKeyResponse vapidPublicKey() {
        return pushService.vapidPublicKey();
    }

    @PostMapping("/subscribe")
    public void subscribe(@AuthenticationPrincipal User user, @Valid @RequestBody SubscribeRequest request) {
        pushService.subscribe(user, request);
    }

    @PostMapping("/unsubscribe")
    public void unsubscribe(@AuthenticationPrincipal User user, @Valid @RequestBody UnsubscribeRequest request) {
        pushService.unsubscribe(user, request);
    }

    @PostMapping("/test")
    public TestPushResponse test(@AuthenticationPrincipal User user) {
        return pushService.sendTest(user);
    }
}
