package com.moneymanager.backend.controller;

import com.moneymanager.backend.dto.CategoryDtos.*;
import com.moneymanager.backend.entity.User;
import com.moneymanager.backend.service.CategoryService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/categories")
public class CategoryController {

    private final CategoryService categoryService;

    public CategoryController(CategoryService categoryService) {
        this.categoryService = categoryService;
    }

    @GetMapping
    public List<CategoryResponse> list(@AuthenticationPrincipal User user) {
        return categoryService.list(user);
    }

    @PostMapping
    public CategoryResponse create(@AuthenticationPrincipal User user, @Valid @RequestBody CategoryRequest request) {
        return categoryService.create(user, request);
    }

    @DeleteMapping("/{id}")
    public void delete(@AuthenticationPrincipal User user, @PathVariable Long id) {
        categoryService.delete(user, id);
    }
}
