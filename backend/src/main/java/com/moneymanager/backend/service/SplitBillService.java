package com.moneymanager.backend.service;

import com.moneymanager.backend.dto.SplitBillDtos.*;
import com.moneymanager.backend.entity.*;
import com.moneymanager.backend.repository.AccountRepository;
import com.moneymanager.backend.repository.CategoryRepository;
import com.moneymanager.backend.repository.SplitBillParticipantRepository;
import com.moneymanager.backend.repository.SplitBillRepository;
import com.moneymanager.backend.repository.TransactionRepository;
import com.moneymanager.backend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
public class SplitBillService {

    /** After this many days from the expense date, "Split" from Transactions is locked. */
    public static final int SPLIT_FROM_TXN_DAYS = 2;

    private final SplitBillRepository splitBillRepository;
    private final SplitBillParticipantRepository participantRepository;
    private final AccountRepository accountRepository;
    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;
    private final CategoryRepository categoryRepository;
    private final PushService pushService;

    public SplitBillService(SplitBillRepository splitBillRepository,
                             SplitBillParticipantRepository participantRepository,
                             AccountRepository accountRepository,
                             UserRepository userRepository,
                             TransactionRepository transactionRepository,
                             CategoryRepository categoryRepository,
                             PushService pushService) {
        this.splitBillRepository = splitBillRepository;
        this.participantRepository = participantRepository;
        this.accountRepository = accountRepository;
        this.userRepository = userRepository;
        this.transactionRepository = transactionRepository;
        this.categoryRepository = categoryRepository;
        this.pushService = pushService;
    }

    @Transactional(readOnly = true)
    public List<SplitBillResponse> list(User user) {
        return splitBillRepository.findByUserIdOrderByBillDateDesc(user.getId()).stream()
                .map(this::toResponse).toList();
    }

    /** Split bills where the current user is a linked participant — what they owe, and to whom. */
    @Transactional(readOnly = true)
    public List<OwedSplitBillResponse> owedByMe(User user) {
        return participantRepository.findByUserIdOrderByIdDesc(user.getId()).stream()
                .map(p -> {
                    SplitBill bill = p.getSplitBill();
                    User payer = bill.getUser();
                    String upiLink = null;
                    if (StringUtils.hasText(payer.getUpiId())) {
                        upiLink = "upi://pay?pa=" + payer.getUpiId().trim()
                                + "&pn=" + encode(payer.getName())
                                + "&am=" + p.getShareAmount().setScale(2, RoundingMode.HALF_UP).toPlainString()
                                + "&cu=INR"
                                + "&tn=" + encode(bill.getTitle());
                    }
                    return new OwedSplitBillResponse(p.getId(), bill.getId(), bill.getTitle(),
                            p.getShareAmount(), p.isPaid(), payer.getName(), upiLink);
                })
                .toList();
    }

