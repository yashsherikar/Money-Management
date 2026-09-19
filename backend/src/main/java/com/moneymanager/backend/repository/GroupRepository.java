package com.moneymanager.backend.repository;

import com.moneymanager.backend.entity.Group;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface GroupRepository extends JpaRepository<Group, Long> {
    Optional<Group> findByInviteCode(String inviteCode);
    boolean existsByInviteCode(String inviteCode);
}
