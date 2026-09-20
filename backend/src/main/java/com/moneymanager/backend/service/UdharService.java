package com.moneymanager.backend.service;

import com.moneymanager.backend.dto.UdharDtos.*;
import com.moneymanager.backend.entity.Account;
import com.moneymanager.backend.entity.UdharEntry;
import com.moneymanager.backend.entity.UdharType;
import com.moneymanager.backend.entity.User;
import com.moneymanager.backend.repository.AccountRepository;
import com.moneymanager.backend.repository.UdharEntryRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Service
public class UdharService {

    private final UdharEntryRepository udharEntryRepository;
    private final AccountRepository accountRepository;

    public UdharService(UdharEntryRepository udharEntryRepository, AccountRepository accountRepository) {
        this.udharEntryRepository = udharEntryRepository;
        this.accountRepository = accountRepository;
    }

    @Transactional(readOnly = true)
    public List<UdharResponse> list(User user) {
        return udharEntryRepository.findByUserIdOrderByTxnDateDesc(user.getId()).stream()
                .map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public UdharSummary summary(User user) {
        List<UdharEntry> entries = udharEntryRepository.findByUserIdOrderByTxnDateDesc(user.getId());
        BigDecimal owedToYou = entries.stream()
                .filter(e -> !e.isSettled() && e.getType() == UdharType.LENT)
                .map(UdharEntry::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal youOwe = entries.stream()
                .filter(e -> !e.isSettled() && e.getType() == UdharType.BORROWED)
                .map(UdharEntry::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        return new UdharSummary(owedToYou, youOwe, owedToYou.subtract(youOwe));
    }

    @Transactional
    public UdharResponse create(User user, UdharRequest request) {
        UdharEntry entry = new UdharEntry();
        entry.setUser(user);
        entry.setContactName(request.contactName());
        entry.setType(request.type());
        entry.setAmount(request.amount());
        entry.setNote(request.note());
        entry.setTxnDate(request.txnDate());
        entry.setDueDate(request.dueDate());

        if (request.accountId() != null) {
            Account account = getOwnedAccount(user, request.accountId());
            entry.setAccount(account);
            applyBalance(account, initialDelta(entry));
        }
        return toResponse(udharEntryRepository.save(entry));
    }

    @Transactional
    public void delete(User user, Long id) {
        UdharEntry entry = getOwned(user, id);
        if (!entry.isSettled() && entry.getAccount() != null) {
            applyBalance(entry.getAccount(), initialDelta(entry).negate());
        }
        udharEntryRepository.delete(entry);
    }

    @Transactional
    public UdharResponse settle(User user, Long id) {
        UdharEntry entry = getOwned(user, id);
        if (entry.isSettled()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "already settled");
        }
        if (entry.getAccount() != null) {
            applyBalance(entry.getAccount(), initialDelta(entry).negate());
        }
        entry.setSettled(true);
        entry.setSettledDate(LocalDate.now());
        return toResponse(udharEntryRepository.save(entry));
    }

    /** Effect on the account balance when the entry is first created (before any settlement). */
    private BigDecimal initialDelta(UdharEntry entry) {
        return entry.getType() == UdharType.LENT ? entry.getAmount().negate() : entry.getAmount();
    }

    private void applyBalance(Account account, BigDecimal delta) {
        account.setBalance(account.getBalance().add(delta));
        accountRepository.save(account);
    }

    private Account getOwnedAccount(User user, Long accountId) {
        return accountRepository.findByIdAndUserId(accountId, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "account not found"));
    }

    private UdharEntry getOwned(User user, Long id) {
        return udharEntryRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "udhar entry not found"));
    }

    private UdharResponse toResponse(UdharEntry e) {
        return new UdharResponse(
                e.getId(),
                e.getAccount() == null ? null : e.getAccount().getId(),
                e.getAccount() == null ? null : e.getAccount().getName(),
                e.getContactName(),
                e.getType(),
                e.getAmount(),
                e.getNote(),
                e.getTxnDate(),
                e.getDueDate(),
                e.isSettled(),
                e.getSettledDate()
        );
    }
}
