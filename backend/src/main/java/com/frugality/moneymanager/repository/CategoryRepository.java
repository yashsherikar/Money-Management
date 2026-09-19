package com.frugality.moneymanager.repository;

import com.frugality.moneymanager.entity.Category;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CategoryRepository extends JpaRepository<Category, Long> {

    @Query("select c from Category c where c.user.id = :userId or c.isDefault = true order by c.name")
    List<Category> findVisibleToUser(@Param("userId") Long userId);

    Optional<Category> findByIdAndUserId(Long id, Long userId);

    @Query("select c from Category c where c.id = :id and (c.user.id = :userId or c.isDefault = true)")
    Optional<Category> findVisibleById(@Param("id") Long id, @Param("userId") Long userId);

    Optional<Category> findByNameAndIsDefaultTrue(String name);
}
