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
import java.util.List;

@Service
public class RecurringTransactionService {

    private final RecurringTransactionRepository recurringTransactionRepository;
    private final AccountRepository accountRepository;
    private final CategoryRepository categoryRepository;
    private final TransactionRepository transactionRepository;

    public RecurringTransactionService(RecurringTransactionRepository recurringTransactionRepository,
                                        AccountRepository accountRepository,
                                        CategoryRepository categoryRepository,
                                        TransactionRepository transactionRepository) {
        this.recurringTransactionRepository = recurringTransactionRepository;
        this.accountRepository = accountRepository;
        this.categoryRepository = categoryRepository;
        this.transactionRepository = transactionRepository;
    }

    @Transactional(readOnly = true)
    public List<RecurringResponse> list(User user) {
        return recurringTransactionRepository.findByUserIdOrderByDayOfMonthAsc(user.getId()).stream()
                .map(this::toResponse).toList();
    }

    public RecurringResponse create(User user, RecurringRequest request) {
        RecurringTransaction rt = new RecurringTransaction();
        rt.setUser(user);
        applyRequest(user, rt, request);
        return toResponse(recurringTransactionRepository.save(rt));
    }

    public RecurringResponse update(User user, Long id, RecurringRequest request) {
        RecurringTransaction rt = get(user, id);
        applyRequest(user, rt, request);
        return toResponse(recurringTransactionRepository.save(rt));
    }

    public void delete(User user, Long id) {
        recurringTransactionRepository.delete(get(user, id));
    }

    public RecurringResponse setActive(User user, Long id, boolean active) {
        RecurringTransaction rt = get(user, id);
        rt.setActive(active);
        return toResponse(recurringTransactionRepository.save(rt));
    }

    /** Active recurring transactions whose day/cycle has arrived and haven't been confirmed yet. */
    @Transactional(readOnly = true)
    public List<RecurringResponse> due(User user) {
        LocalDate today = LocalDate.now();
        return recurringTransactionRepository.findByUserIdOrderByDayOfMonthAsc(user.getId()).stream()
                .filter(RecurringTransaction::isActive)
                .filter(rt -> isDue(rt, today))
                .map(this::toResponse)
                .toList();
    }

    private boolean isDue(RecurringTransaction rt, LocalDate today) {
        if (rt.getRecurrenceType() == RecurrenceType.INTERVAL_DAYS) {
            return !today.isBefore(nextDueDate(rt));
        }
        String currentMonth = YearMonth.from(today).toString();
        if (currentMonth.equals(rt.getLastLoggedMonth())) return false;
        return today.getDayOfMonth() >= Math.min(rt.getDayOfMonth(), today.lengthOfMonth());
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
        if (rt.getRecurrenceType() == RecurrenceType.MONTHLY && currentMonth.equals(rt.getLastLoggedMonth())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "already confirmed for this month");
        }
        if (rt.getRecurrenceType() == RecurrenceType.INTERVAL_DAYS && today.isBefore(nextDueDate(rt))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "not due yet");
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
        transactionRepository.save(txn);

        BigDecimal delta = rt.getType() == TransactionType.INCOME ? rt.getAmount() : rt.getAmount().negate();
        account.setBalance(account.getBalance().add(delta));
        accountRepository.save(account);

        if (rt.getRecurrenceType() == RecurrenceType.INTERVAL_DAYS) {
            rt.setLastLoggedDate(today);
        } else {
            rt.setLastLoggedMonth(currentMonth);
        }
        return toResponse(recurringTransactionRepository.save(rt));
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
        if (r.recurrenceType() == RecurrenceType.INTERVAL_DAYS && r.intervalDays() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "intervalDays is required for an every-N-days recurrence");
        }
        rt.setAccount(account);
        rt.setCategory(category);
        rt.setType(r.type());
        rt.setAmount(r.amount());
        rt.setDescription(r.description());
        rt.setRecurrenceType(r.recurrenceType());
        rt.setDayOfMonth(r.recurrenceType() == RecurrenceType.MONTHLY ? r.dayOfMonth() : null);
        rt.setIntervalDays(r.recurrenceType() == RecurrenceType.INTERVAL_DAYS ? r.intervalDays() : null);
    }

    private RecurringResponse toResponse(RecurringTransaction rt) {
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
                rt.isActive()
        );
    }
}
