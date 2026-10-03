package com.moneymanager.backend.service;

import com.moneymanager.backend.dto.ContactDtos.ContactHit;
import com.moneymanager.backend.entity.ContributionRequest;
import com.moneymanager.backend.entity.PaymentRequest;
import com.moneymanager.backend.entity.SplitBill;
import com.moneymanager.backend.entity.SplitBillParticipant;
import com.moneymanager.backend.entity.User;
import com.moneymanager.backend.repository.ContributionRequestRepository;
import com.moneymanager.backend.repository.PaymentRequestRepository;
import com.moneymanager.backend.repository.SplitBillParticipantRepository;
import com.moneymanager.backend.repository.SplitBillRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * People you've already connected with (payment requests, split bills, wishlist asks).
 */
@Service
public class ContactService {

    private final PaymentRequestRepository paymentRequestRepository;
    private final SplitBillRepository splitBillRepository;
    private final SplitBillParticipantRepository splitBillParticipantRepository;
    private final ContributionRequestRepository contributionRequestRepository;

    public ContactService(PaymentRequestRepository paymentRequestRepository,
                          SplitBillRepository splitBillRepository,
                          SplitBillParticipantRepository splitBillParticipantRepository,
                          ContributionRequestRepository contributionRequestRepository) {
        this.paymentRequestRepository = paymentRequestRepository;
        this.splitBillRepository = splitBillRepository;
        this.splitBillParticipantRepository = splitBillParticipantRepository;
        this.contributionRequestRepository = contributionRequestRepository;
    }

    @Transactional(readOnly = true)
    public List<ContactHit> recentConnections(User me) {
        Map<Long, ContactHit> byId = new LinkedHashMap<>();

        for (PaymentRequest pr : paymentRequestRepository.findByRequesterIdOrderByCreatedAtDesc(me.getId())) {
            put(byId, me.getId(), pr.getPayer());
        }
        for (PaymentRequest pr : paymentRequestRepository.findByPayerIdOrderByCreatedAtDesc(me.getId())) {
            put(byId, me.getId(), pr.getRequester());
        }

        for (SplitBill bill : splitBillRepository.findByUserIdOrderByBillDateDesc(me.getId())) {
            if (bill.getParticipants() == null) continue;
            for (SplitBillParticipant p : bill.getParticipants()) {
                if (p.getUser() != null) {
                    put(byId, me.getId(), p.getUser());
                }
            }
        }
        // Bills where I'm a linked participant — remember the payer (bill owner)
        for (SplitBillParticipant mine : splitBillParticipantRepository.findByUserIdOrderByIdDesc(me.getId())) {
            if (mine.getSplitBill() != null && mine.getSplitBill().getUser() != null) {
                put(byId, me.getId(), mine.getSplitBill().getUser());
            }
        }

        for (ContributionRequest cr : contributionRequestRepository.findByRequesterIdOrderByCreatedAtDesc(me.getId())) {
            if (cr.getMember() != null) put(byId, me.getId(), cr.getMember());
        }
        for (ContributionRequest cr : contributionRequestRepository.findByMemberIdOrderByCreatedAtDesc(me.getId())) {
            if (cr.getRequester() != null) put(byId, me.getId(), cr.getRequester());
        }

        return new ArrayList<>(byId.values()).stream().limit(24).toList();
    }

    private static void put(Map<Long, ContactHit> byId, Long meId, User other) {
        if (other == null || other.getId() == null || other.getId().equals(meId)) return;
        if (byId.containsKey(other.getId())) return;
        byId.put(other.getId(), new ContactHit(
                other.getId(),
                other.getName(),
                other.getEmail(),
                other.getPhone(),
                other.getUpiId()
        ));
    }
}
