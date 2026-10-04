package com.moneymanager.backend.dto;

import java.math.BigDecimal;
import java.util.List;

public class HistoryDtos {

    public record MonthPoint(
            String month,
            String label,
            BigDecimal income,
            BigDecimal expense,
            BigDecimal savings
    ) {}

    public record CategorySpend(
            Long categoryId,
            String categoryName,
            BigDecimal amount,
            BigDecimal percent
    ) {}

    public record MerchantSpend(
            String name,
            BigDecimal amount,
            int txnCount,
            BigDecimal percent
    ) {}

    public record HistoryInsights(
            String from,
            String to,
            int months,
            BigDecimal totalIncome,
            BigDecimal totalExpense,
            BigDecimal totalSavings,
            String peakSpendMonth,
            BigDecimal peakSpendAmount,
            String topMerchant,
            BigDecimal topMerchantAmount,
            List<MonthPoint> monthly,
            List<CategorySpend> byCategory,
            List<MerchantSpend> topMerchants
    ) {}
}