    private String encode(String value) {
        return URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8).replace("+", "%20");
    }

    @Transactional
    public SplitBillResponse create(User user, SplitBillRequest request) {
        BigDecimal total = request.totalAmount().setScale(2, RoundingMode.HALF_UP);
        BigDecimal shareTotal = BigDecimal.ZERO;
        BigDecimal percentTotal = BigDecimal.ZERO;
        boolean anyPercent = false;

        for (ParticipantRequest p : request.participants()) {
            BigDecimal amt = p.shareAmount().setScale(2, RoundingMode.HALF_UP);
            shareTotal = shareTotal.add(amt);
            if (p.sharePercent() != null) {
                anyPercent = true;
                percentTotal = percentTotal.add(p.sharePercent());
                BigDecimal expected = total.multiply(p.sharePercent())
                        .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
                if (expected.subtract(amt).abs().compareTo(new BigDecimal("0.05")) > 0) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "share amount does not match percent for " + p.name());
                }
            }
        }

        if (shareTotal.compareTo(total) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "participant shares exceed total amount");
        }
        if (anyPercent && percentTotal.compareTo(BigDecimal.valueOf(100)) >= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "participant percents must leave some share for you");
        }

        BigDecimal yourShare = total.subtract(shareTotal).setScale(2, RoundingMode.HALF_UP);
        if (yourShare.compareTo(new BigDecimal("0.01")) < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "your share must be at least ₹0.01 — lower others' shares/percents");
        }

        Transaction sourceTxn = null;
        if (request.sourceTransactionId() != null) {
            sourceTxn = transactionRepository.findByIdAndUserId(request.sourceTransactionId(), user.getId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "transaction not found"));
            if (sourceTxn.getType() != TransactionType.EXPENSE) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "only expenses can be split");
            }
            long days = ChronoUnit.DAYS.between(sourceTxn.getTxnDate(), LocalDate.now());
            if (days < 0 || days > SPLIT_FROM_TXN_DAYS) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "can only split a transaction within " + SPLIT_FROM_TXN_DAYS + " days");
            }
            if (splitBillRepository.existsBySourceTransactionId(sourceTxn.getId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "this transaction is already split");
            }
            if (sourceTxn.getAmount().setScale(2, RoundingMode.HALF_UP).compareTo(total) != 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "total must match the original transaction amount");
            }
        }

        SplitBill bill = new SplitBill();
        bill.setUser(user);
        bill.setTitle(request.title());
        bill.setTotalAmount(total);
        bill.setBillDate(request.billDate());
        bill.setNote(request.note());

        Account account = null;
        if (sourceTxn != null) {
            account = sourceTxn.getAccount();
            bill.setAccount(account);
            bill.setSourceTransaction(sourceTxn);
        } else if (request.accountId() != null) {
            account = getOwnedAccount(user, request.accountId());
            bill.setAccount(account);
            // You paid the full bill — hold others' shares as receivable on the account.
            account.setBalance(account.getBalance().subtract(total));
            accountRepository.save(account);
        }

        for (ParticipantRequest p : request.participants()) {
            SplitBillParticipant participant = new SplitBillParticipant();
            participant.setSplitBill(bill);
            participant.setName(p.name());
            participant.setShareAmount(p.shareAmount().setScale(2, RoundingMode.HALF_UP));
            participant.setSharePercent(p.sharePercent() == null
                    ? null
                    : p.sharePercent().setScale(2, RoundingMode.HALF_UP));
            if (StringUtils.hasText(p.email())) {
                userRepository.findByIgnoreCaseEmail(p.email().trim()).ifPresent(participant::setUser);
            }
            bill.getParticipants().add(participant);
        }

        // Persist bill first so we have an id before linking the expense txn.
        bill = splitBillRepository.save(bill);

        Transaction expenseTxn;
        if (sourceTxn != null) {
            // Already paid full amount via this txn — resize to your share without touching balance again.
            sourceTxn.setAmount(yourShare);
            sourceTxn.setDescription(buildMyShareDescription(request.title(), yourShare, total));
            expenseTxn = transactionRepository.save(sourceTxn);
        } else if (account != null) {
            // Account already reduced by full total above. Log only your share as an EXPENSE
            // without applying balance again (would double-count).
            expenseTxn = new Transaction();
            expenseTxn.setUser(user);
            expenseTxn.setAccount(account);
            expenseTxn.setCategory(resolveCategory(user, request.categoryId(), null));
            expenseTxn.setType(TransactionType.EXPENSE);
            expenseTxn.setAmount(yourShare);
            expenseTxn.setDescription(buildMyShareDescription(request.title(), yourShare, total));
            expenseTxn.setTxnDate(request.billDate());
            expenseTxn = transactionRepository.save(expenseTxn);
        } else {
            expenseTxn = null;
        }

        if (expenseTxn != null) {
            bill.setExpenseTransaction(expenseTxn);
            bill = splitBillRepository.save(bill);
        }

        SplitBillResponse response = toResponse(bill);
        for (SplitBillParticipant participant : bill.getParticipants()) {
            if (participant.getUser() != null) {
                String payUrl = null;
                if (StringUtils.hasText(user.getUpiId())) {
                    payUrl = "upi://pay?pa=" + user.getUpiId().trim()
                            + "&pn=" + encode(user.getName())
                            + "&am=" + participant.getShareAmount().setScale(2, RoundingMode.HALF_UP).toPlainString()
                            + "&cu=INR"
                            + "&tn=" + encode(bill.getTitle());
                }
                pushService.notifyUser(participant.getUser(), "Split bill",
                        user.getName() + " added you to \"" + bill.getTitle() + "\" — you owe ₹" + participant.getShareAmount(),
                        "/split-bills", PushService.ACTION_PAY_VIEW, payUrl,
                        PushService.RELATED_SPLIT_PARTICIPANT, participant.getId());
            }
        }
        return response;
    }

    private Category resolveCategory(User user, Long categoryId, Transaction sourceTxn) {
        if (sourceTxn != null && sourceTxn.getCategory() != null) {
            return sourceTxn.getCategory();
        }
        if (categoryId != null) {
            return categoryRepository.findVisibleById(categoryId, user.getId()).orElse(null);
        }
        return categoryRepository.findByNameAndIsDefaultTrue("Other").orElse(null);
    }

    private String buildMyShareDescription(String title, BigDecimal yourShare, BigDecimal total) {
        return "Split: " + title + " (my share ₹"
                + yourShare.setScale(2, RoundingMode.HALF_UP).toPlainString()
                + " of ₹" + total.setScale(2, RoundingMode.HALF_UP).toPlainString() + ")";
    }

    @Transactional
    public SplitBillResponse markParticipantPaid(User user, Long participantId) {
        SplitBillParticipant participant = participantRepository.findByIdAndSplitBill_UserId(participantId, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "participant not found"));
        if (participant.isPaid()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "already marked paid");
        }
        participant.setPaid(true);
        participant.setPaidDate(LocalDate.now());

        SplitBill bill = participant.getSplitBill();
        if (bill.getAccount() != null) {
            Account account = bill.getAccount();
            account.setBalance(account.getBalance().add(participant.getShareAmount()));
            accountRepository.save(account);
        }
        pushService.resolveRelated(PushService.RELATED_SPLIT_PARTICIPANT, participant.getId());
        return toResponse(bill);
    }

    @Transactional
    public void delete(User user, Long id) {
        SplitBill bill = getOwned(user, id);
        BigDecimal paidSum = bill.getParticipants().stream()
                .filter(SplitBillParticipant::isPaid)
                .map(SplitBillParticipant::getShareAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        if (bill.getSourceTransaction() != null) {
            // Restore original expense amount; reverse friend credits so cash matches "full bill paid by you".
            Transaction src = bill.getSourceTransaction();
            src.setAmount(bill.getTotalAmount());
            String title = bill.getTitle();
            if (src.getDescription() != null && src.getDescription().startsWith("Split: ")) {
                src.setDescription(title);
            }
            transactionRepository.save(src);
            if (bill.getAccount() != null && paidSum.compareTo(BigDecimal.ZERO) > 0) {
                Account account = bill.getAccount();
                account.setBalance(account.getBalance().subtract(paidSum));
                accountRepository.save(account);
            }
        } else if (bill.getAccount() != null) {
            // Created with account debit of full total + optional expense txn (no extra balance effect).
            Account account = bill.getAccount();
            account.setBalance(account.getBalance().add(bill.getTotalAmount()).subtract(paidSum));
            accountRepository.save(account);
            if (bill.getExpenseTransaction() != null) {
                transactionRepository.delete(bill.getExpenseTransaction());
                bill.setExpenseTransaction(null);
            }
        } else if (bill.getExpenseTransaction() != null) {
            transactionRepository.delete(bill.getExpenseTransaction());
        }

        splitBillRepository.delete(bill);
    }

    private Account getOwnedAccount(User user, Long accountId) {
        return accountRepository.findByIdAndUserId(accountId, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "account not found"));
    }

    private SplitBill getOwned(User user, Long id) {
        return splitBillRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "split bill not found"));
    }

    private SplitBillResponse toResponse(SplitBill bill) {
        BigDecimal shareTotal = bill.getParticipants().stream()
                .map(SplitBillParticipant::getShareAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal collected = bill.getParticipants().stream()
                .filter(SplitBillParticipant::isPaid)
                .map(SplitBillParticipant::getShareAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal pending = shareTotal.subtract(collected);
        BigDecimal yourShare = bill.getTotalAmount().subtract(shareTotal);
        BigDecimal yourPct = null;
        if (bill.getTotalAmount().compareTo(BigDecimal.ZERO) > 0) {
            yourPct = yourShare.multiply(BigDecimal.valueOf(100))
                    .divide(bill.getTotalAmount(), 2, RoundingMode.HALF_UP);
        }

        List<ParticipantResponse> participants = bill.getParticipants().stream()
                .map(p -> new ParticipantResponse(
                        p.getId(), p.getName(), p.getShareAmount(), p.getSharePercent(),
                        p.isPaid(), p.getPaidDate(), p.getUser() != null))
                .toList();

        return new SplitBillResponse(
                bill.getId(), bill.getTitle(), bill.getTotalAmount(),
                bill.getAccount() == null ? null : bill.getAccount().getId(),
                bill.getAccount() == null ? null : bill.getAccount().getName(),
                bill.getBillDate(), bill.getNote(),
                yourShare, yourPct, collected, pending,
                bill.getSourceTransaction() == null ? null : bill.getSourceTransaction().getId(),
                bill.getExpenseTransaction() == null ? null : bill.getExpenseTransaction().getId(),
                participants
        );
    }
}
