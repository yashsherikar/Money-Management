package com.moneymanager.backend.repository;

import com.moneymanager.backend.entity.UpiPayeeHint;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UpiPayeeHintRepository extends JpaRepository<UpiPayeeHint, Long> {

    Optional<UpiPayeeHint> findByUpiId(String upiId);
}
