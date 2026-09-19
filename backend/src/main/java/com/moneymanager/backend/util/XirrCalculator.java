package com.moneymanager.backend.util;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

/** Newton-Raphson XIRR solver on dated cash flows (invested = negative, redeemed/current value = positive). */
public class XirrCalculator {

    public record CashFlow(LocalDate date, double amount) {}

    private static final int MAX_ITERATIONS = 100;
    private static final double PRECISION = 1e-7;

    /** Annualized rate as a fraction (0.12 = 12%), or null if it isn't computable (needs both an outflow and an inflow). */
    public static Double xirr(List<CashFlow> flows) {
        if (flows.size() < 2) return null;
        boolean hasPositive = flows.stream().anyMatch(f -> f.amount() > 0);
        boolean hasNegative = flows.stream().anyMatch(f -> f.amount() < 0);
        if (!hasPositive || !hasNegative) return null;

        LocalDate anchor = flows.get(0).date();
        double rate = 0.1;
        for (int i = 0; i < MAX_ITERATIONS; i++) {
            double npv = 0, dNpv = 0;
            for (CashFlow f : flows) {
                double years = ChronoUnit.DAYS.between(anchor, f.date()) / 365.0;
                double factor = Math.pow(1 + rate, years);
                npv += f.amount() / factor;
                dNpv -= years * f.amount() / (factor * (1 + rate));
            }
            if (Math.abs(dNpv) < 1e-9) return null;
            double newRate = rate - npv / dNpv;
            if (Double.isNaN(newRate) || Double.isInfinite(newRate) || newRate <= -0.999) return null;
            if (Math.abs(newRate - rate) < PRECISION) return newRate;
            rate = newRate;
        }
        return null;
    }
}
