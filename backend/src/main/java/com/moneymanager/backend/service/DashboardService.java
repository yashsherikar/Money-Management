package com.moneymanager.backend.service;

import com.moneymanager.backend.dto.DashboardDtos.*;
import com.moneymanager.backend.entity.Account;
import com.moneymanager.backend.entity.Transaction;
import com.moneymanager.backend.entity.TransactionType;
import com.moneymanager.backend.entity.User;
import com.moneymanager.backend.repository.AccountRepository;
import com.moneymanager.backend.repository.CategoryRepository;
import com.moneymanager.backend.repository.TransactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
    private final AccountRepository accountRepository;

    public DashboardService(TransactionRepository transactionRepository,
                            CategoryRepository categoryRepository,
                            AccountRepository accountRepository) {
        this.transactionRepository = transactionRepository;
        this.categoryRepository = categoryRepository;
        this.accountRepository = accountRepository;
    }

    @Transactional(readOnly = true)
    public DashboardSummary summary(User user, YearMonth month) {
        LocalDate from = month.atDay(1);
        LocalDate to = month.atEndOfMonth();
        YearMonth prevMonth = month.minusMonths(1);

        // Dashboard = primary bank only; secondary accounts stay visible on Transactions
        Long primaryAccountId = accountRepository.findByUserIdAndPrimaryTrue(user.getId())
                .map(Account::getId)
                .orElse(null);

        BigDecimal income;
        BigDecimal expense;
        BigDecimal prevIncome;
        BigDecimal prevExpense;
        List<Object[]> categoryRows;
        List<Transaction> nonEssential;

        if (primaryAccountId != null) {
            income = transactionRepository.sumByUserAccountAndTypeAndRange(
                    user.getId(), primaryAccountId, TransactionType.INCOME, from, to);
            expense = transactionRepository.sumByUserAccountAndTypeAndRange(
                    user.getId(), primaryAccountId, TransactionType.EXPENSE, from, to);
            prevIncome = transactionRepository.sumByUserAccountAndTypeAndRange(
                    user.getId(), primaryAccountId, TransactionType.INCOME,
                    prevMonth.atDay(1), prevMonth.atEndOfMonth());
            prevExpense = transactionRepository.sumByUserAccountAndTypeAndRange(
                    user.getId(), primaryAccountId, TransactionType.EXPENSE,
                    prevMonth.atDay(1), prevMonth.atEndOfMonth());
            categoryRows = transactionRepository.sumExpenseByCategoryForAccount(
                    user.getId(), primaryAccountId, from, to);
            nonEssential = transactionRepository.findNonEssentialExpensesForAccount(
                    user.getId(), primaryAccountId, from, to);
        } else {
            income = transactionRepository.sumByUserAndTypeAndRange(user.getId(), TransactionType.INCOME, from, to);
            expense = transactionRepository.sumByUserAndTypeAndRange(user.getId(), TransactionType.EXPENSE, from, to);
            prevIncome = transactionRepository.sumByUserAndTypeAndRange(
                    user.getId(), TransactionType.INCOME, prevMonth.atDay(1), prevMonth.atEndOfMonth());
            prevExpense = transactionRepository.sumByUserAndTypeAndRange(
                    user.getId(), TransactionType.EXPENSE, prevMonth.atDay(1), prevMonth.atEndOfMonth());
            categoryRows = transactionRepository.sumExpenseByCategory(user.getId(), from, to);
            nonEssential = transactionRepository.findNonEssentialExpenses(user.getId(), from, to);
        }

        BigDecimal savings = income.subtract(expense);
        BigDecimal savingsRate = income.compareTo(BigDecimal.ZERO) == 0
                ? BigDecimal.ZERO
                : savings.multiply(BigDecimal.valueOf(100)).divide(income, 2, RoundingMode.HALF_UP);

        BigDecimal prevSavings = prevIncome.subtract(prevExpense);
        BigDecimal savingsChangePercent = prevSavings.compareTo(BigDecimal.ZERO) == 0
                ? BigDecimal.ZERO
                : savings.subtract(prevSavings).multiply(BigDecimal.valueOf(100)).divide(prevSavings.abs(), 2, RoundingMode.HALF_UP);

        Map<Long, String> categoryNames = categoryRepository.findVisibleToUser(user.getId()).stream()
                .collect(java.util.stream.Collectors.toMap(c -> c.getId(), c -> c.getName()));

        List<CategoryBreakdown> byCategory = categoryRows.stream()
                .map(row -> {
                    Long catId = (Long) row[0];
                    BigDecimal amount = (BigDecimal) row[1];
                    return new CategoryBreakdown(catId, catId == null ? "Uncategorized" : categoryNames.getOrDefault(catId, "Unknown"), amount);
                })
                .toList();

        BigDecimal unwantedTotal = nonEssential.stream().map(Transaction::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        List<UnwantedExpense> unwanted = nonEssential.stream()
                .map(t -> new UnwantedExpense(t.getId(), t.getDescription(), t.getCategory() == null ? null : t.getCategory().getName(), t.getAmount()))
                .toList();

        return new DashboardSummary(income, expense, savings, savingsRate, prevSavings, savingsChangePercent,
                byCategory, unwantedTotal, unwanted);
    }
}
