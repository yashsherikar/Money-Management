package com.frugality.moneymanager.repository;

import com.frugality.moneymanager.entity.Group;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface GroupRepository extends JpaRepository<Group, Long> {
    Optional<Group> findByInviteCode(String inviteCode);
    boolean existsByInviteCode(String inviteCode);
}
