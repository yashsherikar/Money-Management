package com.moneymanager.backend.service;

import com.moneymanager.backend.dto.HistoryDtos.*;
import com.moneymanager.backend.entity.Transaction;
import com.moneymanager.backend.entity.TransactionType;
import com.moneymanager.backend.entity.User;
import com.moneymanager.backend.repository.CategoryRepository;
import com.moneymanager.backend.repository.TransactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class HistoryService {

    private static final Pattern UPI_PREFIX = Pattern.compile("(?i)^(UPI(?:\\s+SMS|\\s+Merchant|\\s+Request)?):\\s*(.+)$");
    private static final Pattern PAREN_VPA = Pattern.compile("^(.+?)\\s+\\(([^)\\s]+@[^)]+)\\)\\s*$");
    private static final Pattern SHARE_TAIL = Pattern.compile("(?i)\\s*\\(my share\\s*₹[^)]+\\)\\s*$");

    private final TransactionRepository transactionRepository;
    private final CategoryRepository categoryRepository;

    public HistoryService(TransactionRepository transactionRepository, CategoryRepository categoryRepository) {
        this.transactionRepository = transactionRepository;
        this.categoryRepository = categoryRepository;
    }

    @Transactional(readOnly = true)
    public HistoryInsights insights(User user, int monthsRequested) {
        int months = monthsRequested <= 0 ? 12 : Math.min(monthsRequested, 60);
        LocalDate today = LocalDate.now();
        YearMonth endYm = YearMonth.from(today);
        YearMonth startYm = endYm.minusMonths(months - 1L);

        if (monthsRequested >= 999) {
            LocalDate earliest = transactionRepository.findEarliestTxnDate(user.getId());
            if (earliest != null) {
                startYm = YearMonth.from(earliest);
                months = (int) Math.min(60, Math.max(1,
                        (endYm.getYear() - startYm.getYear()) * 12L
                                + (endYm.getMonthValue() - startYm.getMonthValue()) + 1));
            }
        }

        LocalDate from = startYm.atDay(1);
        LocalDate to = endYm.atEndOfMonth();

        List<MonthPoint> monthly = new ArrayList<>();
        BigDecimal totalIncome = BigDecimal.ZERO;
        BigDecimal totalExpense = BigDecimal.ZERO;
        String peakMonth = null;
        BigDecimal peakSpend = BigDecimal.ZERO;

        YearMonth cursor = startYm;
        while (!cursor.isAfter(endYm)) {
            LocalDate mFrom = cursor.atDay(1);
            LocalDate mTo = cursor.atEndOfMonth();
            BigDecimal income = nz(transactionRepository.sumByUserAndTypeAndRange(
                    user.getId(), TransactionType.INCOME, mFrom, mTo));
            BigDecimal expense = nz(transactionRepository.sumByUserAndTypeAndRange(
                    user.getId(), TransactionType.EXPENSE, mFrom, mTo));
            BigDecimal savings = income.subtract(expense);
            totalIncome = totalIncome.add(income);
            totalExpense = totalExpense.add(expense);
            if (expense.compareTo(peakSpend) > 0) {
                peakSpend = expense;
                peakMonth = cursor.toString();
            }
            String label = cursor.getMonth().getDisplayName(TextStyle.SHORT, Locale.ENGLISH)
                    + " " + String.valueOf(cursor.getYear()).substring(2);
            monthly.add(new MonthPoint(cursor.toString(), label, income, expense, savings));
            cursor = cursor.plusMonths(1);
        }

        Map<Long, String> categoryNames = categoryRepository.findVisibleToUser(user.getId()).stream()
                .collect(java.util.stream.Collectors.toMap(c -> c.getId(), c -> c.getName(), (a, b) -> a));

        List<Object[]> categoryRows = transactionRepository.sumExpenseByCategory(user.getId(), from, to);
        List<CategorySpend> byCategory = new ArrayList<>();
        for (Object[] row : categoryRows) {
            Long catId = (Long) row[0];
            BigDecimal amount = nz((BigDecimal) row[1]);
            if (amount.compareTo(BigDecimal.ZERO) <= 0) continue;
            BigDecimal pct = totalExpense.compareTo(BigDecimal.ZERO) == 0
                    ? BigDecimal.ZERO
                    : amount.multiply(BigDecimal.valueOf(100)).divide(totalExpense, 1, RoundingMode.HALF_UP);
            byCategory.add(new CategorySpend(
                    catId,
                    catId == null ? "Uncategorized" : categoryNames.getOrDefault(catId, "Unknown"),
                    amount,
                    pct
            ));
        }
        byCategory.sort(Comparator.comparing(CategorySpend::amount).reversed());

        List<Transaction> expenses = transactionRepository.findExpensesForHistory(user.getId(), from, to);
        Map<String, BigDecimal> merchantTotals = new HashMap<>();
        Map<String, Integer> merchantCounts = new HashMap<>();
        for (Transaction t : expenses) {
            String name = extractMerchantName(t.getDescription());
            if (name.isBlank() || name.equalsIgnoreCase("UPI payment") || name.equalsIgnoreCase("Transfer")) {
                continue;
            }
            String key = name.toLowerCase(Locale.ROOT);
            merchantTotals.merge(key, nz(t.getAmount()), BigDecimal::add);
            merchantCounts.merge(key, 1, Integer::sum);
        }

        // Preserve display casing from first seen key via reverse lookup
        Map<String, String> displayNames = new LinkedHashMap<>();
        for (Transaction t : expenses) {
            String name = extractMerchantName(t.getDescription());
            if (name.isBlank()) continue;
            displayNames.putIfAbsent(name.toLowerCase(Locale.ROOT), name);
        }

        // Must be effectively final for the stream lambda below
        final BigDecimal expenseTotalForPct = totalExpense;
        List<MerchantSpend> topMerchants = merchantTotals.entrySet().stream()
                .sorted((a, b) -> b.getValue().compareTo(a.getValue()))
                .limit(10)
                .map(e -> {
                    BigDecimal amount = e.getValue();
                    BigDecimal pct = expenseTotalForPct.compareTo(BigDecimal.ZERO) == 0
                            ? BigDecimal.ZERO
                            : amount.multiply(BigDecimal.valueOf(100)).divide(expenseTotalForPct, 1, RoundingMode.HALF_UP);
                    return new MerchantSpend(
                            displayNames.getOrDefault(e.getKey(), e.getKey()),
                            amount,
                            merchantCounts.getOrDefault(e.getKey(), 0),
                            pct
                    );
                })
                .toList();

        String topMerchant = topMerchants.isEmpty() ? null : topMerchants.get(0).name();
        BigDecimal topMerchantAmount = topMerchants.isEmpty() ? BigDecimal.ZERO : topMerchants.get(0).amount();

        return new HistoryInsights(
                from.toString(),
                to.toString(),
                months,
                totalIncome,
                totalExpense,
                totalIncome.subtract(totalExpense),
                peakMonth,
                peakSpend,
                topMerchant,
                topMerchantAmount,
                monthly,
                byCategory,
                topMerchants
        );
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    /**
     * Known brands (longer keys first). If payee name is missing/weak but the
     * description contains e.g. "uber" / "uberindia", surface "Uber".
     */
    private static final String[][] BRAND_HINTS = {
            {"uber eats", "Uber"},
            {"ubereats", "Uber"},
            {"uberindia", "Uber"},
            {"uber trip", "Uber"},
            {"uber ride", "Uber"},
            {"uber", "Uber"},
            {"swiggy instamart", "Swiggy"},
            {"swiggy one", "Swiggy"},
            {"swiggy", "Swiggy"},
            {"zomato gold", "Zomato"},
            {"zomato", "Zomato"},
            {"blinkit", "Blinkit"},
            {"grofers", "Blinkit"},
            {"zepto", "Zepto"},
            {"ola cabs", "Ola"},
            {"olacabs", "Ola"},
            {"ola money", "Ola"},
            {"rapido", "Rapido"},
            {"amazon prime", "Amazon Prime"},
            {"amazon.in", "Amazon"},
            {"amazon pay", "Amazon"},
            {"amazon", "Amazon"},
            {"flipkart", "Flipkart"},
            {"phonepe", "PhonePe"},
            {"google pay", "Google Pay"},
            {"gpay", "Google Pay"},
            {"paytm", "Paytm"},
            {"netflix", "Netflix"},
            {"spotify", "Spotify"},
            {"mcdonald", "McDonald's"},
            {"dominos", "Domino's"},
            {"domino", "Domino's"},
            {"starbucks", "Starbucks"},
            {"irctc", "IRCTC"},
            {"makemytrip", "MakeMyTrip"},
            {"redbus", "redBus"},
            {"myntra", "Myntra"},
            {"nykaa", "Nykaa"},
            {"airtel", "Airtel"},
    };

    private static boolean isWeakTitle(String title) {
        if (title == null || title.isBlank()) return true;
        String t = title.trim();
        String lower = t.toLowerCase(Locale.ROOT);
        if (lower.equals("transaction") || lower.equals("payment") || lower.equals("upi payment")
                || lower.equals("upi") || lower.equals("transfer") || lower.equals("paid")
                || lower.equals("unknown") || lower.equals("merchant") || lower.equals("payee")) {
            return true;
        }
        if (t.length() <= 2) return true;
        if (t.matches("^[\\d\\s.*…xX\\-]+$")) return true;
        if (t.contains("@") && !t.contains(" ")) return true;
        return false;
    }

    private static String brandFromText(String text) {
        if (text == null || text.isBlank()) return null;
        String hay = text.toLowerCase(Locale.ROOT);
        for (String[] pair : BRAND_HINTS) {
            String key = pair[0];
            String name = pair[1];
            // whole token
            Pattern exact = Pattern.compile("(?:^|[^a-z0-9])" + Pattern.quote(key) + "(?:[^a-z0-9]|$)", Pattern.CASE_INSENSITIVE);
            if (exact.matcher(hay).find()) return name;
            // prefix in merchant codes: uber → uberindia
            if (key.length() >= 4 && !key.contains(" ") && !key.contains("@")) {
                Pattern prefix = Pattern.compile(
                        "(?:^|[^a-z0-9])" + Pattern.quote(key) + "[a-z0-9]{0,24}(?:[^a-z0-9]|$)",
                        Pattern.CASE_INSENSITIVE);
                if (prefix.matcher(hay).find()) return name;
            }
        }
        return null;
    }

    /** Aligns with frontend txnDisplay — headline merchant/payee name. */
    static String extractMerchantName(String description) {
        if (description == null || description.isBlank()) return "";
        String raw = description.trim();
        raw = SHARE_TAIL.matcher(raw).replaceFirst("").trim();
        raw = raw.replaceFirst("(?i)^Split:\\s*", "").trim();

        Matcher upi = UPI_PREFIX.matcher(raw);
        if (upi.matches()) {
            raw = upi.group(2).trim();
        }

        String title = raw;
        Matcher paren = PAREN_VPA.matcher(raw);
        if (paren.matches()) {
            title = paren.group(1).trim();
        } else if (raw.contains(" · ")) {
            title = raw.split("\\s·\\s", 2)[0].trim();
        } else if (raw.matches("^[^)\\s]+@[^)\\s]+$")) {
            title = "";
        }

        if (raw.toLowerCase(Locale.ROOT).startsWith("transfer:")) {
            title = "";
        }

        String brand = brandFromText(description);
        if (brand != null && (isWeakTitle(title) || looksLikeBrandCode(title, brand))) {
            return brand;
        }
        return title == null ? "" : title.trim();
    }

    private static boolean looksLikeBrandCode(String title, String brandName) {
        if (title == null || brandName == null) return false;
        String t = title.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
        String b = brandName.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
        return !t.isEmpty() && !b.isEmpty() && (t.equals(b) || t.startsWith(b));
    }
}
