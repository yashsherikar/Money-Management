package com.frugality.moneymanager.service;

import com.frugality.moneymanager.dto.EmiDtos.EmiResponse;
import com.frugality.moneymanager.dto.ObligationsDtos.ObligationsSummary;
import com.frugality.moneymanager.entity.TransactionType;
import com.frugality.moneymanager.entity.User;
import com.frugality.moneymanager.repository.TransactionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ObligationsServiceTest {

    @Mock EmiService emiService;
    @Mock FixedDepositService fixedDepositService;
    @Mock InsuranceService insuranceService;
    @Mock TransactionRepository transactionRepository;

    @InjectMocks
    ObligationsService obligationsService;

    @Test
    void flagsUnhealthyWhenEmiExceeds40PercentOfIncome() {
        User user = new User();
        user.setId(1L);

        EmiResponse activeEmi = new EmiResponse(1L, 1L, "Car Loan", BigDecimal.valueOf(500000),
                BigDecimal.valueOf(9), 60, BigDecimal.valueOf(45000), LocalDate.now(), 5, true);
        when(emiService.list(user)).thenReturn(List.of(activeEmi));
        when(fixedDepositService.list(user)).thenReturn(List.of());
        when(insuranceService.list(user)).thenReturn(List.of());
        when(transactionRepository.sumByUserAndTypeAndRange(any(), eq(TransactionType.INCOME), any(), any()))
                .thenReturn(BigDecimal.valueOf(100000));

        ObligationsSummary summary = obligationsService.summary(user);

        assertEquals(0, summary.emiToIncomeRatioPercent().compareTo(BigDecimal.valueOf(45.00)));
        assertFalse(summary.emiRatioHealthy());
    }

    @Test
    void healthyWhenEmiWithinThreshold() {
        User user = new User();
        user.setId(1L);

        EmiResponse activeEmi = new EmiResponse(1L, 1L, "Bike Loan", BigDecimal.valueOf(100000),
                BigDecimal.valueOf(9), 24, BigDecimal.valueOf(20000), LocalDate.now(), 5, true);
        when(emiService.list(user)).thenReturn(List.of(activeEmi));
        when(fixedDepositService.list(user)).thenReturn(List.of());
        when(insuranceService.list(user)).thenReturn(List.of());
        when(transactionRepository.sumByUserAndTypeAndRange(any(), eq(TransactionType.INCOME), any(), any()))
                .thenReturn(BigDecimal.valueOf(100000));

        ObligationsSummary summary = obligationsService.summary(user);

        assertEquals(0, summary.emiToIncomeRatioPercent().compareTo(BigDecimal.valueOf(20.00)));
        assertTrue(summary.emiRatioHealthy());
    }
}
