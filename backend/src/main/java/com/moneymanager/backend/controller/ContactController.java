package com.moneymanager.backend.controller;

import com.moneymanager.backend.dto.ContactDtos.ContactHit;
import com.moneymanager.backend.dto.ContactDtos.ContactLookupResponse;
import com.moneymanager.backend.entity.User;
import com.moneymanager.backend.repository.UserRepository;
import com.moneymanager.backend.service.ContactService;
import com.moneymanager.backend.service.ProfileService;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/contacts")
public class ContactController {

    private final UserRepository userRepository;
    private final ContactService contactService;

    public ContactController(UserRepository userRepository, ContactService contactService) {
        this.userRepository = userRepository;
        this.contactService = contactService;
    }

    /** Lookup Money Manager users by name, email, or phone (for split / ask-for-money). */
    @GetMapping("/lookup")
    public ContactLookupResponse lookup(@AuthenticationPrincipal User user,
                                        @RequestParam("q") String q) {
        String query = q == null ? "" : q.trim();
        if (query.length() < 2) {
            return new ContactLookupResponse(List.of());
        }
        String phoneQ = ProfileService.normalizePhone(query);
        String search = phoneQ != null ? phoneQ : query;
        List<ContactHit> hits = userRepository
                .searchContacts(search, user.getId(), PageRequest.of(0, 8))
                .stream()
                .map(u -> new ContactHit(u.getId(), u.getName(), u.getEmail(), u.getPhone(), u.getUpiId()))
                .toList();
        return new ContactLookupResponse(hits);
    }

    /** Friends you've already dealt with via requests, splits, or wishlist. */
    @GetMapping("/recent")
    public ContactLookupResponse recent(@AuthenticationPrincipal User user) {
        return new ContactLookupResponse(contactService.recentConnections(user));
    }
}
