package com.moneymanager.backend.service;

import com.moneymanager.backend.dto.RecurringTransactionDtos.*;
import com.moneymanager.backend.entity.*;
import com.moneymanager.backend.repository.AccountRepository;
import com.moneymanager.backend.repository.CategoryRepository;
import com.moneymanager.backend.repository.RecurringTransactionRepository;
import com.moneymanager.backend.repository.TransactionRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
public class RecurringTransactionService {

    private final RecurringTransactionRepository recurringTransactionRepository;
    private final AccountRepository accountRepository;
    private final CategoryRepository categoryRepository;
    private final TransactionRepository transactionRepository;
    private final PushService pushService;

    public RecurringTransactionService(RecurringTransactionRepository recurringTransactionRepository,
                                        AccountRepository accountRepository,
                                        CategoryRepository categoryRepository,
                                        TransactionRepository transactionRepository,
                                        PushService pushService) {
        this.recurringTransactionRepository = recurringTransactionRepository;
        this.accountRepository = accountRepository;
        this.categoryRepository = categoryRepository;
        this.transactionRepository = transactionRepository;
        this.pushService = pushService;
    }

    @Transactional(readOnly = true)
    public List<RecurringResponse> list(User user) {
        return recurringTransactionRepository.findByUserIdOrderByDayOfMonthAsc(user.getId()).stream()
                .map(this::toResponse).toList();
    }

    @Transactional
    public RecurringResponse create(User user, RecurringRequest request) {
        RecurringTransaction rt = new RecurringTransaction();
        rt.setUser(user);
        applyRequest(user, rt, request);
        return toResponse(recurringTransactionRepository.save(rt));
    }

    @Transactional
    public RecurringResponse update(User user, Long id, RecurringRequest request) {
        RecurringTransaction rt = get(user, id);
        applyRequest(user, rt, request);
        return toResponse(recurringTransactionRepository.save(rt));
    }

    @Transactional
    public void delete(User user, Long id) {
        recurringTransactionRepository.delete(get(user, id));
    }

    @Transactional
    public RecurringResponse setActive(User user, Long id, boolean active) {
        RecurringTransaction rt = get(user, id);
        rt.setActive(active);
        return toResponse(recurringTransactionRepository.save(rt));
    }

    /**
     * Active recurring transactions whose day/cycle has arrived and haven't been confirmed yet.
     * Heals stuck dues when the user already logged the payment via QR / SMS / manual expense.
     */
    @Transactional
    public List<RecurringResponse> due(User user) {
        LocalDate today = LocalDate.now();
        healPaidFromExistingTransactions(user, today);
        return recurringTransactionRepository.findByUserIdOrderByDayOfMonthAsc(user.getId()).stream()
                .filter(RecurringTransaction::isActive)
                .filter(rt -> !isDailyInterval(rt)) // daily autopay — no "did you pay?" nag
                .filter(rt -> isDue(rt, today))
                .map(this::toResponse)
                .toList();
    }

    /**
     * If an expense already exists for this cycle (QR pay, SMS, or prior confirm),
     * mark the recurring as paid so "Did you pay these?" does not keep returning.
     */
    private void healPaidFromExistingTransactions(User user, LocalDate today) {
        List<RecurringTransaction> active = recurringTransactionRepository
                .findByUserIdOrderByDayOfMonthAsc(user.getId()).stream()
                .filter(RecurringTransaction::isActive)
                .filter(rt -> !isDailyInterval(rt))
                .filter(rt -> isDue(rt, today))
                .toList();
        if (active.isEmpty()) return;

        String currentMonth = YearMonth.from(today).toString();
        for (RecurringTransaction rt : active) {
            if (hasMatchingExpenseThisCycle(user, rt, today)) {
                markCyclePaid(rt, today, currentMonth);
                pushService.resolveRelated(PushService.RELATED_RECURRING_TRANSACTION, rt.getId());
            }
        }
    }

    private void markCyclePaid(RecurringTransaction rt, LocalDate today, String currentMonth) {
        if (rt.getRecurrenceType() == RecurrenceType.INTERVAL_DAYS) {
            rt.setLastLoggedDate(today);
        } else {
            rt.setLastLoggedMonth(currentMonth);
        }
        recurringTransactionRepository.save(rt);
    }

