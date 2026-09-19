package com.moneymanager.backend.dto;

import java.math.BigDecimal;
import java.util.List;

public class ObligationsDtos {

    public record ObligationsSummary(
            List<EmiDtos.EmiResponse> emis,
            List<FixedDepositDtos.FdResponse> fixedDeposits,
            List<InsuranceDtos.InsuranceResponse> insurancePolicies,
            BigDecimal totalMonthlyEmi,
            BigDecimal totalMonthlyIncome,
            BigDecimal emiToIncomeRatioPercent,
            boolean emiRatioHealthy
    ) {}
}
