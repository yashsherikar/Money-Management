package com.moneymanager.backend.scheduler;

import com.moneymanager.backend.entity.*;
import com.moneymanager.backend.repository.EmiRepository;
import com.moneymanager.backend.repository.FixedDepositRepository;
import com.moneymanager.backend.repository.InsurancePolicyRepository;
import com.moneymanager.backend.repository.RecurringTransactionRepository;
import com.moneymanager.backend.service.PushService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.YearMonth;

/**
 * Sends a push notification the day before something is due — rent tomorrow, EMI tomorrow,
 * insurance premium tomorrow, FD maturing tomorrow — so there's a heads-up before the actual
 * due-day auto-log/flag fires.
 */
@Component
public class DueDateReminderScheduler {

    private static final Logger log = LoggerFactory.getLogger(DueDateReminderScheduler.class);

    private final RecurringTransactionRepository recurringTransactionRepository;
    private final EmiRepository emiRepository;
    private final InsurancePolicyRepository insurancePolicyRepository;
    private final FixedDepositRepository fixedDepositRepository;
    private final PushService pushService;

    public DueDateReminderScheduler(RecurringTransactionRepository recurringTransactionRepository,
                                     EmiRepository emiRepository,
                                     InsurancePolicyRepository insurancePolicyRepository,
                                     FixedDepositRepository fixedDepositRepository,
                                     PushService pushService) {
        this.recurringTransactionRepository = recurringTransactionRepository;
        this.emiRepository = emiRepository;
        this.insurancePolicyRepository = insurancePolicyRepository;
        this.fixedDepositRepository = fixedDepositRepository;
        this.pushService = pushService;
    }

    @Scheduled(cron = "0 0 8 * * *")
    public void sendDueTomorrowReminders() {
        LocalDate today = LocalDate.now();
        LocalDate tomorrow = today.plusDays(1);
        String currentMonth = YearMonth.from(today).toString();

        for (RecurringTransaction rt : recurringTransactionRepository.findByActiveTrue()) {
            if (currentMonth.equals(rt.getLastLoggedMonth())) continue;
            int effectiveDay = Math.min(rt.getDayOfMonth(), tomorrow.lengthOfMonth());
            if (tomorrow.getDayOfMonth() == effectiveDay) {
                pushService.notifyUser(rt.getUser(), "Due tomorrow",
                        rt.getDescription() + " (" + money(rt.getAmount()) + ") is due tomorrow");
            }
        }

        for (Emi emi : emiRepository.findByActiveTrue()) {
            if (currentMonth.equals(emi.getLastLoggedMonth())) continue;
            int effectiveDay = Math.min(emi.getDueDay(), tomorrow.lengthOfMonth());
            if (tomorrow.getDayOfMonth() == effectiveDay) {
                pushService.notifyUser(emi.getUser(), "EMI due tomorrow",
                        emi.getLoanName() + " EMI (" + money(emi.getEmiAmount()) + ") is due tomorrow");
            }
        }

        for (InsurancePolicy policy : insurancePolicyRepository.findAll()) {
            if (policy.isActive() && tomorrow.equals(policy.getDueDate())) {
                pushService.notifyUser(policy.getUser(), "Premium due tomorrow",
                        policy.getPolicyName() + " premium (" + money(policy.getPremiumAmount()) + ") is due tomorrow");
            }
        }

        for (FixedDeposit fd : fixedDepositRepository.findAll()) {
            if (tomorrow.equals(fd.getMaturityDate())) {
                pushService.notifyUser(fd.getUser(), "FD maturing tomorrow",
                        fd.getBankName() + " FD (" + money(fd.getMaturityAmount()) + ") matures tomorrow");
            }
        }

        log.info("Due-tomorrow reminder pass complete for {}", tomorrow);
    }

    private String money(java.math.BigDecimal amount) {
        return "₹" + amount.toPlainString();
    }
}
