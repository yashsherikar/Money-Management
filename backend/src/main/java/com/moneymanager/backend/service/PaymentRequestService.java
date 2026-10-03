package com.moneymanager.backend.service;

import com.moneymanager.backend.dto.PaymentRequestDtos.PaymentRequestCreate;
import com.moneymanager.backend.dto.PaymentRequestDtos.PaymentRequestResponse;
import com.moneymanager.backend.entity.*;
import com.moneymanager.backend.repository.AccountRepository;
import com.moneymanager.backend.repository.PaymentRequestRepository;
import com.moneymanager.backend.repository.TransactionRepository;
import com.moneymanager.backend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Service
public class PaymentRequestService {

    private final PaymentRequestRepository paymentRequestRepository;
    private final UserRepository userRepository;
    private final AccountRepository accountRepository;
    private final TransactionRepository transactionRepository;
    private final PushService pushService;

    public PaymentRequestService(PaymentRequestRepository paymentRequestRepository,
                                 UserRepository userRepository,
                                 AccountRepository accountRepository,
                                 TransactionRepository transactionRepository,
                                 PushService pushService) {
        this.paymentRequestRepository = paymentRequestRepository;
        this.userRepository = userRepository;
        this.accountRepository = accountRepository;
        this.transactionRepository = transactionRepository;
        this.pushService = pushService;
    }