    /**
     * Match an existing expense to this subscription: same amount this month, and either
     * same description, from_recurring, UPI (payment_id set) when amount is unique among open dues,
     * or description shares a meaningful token (e.g. ICICI).
     */
    private boolean hasMatchingExpenseThisCycle(User user, RecurringTransaction rt, LocalDate today) {
        LocalDate from;
        LocalDate to = today;
        if (rt.getRecurrenceType() == RecurrenceType.INTERVAL_DAYS) {
            int days = rt.getIntervalDays() != null ? Math.max(1, rt.getIntervalDays()) : 30;
            from = today.minusDays(days + 2L);
        } else {
            from = YearMonth.from(today).atDay(1);
        }
        List<Transaction> hits = transactionRepository.findExpensesByAmountInRange(
                user.getId(), rt.getAmount(), from, to);
        if (hits.isEmpty()) return false;

        String rtDesc = rt.getDescription() == null ? "" : rt.getDescription().trim();
        String rtLower = rtDesc.toLowerCase();
        String token = meaningfulToken(rtDesc);

        for (Transaction t : hits) {
            String d = t.getDescription() == null ? "" : t.getDescription().trim();
            String dLower = d.toLowerCase();
            if (t.isFromRecurring() && dLower.equals(rtLower)) return true;
            if (!rtLower.isEmpty() && dLower.equals(rtLower)) return true;
            if (token != null && dLower.contains(token)) return true;
        }

        // Unique amount among still-due items + UPI-logged expense (QR / SMS pay)
        long sameAmountDues = recurringTransactionRepository
                .findByUserIdOrderByDayOfMonthAsc(user.getId()).stream()
                .filter(RecurringTransaction::isActive)
                .filter(r -> !isDailyInterval(r))
                .filter(r -> isDue(r, today))
                .filter(r -> r.getAmount().compareTo(rt.getAmount()) == 0)
                .count();
        if (sameAmountDues == 1) {
            return hits.stream().anyMatch(t ->
                    t.getPaymentId() != null && !t.getPaymentId().isBlank()
                            || t.isFromRecurring());
        }
        return false;
    }

    /** First useful word from "Subscription: ICICI Bank" → icici (skip generic words). */
    private static String meaningfulToken(String description) {
        if (description == null || description.isBlank()) return null;
        String cleaned = description.toLowerCase().replaceAll("[^a-z0-9\\s]", " ");
        for (String part : cleaned.split("\\s+")) {
            if (part.length() < 3) continue;
            if (part.equals("subscription") || part.equals("subscriptions")
                    || part.equals("payment") || part.equals("monthly")
                    || part.equals("bank") || part.equals("recurring")
                    || part.equals("autopay") || part.equals("emi") || part.equals("due")) {
                continue;
            }
            return part;
        }
        return null;
    }

    /** Every 1 day (or missing) — bank SMS already covers these; reminders are noise. */
    private boolean isDailyInterval(RecurringTransaction rt) {
        if (rt.getRecurrenceType() != RecurrenceType.INTERVAL_DAYS) return false;
        Integer days = rt.getIntervalDays();
        return days == null || days <= 1;
    }

    private boolean isDue(RecurringTransaction rt, LocalDate today) {
        if (rt.getRecurrenceType() == RecurrenceType.INTERVAL_DAYS) {
            if (isDailyInterval(rt)) return false;
            return !today.isBefore(nextDueDate(rt));
        }
        String currentMonth = YearMonth.from(today).toString();
        if (currentMonth.equals(rt.getLastLoggedMonth())) return false;
        return today.getDayOfMonth() >= Math.min(rt.getDayOfMonth(), today.lengthOfMonth());
    }

    /** Monthly: unpaid this month (can pay early). Interval: unpaid once the cycle is due. */
    private boolean canMarkPaid(RecurringTransaction rt, LocalDate today) {
        if (!rt.isActive()) return false;
        if (rt.getRecurrenceType() == RecurrenceType.INTERVAL_DAYS) {
            return !today.isBefore(nextDueDate(rt));
        }
        String currentMonth = YearMonth.from(today).toString();
        return !currentMonth.equals(rt.getLastLoggedMonth());
    }

    /** For INTERVAL_DAYS plans: the next date the cycle renews, counting forward from the last confirm (or creation). */
    private LocalDate nextDueDate(RecurringTransaction rt) {
        LocalDate anchor = rt.getLastLoggedDate() != null
                ? rt.getLastLoggedDate()
                : rt.getCreatedAt().atZone(java.time.ZoneOffset.UTC).toLocalDate();
        return anchor.plusDays(rt.getIntervalDays());
    }

    /** User confirmed the payment actually happened: logs the transaction and moves the account balance. */
    @Transactional
    public RecurringResponse confirmPaid(User user, Long id) {
        RecurringTransaction rt = get(user, id);
        LocalDate today = LocalDate.now();
        String currentMonth = YearMonth.from(today).toString();

        // Interval: reject confirming before the cycle is due. Must run BEFORE the generic
        // idempotent guard below — for INTERVAL_DAYS, isDue/canMarkPaid are the same condition,
        // so "not due yet" would otherwise be indistinguishable from "already confirmed" and
        // silently return fake success (clears reminders, logs nothing, moves no money).
        if (rt.getRecurrenceType() == RecurrenceType.INTERVAL_DAYS && today.isBefore(nextDueDate(rt))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "not due yet");
        }

