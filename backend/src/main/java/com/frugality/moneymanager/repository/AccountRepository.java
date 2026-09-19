package com.frugality.moneymanager.repository;

import com.frugality.moneymanager.entity.Account;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AccountRepository extends JpaRepository<Account, Long> {
    List<Account> findByUserIdOrderByCreatedAtAsc(Long userId);
    Optional<Account> findByIdAndUserId(Long id, Long userId);
}
