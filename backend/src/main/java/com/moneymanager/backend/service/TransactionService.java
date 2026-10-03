package com.moneymanager.backend.service;

import com.moneymanager.backend.dto.TransactionDtos.*;
import com.moneymanager.backend.entity.*;
import com.moneymanager.backend.repository.AccountRepository;
import com.moneymanager.backend.repository.CategoryRepository;
import com.moneymanager.backend.repository.SplitBillRepository;
import com.moneymanager.backend.repository.TransactionRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class TransactionService {

    private final TransactionRepository transactionRepository;
    private final AccountRepository accountRepository;
    private final CategoryRepository categoryRepository;
    private final SplitBillRepository splitBillRepository;

    public TransactionService(TransactionRepository transactionRepository,
                               AccountRepository accountRepository,
                               CategoryRepository categoryRepository,
                               SplitBillRepository splitBillRepository) {
        this.transactionRepository = transactionRepository;
        this.accountRepository = accountRepository;
        this.categoryRepository = categoryRepository;
        this.splitBillRepository = splitBillRepository;
    }

    @Transactional(readOnly = true)
    public List<TransactionResponse> list(User user, LocalDate from, LocalDate to) {
        List<Transaction> txns = transactionRepository
                .findByUserIdAndTxnDateBetweenOrderByTxnDateDesc(user.getId(), from, to);
        Map<Long, Long> splitByTxnId = new HashMap<>();
        if (!txns.isEmpty()) {
            List<Long> ids = txns.stream().map(Transaction::getId).toList();
            for (SplitBill bill : splitBillRepository.findLinkedToTransactions(user.getId(), ids)) {
                if (bill.getSourceTransaction() != null) {
                    splitByTxnId.put(bill.getSourceTransaction().getId(), bill.getId());
                }
                if (bill.getExpenseTransaction() != null) {
                    splitByTxnId.putIfAbsent(bill.getExpenseTransaction().getId(), bill.getId());
                }
            }
        }
        LocalDate today = LocalDate.now();
        return txns.stream()
                .map(t -> toResponse(t, splitByTxnId.get(t.getId()), today))
                .collect(Collectors.toList());
    }

    @Transactional
    public TransactionResponse create(User user, TransactionRequest request) {
        Account account = accountRepository.findByIdAndUserId(request.accountId(), user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "account not found"));
        Category category = resolveCategory(user, request.categoryId());

        Transaction txn = new Transaction();
        txn.setUser(user);
        txn.setAccount(account);
        txn.setCategory(category);
        txn.setType(request.type());
        txn.setAmount(request.amount());
        txn.setDescription(request.description());
        txn.setTxnDate(request.txnDate());
        transactionRepository.save(txn);

        applyBalance(account, request.type(), request.amount());
        return toResponse(txn, null, LocalDate.now());
    }

    @Transactional
    public TransactionResponse update(User user, Long id, TransactionRequest request) {
        Transaction txn = transactionRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "transaction not found"));

        // reverse old effect on its original account
        applyBalance(txn.getAccount(), reverse(txn.getType()), txn.getAmount());

        Account account = accountRepository.findByIdAndUserId(request.accountId(), user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "account not found"));
        Category category = resolveCategory(user, request.categoryId());

        txn.setAccount(account);
        txn.setCategory(category);
        txn.setType(request.type());
        txn.setAmount(request.amount());
        txn.setDescription(request.description());
        txn.setTxnDate(request.txnDate());
        transactionRepository.save(txn);

        applyBalance(account, request.type(), request.amount());
        Long splitId = splitBillRepository.findBySourceTransactionId(txn.getId())
                .map(SplitBill::getId).orElse(null);
        return toResponse(txn, splitId, LocalDate.now());
    }

    @Transactional
    public void delete(User user, Long id) {
        Transaction txn = transactionRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "transaction not found"));
        applyBalance(txn.getAccount(), reverse(txn.getType()), txn.getAmount());
        transactionRepository.delete(txn);
    }

    private Category resolveCategory(User user, Long categoryId) {
        if (categoryId == null) return null;
        return categoryRepository.findVisibleById(categoryId, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "category not found"));
    }

    private TransactionType reverse(TransactionType type) {
        return type == TransactionType.INCOME ? TransactionType.EXPENSE : TransactionType.INCOME;
    }

    private void applyBalance(Account account, TransactionType type, BigDecimal amount) {
        BigDecimal delta = type == TransactionType.INCOME ? amount : amount.negate();
        account.setBalance(account.getBalance().add(delta));
        accountRepository.save(account);
    }

    private TransactionResponse toResponse(Transaction t, Long splitBillId, LocalDate today) {
        boolean canSplit = false;
        if (t.getType() == TransactionType.EXPENSE && splitBillId == null) {
            long days = ChronoUnit.DAYS.between(t.getTxnDate(), today);
            canSplit = days >= 0 && days <= SplitBillService.SPLIT_FROM_TXN_DAYS;
        }
        return new TransactionResponse(
                t.getId(),
                t.getAccount().getId(),
                t.getAccount().getName(),
                t.getCategory() == null ? null : t.getCategory().getId(),
                t.getCategory() == null ? null : t.getCategory().getName(),
                t.getType(),
                t.getAmount(),
                t.getDescription(),
                t.getTxnDate(),
                canSplit,
                splitBillId
        );
    }
}
