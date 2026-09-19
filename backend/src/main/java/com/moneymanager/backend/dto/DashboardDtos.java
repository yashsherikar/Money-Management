package com.moneymanager.backend.dto;

import java.math.BigDecimal;
import java.util.List;

public class DashboardDtos {

    public record CategoryBreakdown(
            Long categoryId,
            String categoryName,
            BigDecimal amount
    ) {}

    public record UnwantedExpense(
            Long transactionId,
            String description,
            String categoryName,
            BigDecimal amount
    ) {}

    public record DashboardSummary(
            BigDecimal totalIncome,
            BigDecimal totalExpense,
            BigDecimal savings,
            BigDecimal savingsRatePercent,
            BigDecimal lastMonthSavings,
            BigDecimal savingsChangePercent,
            List<CategoryBreakdown> expenseByCategory,
            BigDecimal unwantedExpenseTotal,
            List<UnwantedExpense> unwantedExpenses
    ) {}
}
