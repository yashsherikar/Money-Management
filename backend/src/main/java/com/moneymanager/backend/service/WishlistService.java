package com.moneymanager.backend.service;

import com.moneymanager.backend.dto.WishlistDtos.*;
import com.moneymanager.backend.entity.*;
import com.moneymanager.backend.repository.*;
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
    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;
    private final PushService pushService;

    public WishlistService(WishlistItemRepository wishlistItemRepository, AccountRepository accountRepository,
                            ContributionRequestRepository contributionRequestRepository,
                            UserRepository userRepository,
                            TransactionRepository transactionRepository,
                            PushService pushService) {
        this.wishlistItemRepository = wishlistItemRepository;
        this.accountRepository = accountRepository;
        this.contributionRequestRepository = contributionRequestRepository;
        this.userRepository = userRepository;
        this.transactionRepository = transactionRepository;
        this.pushService = pushService;
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
                .filter(a -> a.getType() != AccountType.CARD && a.getType() != AccountType.EMERGENCY_FUND)
                .map(Account::getBalance)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal shortfall = item.getPrice().subtract(availableFunds).max(BigDecimal.ZERO);
        boolean affordable = shortfall.compareTo(BigDecimal.ZERO) == 0;
        boolean comfortable = availableFunds.compareTo(item.getPrice().multiply(COMFORTABLE_MULTIPLIER)) >= 0;

        String recommendation;
        if (comfortable) {
            recommendation = "You can buy this now and still keep a healthy buffer.";
        } else if (affordable) {
            recommendation = "You can afford it, but it'll eat most of your savings. Consider waiting or asking someone to chip in.";
        } else {
            recommendation = "You're short by " + shortfall + ". Request the difference from someone, or save more first.";
        }

        return new AffordabilityResponse(item.getPrice(), availableFunds, shortfall, affordable, comfortable, recommendation);
    }

    @Transactional
    public List<ContributionRequestResponse> requestContributions(User user, Long itemId, BulkContributionRequest request) {
        WishlistItem item = getOwned(user, itemId);
        return request.requests().stream().map(r -> {
            String email = r.email().trim().toLowerCase();
            User member = userRepository.findByIgnoreCaseEmail(email)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "no Money Manager user with email " + email));
            if (member.getId().equals(user.getId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "you can't request a contribution from yourself");
            }
            ContributionRequest cr = new ContributionRequest();
            cr.setWishlistItem(item);
            cr.setRequester(user);
            cr.setMember(member);
            cr.setAmount(r.amount());
            contributionRequestRepository.save(cr);
            pushService.notifyUser(member, "Money request",
                    user.getName() + " is asking for ₹" + r.amount() + " for \"" + item.getName() + "\"");
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
        List<Account> spendableAccounts = accountRepository.findByUserIdOrderByCreatedAtAsc(user.getId()).stream()
                .filter(a -> a.getType() != AccountType.CARD && a.getType() != AccountType.EMERGENCY_FUND)
                .toList();
        Account account = spendableAccounts.stream().filter(Account::isPrimary).findFirst()
                .or(() -> spendableAccounts.stream().findFirst())
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
        return new WishlistItemResponse(item.getId(), item.getName(), item.getPrice(), item.getProductUrl(), item.getStatus());
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