        // Idempotent: already confirmed this cycle → success so UI clears on reopen
        if (!isDue(rt, today) && !canMarkPaid(rt, today)) {
            pushService.resolveRelated(PushService.RELATED_RECURRING_TRANSACTION, rt.getId());
            return toResponse(rt);
        }
        // Monthly may be confirmed early; once logged this month, re-confirming is a no-op success.
        if (rt.getRecurrenceType() == RecurrenceType.MONTHLY && currentMonth.equals(rt.getLastLoggedMonth())) {
            pushService.resolveRelated(PushService.RELATED_RECURRING_TRANSACTION, rt.getId());
            return toResponse(rt);
        }

        // QR / SMS already logged this amount → mark paid without double expense
        if (hasMatchingExpenseThisCycle(user, rt, today)) {
            markCyclePaid(rt, today, currentMonth);
            RecurringTransaction saved = recurringTransactionRepository.save(rt);
            pushService.resolveRelated(PushService.RELATED_RECURRING_TRANSACTION, saved.getId());
            return toResponse(saved);
        }

        Account account = rt.getAccount();
        Transaction txn = new Transaction();
        txn.setUser(user);
        txn.setAccount(account);
        txn.setCategory(rt.getCategory());
        txn.setType(rt.getType());
        txn.setAmount(rt.getAmount());
        txn.setDescription(rt.getDescription());
        txn.setTxnDate(today);
        txn.setFromRecurring(true);
        transactionRepository.save(txn);

        BigDecimal delta = rt.getType() == TransactionType.INCOME ? rt.getAmount() : rt.getAmount().negate();
        account.setBalance(account.getBalance().add(delta));
        accountRepository.save(account);

        markCyclePaid(rt, today, currentMonth);
        RecurringTransaction saved = recurringTransactionRepository.save(rt);
        pushService.resolveRelated(PushService.RELATED_RECURRING_TRANSACTION, saved.getId());
        return toResponse(saved);
    }

    private RecurringTransaction get(User user, Long id) {
        return recurringTransactionRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "recurring transaction not found"));
    }

    private void applyRequest(User user, RecurringTransaction rt, RecurringRequest r) {
        Account account = accountRepository.findByIdAndUserId(r.accountId(), user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "account not found"));
        Category category = null;
        if (r.categoryId() != null) {
            category = categoryRepository.findVisibleById(r.categoryId(), user.getId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "category not found"));
        }
        if (r.recurrenceType() == RecurrenceType.MONTHLY && r.dayOfMonth() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "dayOfMonth is required for a monthly recurrence");
        }
        if (r.recurrenceType() == RecurrenceType.INTERVAL_DAYS) {
            if (r.lastDoneDate() == null || r.nextDueDate() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "lastDoneDate and nextDueDate are required for an every-N-days recurrence");
            }
            if (!r.nextDueDate().isAfter(r.lastDoneDate())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "nextDueDate must be after lastDoneDate");
            }
        }
        rt.setAccount(account);
        rt.setCategory(category);
        rt.setType(r.type());
        rt.setAmount(r.amount());
        rt.setDescription(r.description());
        rt.setRecurrenceType(r.recurrenceType());
        rt.setDayOfMonth(r.recurrenceType() == RecurrenceType.MONTHLY ? r.dayOfMonth() : null);
        if (r.recurrenceType() == RecurrenceType.INTERVAL_DAYS) {
            rt.setLastLoggedDate(r.lastDoneDate());
            rt.setIntervalDays((int) ChronoUnit.DAYS.between(r.lastDoneDate(), r.nextDueDate()));
        } else {
            rt.setIntervalDays(null);
        }
    }

    private RecurringResponse toResponse(RecurringTransaction rt) {
        LocalDate today = LocalDate.now();
        return new RecurringResponse(
                rt.getId(),
                rt.getAccount().getId(),
                rt.getAccount().getName(),
                rt.getCategory() == null ? null : rt.getCategory().getId(),
                rt.getCategory() == null ? null : rt.getCategory().getName(),
                rt.getType(),
                rt.getAmount(),
                rt.getDescription(),
                rt.getRecurrenceType(),
                rt.getDayOfMonth(),
                rt.getIntervalDays(),
                rt.getRecurrenceType() == RecurrenceType.INTERVAL_DAYS ? nextDueDate(rt) : null,
                rt.isActive(),
                isDue(rt, today),
                canMarkPaid(rt, today)
        );
    }
}
