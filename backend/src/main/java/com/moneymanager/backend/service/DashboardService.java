package com.moneymanager.backend.service;

import com.moneymanager.backend.dto.DashboardDtos.*;
import com.moneymanager.backend.entity.Transaction;
import com.moneymanager.backend.entity.TransactionType;
import com.moneymanager.backend.entity.User;
import com.moneymanager.backend.repository.CategoryRepository;
import com.moneymanager.backend.repository.TransactionRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;

@Service
public class DashboardService {

    private final TransactionRepository transactionRepository;
    private final CategoryRepository categoryRepository;

    public DashboardService(TransactionRepository transactionRepository, CategoryRepository categoryRepository) {
        this.transactionRepository = transactionRepository;
        this.categoryRepository = categoryRepository;
    }

    public DashboardSummary summary(User user, YearMonth month) {
        LocalDate from = month.atDay(1);
        LocalDate to = month.atEndOfMonth();
        YearMonth prevMonth = month.minusMonths(1);

        BigDecimal income = transactionRepository.sumByUserAndTypeAndRange(user.getId(), TransactionType.INCOME, from, to);
        BigDecimal expense = transactionRepository.sumByUserAndTypeAndRange(user.getId(), TransactionType.EXPENSE, from, to);
        BigDecimal savings = income.subtract(expense);
        BigDecimal savingsRate = income.compareTo(BigDecimal.ZERO) == 0
                ? BigDecimal.ZERO
                : savings.multiply(BigDecimal.valueOf(100)).divide(income, 2, RoundingMode.HALF_UP);

        BigDecimal prevIncome = transactionRepository.sumByUserAndTypeAndRange(user.getId(), TransactionType.INCOME, prevMonth.atDay(1), prevMonth.atEndOfMonth());
        BigDecimal prevExpense = transactionRepository.sumByUserAndTypeAndRange(user.getId(), TransactionType.EXPENSE, prevMonth.atDay(1), prevMonth.atEndOfMonth());
        BigDecimal prevSavings = prevIncome.subtract(prevExpense);
        BigDecimal savingsChangePercent = prevSavings.compareTo(BigDecimal.ZERO) == 0
                ? BigDecimal.ZERO
                : savings.subtract(prevSavings).multiply(BigDecimal.valueOf(100)).divide(prevSavings.abs(), 2, RoundingMode.HALF_UP);

        Map<Long, String> categoryNames = categoryRepository.findVisibleToUser(user.getId()).stream()
                .collect(java.util.stream.Collectors.toMap(c -> c.getId(), c -> c.getName()));

        List<CategoryBreakdown> byCategory = transactionRepository.sumExpenseByCategory(user.getId(), from, to).stream()
                .map(row -> {
                    Long catId = (Long) row[0];
                    BigDecimal amount = (BigDecimal) row[1];
                    return new CategoryBreakdown(catId, catId == null ? "Uncategorized" : categoryNames.getOrDefault(catId, "Unknown"), amount);
                })
                .toList();

        List<Transaction> nonEssential = transactionRepository.findNonEssentialExpenses(user.getId(), from, to);
        BigDecimal unwantedTotal = nonEssential.stream().map(Transaction::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        List<UnwantedExpense> unwanted = nonEssential.stream()
                .map(t -> new UnwantedExpense(t.getId(), t.getDescription(), t.getCategory().getName(), t.getAmount()))
                .toList();

        return new DashboardSummary(income, expense, savings, savingsRate, prevSavings, savingsChangePercent,
                byCategory, unwantedTotal, unwanted);
    }
}
