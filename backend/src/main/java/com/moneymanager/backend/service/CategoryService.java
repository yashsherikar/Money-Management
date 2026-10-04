package com.moneymanager.backend.service;

import com.moneymanager.backend.dto.CategoryDtos.*;
import com.moneymanager.backend.entity.Category;
import com.moneymanager.backend.entity.User;
import com.moneymanager.backend.repository.CategoryRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class CategoryService {

    private final CategoryRepository categoryRepository;

    public CategoryService(CategoryRepository categoryRepository) {
        this.categoryRepository = categoryRepository;
    }

    public List<CategoryResponse> list(User user) {
        // One row per name (A–Z). Prefer default over user clone so Cashback isn't listed twice.
        Map<String, Category> unique = new LinkedHashMap<>();
        for (Category c : categoryRepository.findVisibleToUser(user.getId())) {
            String key = c.getName() == null ? "" : c.getName().trim().toLowerCase(Locale.ROOT);
            if (key.isEmpty()) continue;
            Category existing = unique.get(key);
            if (existing == null) {
                unique.put(key, c);
                continue;
            }
            if (!existing.isDefault() && c.isDefault()) {
                unique.put(key, c);
            }
        }
        List<Category> ordered = new ArrayList<>(unique.values());
        ordered.sort((a, b) -> {
            boolean aOther = "Other".equalsIgnoreCase(a.getName());
            boolean bOther = "Other".equalsIgnoreCase(b.getName());
            if (aOther != bOther) return aOther ? 1 : -1;
            return String.valueOf(a.getName()).compareToIgnoreCase(String.valueOf(b.getName()));
        });
        return ordered.stream().map(this::toResponse).toList();
    }

    public CategoryResponse create(User user, CategoryRequest request) {
        String name = request.name() == null ? "" : request.name().trim();
        if (name.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "category name required");
        }
        // Never create a second Cashback / Dining Out / etc.
        List<Category> existing = categoryRepository.findVisibleByNameIgnoreCase(user.getId(), name);
        if (!existing.isEmpty()) {
            Category prefer = existing.stream()
                    .filter(Category::isDefault)
                    .findFirst()
                    .orElse(existing.get(0));
            return toResponse(prefer);
        }
        Category category = new Category();
        category.setUser(user);
        category.setName(name);
        category.setEssential(request.essential());
        return toResponse(categoryRepository.save(category));
    }

    public void delete(User user, Long id) {
        Category category = categoryRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "category not found"));
        if (category.isDefault()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "cannot delete a default category");
        }
        categoryRepository.delete(category);
    }

    private CategoryResponse toResponse(Category c) {
        return new CategoryResponse(c.getId(), c.getName(), c.isEssential(), c.isDefault());
    }
}
