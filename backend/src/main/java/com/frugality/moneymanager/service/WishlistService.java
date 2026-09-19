package com.frugality.moneymanager.service;

import com.frugality.moneymanager.dto.WishlistDtos.*;
import com.frugality.moneymanager.entity.*;
import com.frugality.moneymanager.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Service
public class WishlistService {

    private static final BigDecimal COMFORTABLE_MULTIPLIER = BigDecimal.valueOf(1.5);

    private final WishlistItemRepository wishlistItemRepository;
    private final AccountRepository accountRepository;
    private final ContributionRequestRepository contributionRequestRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final GroupService groupService;
    private final TransactionRepository transactionRepository;

    public WishlistService(WishlistItemRepository wishlistItemRepository, AccountRepository accountRepository,
                            ContributionRequestRepository contributionRequestRepository,
                            GroupMemberRepository groupMemberRepository, GroupService groupService,
                            TransactionRepository transactionRepository) {
        this.wishlistItemRepository = wishlistItemRepository;
        this.accountRepository = accountRepository;
        this.contributionRequestRepository = contributionRequestRepository;
        this.groupMemberRepository = groupMemberRepository;
        this.groupService = groupService;
        this.transactionRepository = transactionRepository;
    }

    public List<WishlistItemResponse> list(User user) {
        return wishlistItemRepository.findByUserIdOrderByCreatedAtDesc(user.getId()).stream()
                .map(this::toResponse).toList();
    }

    public WishlistItemResponse create(User user, WishlistItemRequest request) {
        WishlistItem item = new WishlistItem();
        item.setUser(user);
        item.setName(request.name());
        item.setPrice(request.price());
        item.setProductUrl(request.productUrl());
        if (request.groupId() != null) {
            item.setGroup(groupService.getIfMember(user, request.groupId()));
        }
        return toResponse(wishlistItemRepository.save(item));
    }

    public void delete(User user, Long id) {
        wishlistItemRepository.delete(getOwned(user, id));
    }

    public WishlistItemResponse markPurchased(User user, Long id) {
        WishlistItem item = getOwned(user, id);
        item.setStatus(WishlistStatus.PURCHASED);
        return toResponse(wishlistItemRepository.save(item));
    }

    public AffordabilityResponse affordability(User user, Long id) {
        WishlistItem item = getOwned(user, id);
        BigDecimal availableFunds = accountRepository.findByUserIdOrderByCreatedAtAsc(user.getId()).stream()
                .filter(a -> a.getType() != AccountType.CARD)
                .map(Account::getBalance)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal shortfall = item.getPrice().subtract(availableFunds).max(BigDecimal.ZERO);
        boolean affordable = shortfall.compareTo(BigDecimal.ZERO) == 0;
        boolean comfortable = availableFunds.compareTo(item.getPrice().multiply(COMFORTABLE_MULTIPLIER)) >= 0;

        String recommendation;
        if (comfortable) {
            recommendation = "You can buy this now and still keep a healthy buffer.";
        } else if (affordable) {
            recommendation = "You can afford it, but it'll eat most of your savings. Consider waiting or asking your group to chip in.";
        } else {
            recommendation = "You're short by " + shortfall + ". Request the difference from your group, or save more first.";
        }

        return new AffordabilityResponse(item.getPrice(), availableFunds, shortfall, affordable, comfortable, recommendation);
    }

    @Transactional
    public List<ContributionRequestResponse> requestContributions(User user, Long itemId, BulkContributionRequest request) {
        WishlistItem item = getOwned(user, itemId);
        if (item.getGroup() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "attach this item to a group before requesting contributions");
        }
        return request.requests().stream().map(r -> {
            if (!groupMemberRepository.existsByGroupIdAndUserId(item.getGroup().getId(), r.memberId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "member " + r.memberId() + " is not in this group");
            }
            User member = groupMemberRepository.findByGroupIdAndUserId(item.getGroup().getId(), r.memberId())
                    .orElseThrow().getUser();
            ContributionRequest cr = new ContributionRequest();
            cr.setWishlistItem(item);
            cr.setRequester(user);
            cr.setMember(member);
            cr.setAmount(r.amount());
            contributionRequestRepository.save(cr);
            return toResponse(cr);
        }).toList();
    }

    public List<ContributionRequestResponse> incomingRequests(User user) {
        return contributionRequestRepository.findByMemberIdOrderByCreatedAtDesc(user.getId()).stream()
                .map(this::toResponse).toList();
    }

    public List<ContributionRequestResponse> outgoingRequests(User user) {
        return contributionRequestRepository.findByRequesterIdOrderByCreatedAtDesc(user.getId()).stream()
                .map(this::toResponse).toList();
    }

    public ContributionRequestResponse respond(User user, Long requestId, boolean accept) {
        ContributionRequest cr = contributionRequestRepository.findByIdAndMemberId(requestId, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "request not found"));
        if (cr.getStatus() != ContributionStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "request already responded to");
        }
        cr.setStatus(accept ? ContributionStatus.ACCEPTED : ContributionStatus.DECLINED);
        cr.setRespondedAt(Instant.now());
        return toResponse(contributionRequestRepository.save(cr));
    }

    @Transactional
    public ContributionRequestResponse markPaid(User user, Long requestId) {
        ContributionRequest cr = contributionRequestRepository.findByIdAndRequesterId(requestId, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "request not found"));
        if (cr.getStatus() != ContributionStatus.ACCEPTED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "request must be accepted before it can be marked paid");
        }
        Account account = accountRepository.findByUserIdOrderByCreatedAtAsc(user.getId()).stream()
                .filter(a -> a.getType() != AccountType.CARD)
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "add a bank/cash account first to receive this"));

        Transaction txn = new Transaction();
        txn.setUser(user);
        txn.setAccount(account);
        txn.setType(TransactionType.INCOME);
        txn.setAmount(cr.getAmount());
        txn.setDescription("Contribution from " + cr.getMember().getName() + " for " + cr.getWishlistItem().getName());
        txn.setTxnDate(LocalDate.now());
        transactionRepository.save(txn);

        account.setBalance(account.getBalance().add(cr.getAmount()));
        accountRepository.save(account);

        cr.setStatus(ContributionStatus.PAID);
        return toResponse(contributionRequestRepository.save(cr));
    }

    private WishlistItem getOwned(User user, Long id) {
        return wishlistItemRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "wishlist item not found"));
    }

    private WishlistItemResponse toResponse(WishlistItem item) {
        return new WishlistItemResponse(item.getId(), item.getName(), item.getPrice(), item.getProductUrl(),
                item.getStatus(), item.getGroup() == null ? null : item.getGroup().getId(),
                item.getGroup() == null ? null : item.getGroup().getName());
    }

    private ContributionRequestResponse toResponse(ContributionRequest cr) {
        String upiLink = null;
        String upiId = cr.getRequester().getUpiId();
        if (upiId != null && !upiId.isBlank()) {
            upiLink = "upi://pay?pa=" + encode(upiId)
                    + "&pn=" + encode(cr.getRequester().getName())
                    + "&am=" + cr.getAmount().toPlainString()
                    + "&cu=INR"
                    + "&tn=" + encode(cr.getWishlistItem().getName());
        }
        return new ContributionRequestResponse(
                cr.getId(),
                cr.getWishlistItem().getId(),
                cr.getWishlistItem().getName(),
                cr.getRequester().getId(),
                cr.getRequester().getName(),
                upiId,
                cr.getMember().getId(),
                cr.getMember().getName(),
                cr.getAmount(),
                cr.getStatus().name(),
                upiLink
        );
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
