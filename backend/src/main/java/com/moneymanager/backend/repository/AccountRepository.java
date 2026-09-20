package com.moneymanager.backend.repository;

import com.moneymanager.backend.entity.Account;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AccountRepository extends JpaRepository<Account, Long> {
    List<Account> findByUserIdOrderByCreatedAtAsc(Long userId);
    Optional<Account> findByIdAndUserId(Long id, Long userId);
    Optional<Account> findByUserIdAndPrimaryTrue(Long userId);
}
