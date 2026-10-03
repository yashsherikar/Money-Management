package com.moneymanager.backend.repository;

import com.moneymanager.backend.entity.User;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByIgnoreCaseEmail(String email);
    boolean existsByIgnoreCaseEmail(String email);

    Optional<User> findByPhone(String phone);

    @Query("""
            SELECT u FROM User u
            WHERE u.id <> :excludeId
              AND (
                   LOWER(u.email) LIKE LOWER(CONCAT('%', :q, '%'))
                OR LOWER(u.name) LIKE LOWER(CONCAT('%', :q, '%'))
                OR (u.phone IS NOT NULL AND u.phone LIKE CONCAT('%', :q, '%'))
              )
            ORDER BY u.name ASC
            """)
    List<User> searchContacts(@Param("q") String q, @Param("excludeId") Long excludeId, Pageable pageable);
}
