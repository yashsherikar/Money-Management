package com.moneymanager.backend.service;

import com.moneymanager.backend.dto.CategoryDtos.*;
import com.moneymanager.backend.entity.Category;
import com.moneymanager.backend.entity.User;
import com.moneymanager.backend.repository.CategoryRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class CategoryService {

    private final CategoryRepository categoryRepository;

    public CategoryService(CategoryRepository categoryRepository) {
        this.categoryRepository = categoryRepository;
    }

    public List<CategoryResponse> list(User user) {
        return categoryRepository.findVisibleToUser(user.getId()).stream().map(this::toResponse).toList();
    }

    public CategoryResponse create(User user, CategoryRequest request) {
        Category category = new Category();
        category.setUser(user);
        category.setName(request.name());
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
