package com.moneymanager.backend.controller;

import com.moneymanager.backend.dto.PaymentRequestDtos.PaymentRequestCreate;
import com.moneymanager.backend.dto.PaymentRequestDtos.PaymentRequestResponse;
import com.moneymanager.backend.entity.User;
import com.moneymanager.backend.service.PaymentRequestService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/payment-requests")
public class PaymentRequestController {

    private final PaymentRequestService paymentRequestService;

    public PaymentRequestController(PaymentRequestService paymentRequestService) {
        this.paymentRequestService = paymentRequestService;
    }

    @PostMapping
    public PaymentRequestResponse create(@AuthenticationPrincipal User user,
                                         @Valid @RequestBody PaymentRequestCreate request) {
        return paymentRequestService.create(user, request);
    }

    @GetMapping("/incoming")
    public List<PaymentRequestResponse> incoming(@AuthenticationPrincipal User user) {
        return paymentRequestService.incoming(user);
    }

    @GetMapping("/outgoing")
    public List<PaymentRequestResponse> outgoing(@AuthenticationPrincipal User user) {
        return paymentRequestService.outgoing(user);
    }

    @PatchMapping("/{id}/accept")
    public PaymentRequestResponse accept(@AuthenticationPrincipal User user, @PathVariable Long id) {
        return paymentRequestService.respond(user, id, true);
    }

    @PatchMapping("/{id}/decline")
    public PaymentRequestResponse decline(@AuthenticationPrincipal User user, @PathVariable Long id) {
        return paymentRequestService.respond(user, id, false);
    }

    @PatchMapping("/{id}/mark-paid")
    public PaymentRequestResponse markPaid(@AuthenticationPrincipal User user, @PathVariable Long id) {
        return paymentRequestService.markPaid(user, id);
    }
}
