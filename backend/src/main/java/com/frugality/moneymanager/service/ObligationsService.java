package com.frugality.moneymanager.service;

import com.frugality.moneymanager.dto.EmiDtos.EmiResponse;
import com.frugality.moneymanager.dto.ObligationsDtos.ObligationsSummary;
import com.frugality.moneymanager.entity.TransactionType;
import com.frugality.moneymanager.entity.User;
import com.frugality.moneymanager.repository.TransactionRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.YearMonth;

@Service
public class ObligationsService {

    private static final BigDecimal HEALTHY_EMI_RATIO_THRESHOLD = BigDecimal.valueOf(40);

    private final EmiService emiService;
    private final FixedDepositService fixedDepositService;
    private final InsuranceService insuranceService;
    private final TransactionRepository transactionRepository;

    public ObligationsService(EmiService emiService, FixedDepositService fixedDepositService,
                               InsuranceService insuranceService, TransactionRepository transactionRepository) {
        this.emiService = emiService;
        this.fixedDepositService = fixedDepositService;
        this.insuranceService = insuranceService;
        this.transactionRepository = transactionRepository;
    }

    public ObligationsSummary summary(User user) {
        var emis = emiService.list(user);
        var fds = fixedDepositService.list(user);
        var policies = insuranceService.list(user);

        BigDecimal totalMonthlyEmi = emis.stream()
                .filter(EmiResponse::active)
                .map(EmiResponse::emiAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        YearMonth month = YearMonth.now();
        BigDecimal monthlyIncome = transactionRepository.sumByUserAndTypeAndRange(
                user.getId(), TransactionType.INCOME, month.atDay(1), month.atEndOfMonth());

        BigDecimal ratio = monthlyIncome.compareTo(BigDecimal.ZERO) == 0
                ? BigDecimal.ZERO
                : totalMonthlyEmi.multiply(BigDecimal.valueOf(100)).divide(monthlyIncome, 2, RoundingMode.HALF_UP);

        boolean healthy = ratio.compareTo(HEALTHY_EMI_RATIO_THRESHOLD) <= 0;

        return new ObligationsSummary(emis, fds, policies, totalMonthlyEmi, monthlyIncome, ratio, healthy);
    }
}
