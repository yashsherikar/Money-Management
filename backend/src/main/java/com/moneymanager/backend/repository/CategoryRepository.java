package com.moneymanager.backend.repository;

import com.moneymanager.backend.entity.Category;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CategoryRepository extends JpaRepository<Category, Long> {

    @Query("select c from Category c left join c.user u where c.isDefault = true or u.id = :userId " +
            "order by case when c.name = 'Other' then 1 else 0 end, c.name")
    List<Category> findVisibleToUser(@Param("userId") Long userId);

    Optional<Category> findByIdAndUserId(Long id, Long userId);

    @Query("select c from Category c left join c.user u where c.id = :id and (c.isDefault = true or u.id = :userId)")
    Optional<Category> findVisibleById(@Param("id") Long id, @Param("userId") Long userId);

    Optional<Category> findByNameAndIsDefaultTrue(String name);
}