    @Transactional
    public PaymentRequestResponse create(User requester, PaymentRequestCreate request) {
        User payer = resolvePayer(request);
        if (payer.getId().equals(requester.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You can't ask yourself for money");
        }

        PaymentRequest pr = new PaymentRequest();
        pr.setRequester(requester);
        pr.setPayer(payer);
        pr.setAmount(request.amount());
        pr.setNote(blankToNull(request.note()));
        paymentRequestRepository.save(pr);

        String reason = reasonLabel(pr);
        String payUrl = buildUpiLink(requester, request.amount(), reason);
        pushService.notifyUser(payer, "Money request",
                requester.getName() + " is asking for ₹" + request.amount().toPlainString()
                        + (pr.getNote() != null ? " — " + pr.getNote() : ""),
                "/requests", PushService.ACTION_PAY_VIEW, payUrl,
                PushService.RELATED_PAYMENT_REQUEST, pr.getId());

        return toResponse(pr);
    }

    @Transactional(readOnly = true)
    public List<PaymentRequestResponse> incoming(User user) {
        return paymentRequestRepository.findByPayerIdOrderByCreatedAtDesc(user.getId()).stream()
                .map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<PaymentRequestResponse> outgoing(User user) {
        return paymentRequestRepository.findByRequesterIdOrderByCreatedAtDesc(user.getId()).stream()
                .map(this::toResponse).toList();
    }

    @Transactional
    public PaymentRequestResponse respond(User payer, Long id, boolean accept) {
        PaymentRequest pr = paymentRequestRepository.findByIdAndPayerId(id, payer.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found"));
        if (pr.getStatus() != PaymentRequestStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request already responded to");
        }
        pr.setStatus(accept ? PaymentRequestStatus.ACCEPTED : PaymentRequestStatus.DECLINED);
        pr.setRespondedAt(Instant.now());
        paymentRequestRepository.save(pr);

        if (!accept) {
            pushService.resolveRelated(PushService.RELATED_PAYMENT_REQUEST, pr.getId());
            pushService.clearPayActionsForUser(payer, "/requests");
        }

        pushService.notifyUser(pr.getRequester(),
                accept ? "Request accepted" : "Request declined",
                payer.getName() + (accept ? " accepted" : " declined") + " your request for ₹"
                        + pr.getAmount().toPlainString(),
                "/requests");

        return toResponse(pr);
    }

    @Transactional
    public PaymentRequestResponse markPaid(User requester, Long id) {
        PaymentRequest pr = paymentRequestRepository.findByIdAndRequesterId(id, requester.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found"));
        if (pr.getStatus() != PaymentRequestStatus.ACCEPTED
                && pr.getStatus() != PaymentRequestStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Only pending or accepted requests can be marked paid");
        }

        List<Account> spendable = accountRepository.findByUserIdOrderByCreatedAtAsc(requester.getId()).stream()
                .filter(a -> a.getType() != AccountType.CARD && a.getType() != AccountType.EMERGENCY_FUND)
                .toList();
        Account account = spendable.stream().filter(Account::isPrimary).findFirst()
                .or(() -> spendable.stream().findFirst())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Add a bank/cash account first to receive this"));

        String desc = "From " + pr.getPayer().getName()
                + (pr.getNote() != null ? " — " + pr.getNote() : " (money request)");

        Transaction txn = new Transaction();
        txn.setUser(requester);
        txn.setAccount(account);
        txn.setType(TransactionType.INCOME);
        txn.setAmount(pr.getAmount());
        txn.setDescription(desc);
        txn.setTxnDate(LocalDate.now());
        transactionRepository.save(txn);

        account.setBalance(account.getBalance().add(pr.getAmount()));
        accountRepository.save(account);

        pr.setStatus(PaymentRequestStatus.PAID);
        PaymentRequest saved = paymentRequestRepository.save(pr);
        pushService.resolveRelated(PushService.RELATED_PAYMENT_REQUEST, saved.getId());
        pushService.clearPayActionsForUser(pr.getPayer(), "/requests");
        pushService.notifyUser(pr.getPayer(), "Request settled",
                requester.getName() + " marked your ₹" + pr.getAmount().toPlainString() + " payment as received",
                "/requests");
        return toResponse(saved);
    }

    /**
     * Payer confirms they sent money via UPI (app cannot detect GPay P2P success).
     * Does not mark PAID — requester still taps "Mark as received".
     */
    @Transactional
    public PaymentRequestResponse confirmSent(User payer, Long id) {
        PaymentRequest pr = paymentRequestRepository.findByIdAndPayerId(id, payer.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found"));
        if (pr.getStatus() != PaymentRequestStatus.ACCEPTED
                && pr.getStatus() != PaymentRequestStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Only pending or accepted requests can be confirmed");
        }
        if (pr.getStatus() == PaymentRequestStatus.PENDING) {
            pr.setStatus(PaymentRequestStatus.ACCEPTED);
            pr.setRespondedAt(Instant.now());
            paymentRequestRepository.save(pr);
        }
        // Payer already paid — remove "Pay now" from their notifications / tray
        pushService.resolveRelated(PushService.RELATED_PAYMENT_REQUEST, pr.getId());
        pushService.notifyUser(pr.getRequester(), "Payment sent?",
                payer.getName() + " says they paid ₹" + pr.getAmount().toPlainString()
                        + " — mark as received if money arrived",
                "/requests");
        return toResponse(pr);
    }

    private PaymentRequestResponse toResponse(PaymentRequest pr) {
        String upiId = pr.getRequester().getUpiId();
        String upiLink = buildUpiLink(pr.getRequester(), pr.getAmount(), reasonLabel(pr));
        return new PaymentRequestResponse(
                pr.getId(),
                pr.getRequester().getId(),
                pr.getRequester().getName(),
                upiId,
                pr.getRequester().getEmail(),
                pr.getRequester().getPhone(),
                pr.getPayer().getId(),
                pr.getPayer().getName(),
                pr.getPayer().getEmail(),
                pr.getPayer().getPhone(),
                pr.getAmount(),
                pr.getNote(),
                pr.getStatus().name(),
                upiLink
        );
    }

    private String buildUpiLink(User requester, BigDecimal amount, String note) {
        if (!StringUtils.hasText(requester.getUpiId())) return null;
        String am = amount.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString();
        String tn = note == null ? "" : note.trim();
        if (tn.length() > 50) tn = tn.substring(0, 50);
        // Do not encode VPA — GPay rejects pa=name%40bank for some payments
        return "upi://pay?pa=" + requester.getUpiId().trim()
                + "&pn=" + encode(requester.getName())
                + "&am=" + am
                + "&cu=INR"
                + "&tn=" + encode(tn);
    }

    private static String reasonLabel(PaymentRequest pr) {
        if (StringUtils.hasText(pr.getNote())) return pr.getNote().trim();
        return "Money for " + pr.getRequester().getName();
    }

    private User resolvePayer(PaymentRequestCreate request) {
        String email = blankToNull(request.email());
        String phone = ProfileService.normalizePhone(request.phone());
        if (email == null && phone == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter friend's email or phone");
        }
        if (email != null) {
            return userRepository.findByIgnoreCaseEmail(email.toLowerCase())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                            "No Money Manager user with email " + email));
        }
        return userRepository.findByPhone(phone)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "No Money Manager user with that phone number"));
    }

    private static String blankToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static String encode(String value) {
        return URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8).replace("+", "%20");
    }
}
