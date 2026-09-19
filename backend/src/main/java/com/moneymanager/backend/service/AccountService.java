package com.moneymanager.backend.service;

import com.moneymanager.backend.dto.AccountDtos.*;
import com.moneymanager.backend.entity.Account;
import com.moneymanager.backend.entity.User;
import com.moneymanager.backend.repository.AccountRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;

@Service
public class AccountService {

    private final AccountRepository accountRepository;

    public AccountService(AccountRepository accountRepository) {
        this.accountRepository = accountRepository;
    }

    public List<AccountResponse> list(User user) {
        return accountRepository.findByUserIdOrderByCreatedAtAsc(user.getId()).stream()
                .map(this::toResponse).toList();
    }

    public AccountResponse create(User user, AccountRequest request) {
        Account account = new Account();
        account.setUser(user);
        account.setName(request.name());
        account.setType(request.type());
        account.setBalance(request.balance() == null ? BigDecimal.ZERO : request.balance());
        return toResponse(accountRepository.save(account));
    }

    public AccountResponse update(User user, Long id, AccountRequest request) {
        Account account = get(user, id);
        account.setName(request.name());
        account.setType(request.type());
        if (request.balance() != null) {
            account.setBalance(request.balance());
        }
        return toResponse(accountRepository.save(account));
    }

    public void delete(User user, Long id) {
        Account account = get(user, id);
        accountRepository.delete(account);
    }

    Account get(User user, Long id) {
        return accountRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "account not found"));
    }

    private AccountResponse toResponse(Account a) {
        return new AccountResponse(a.getId(), a.getName(), a.getType(), a.getBalance());
    }
}
