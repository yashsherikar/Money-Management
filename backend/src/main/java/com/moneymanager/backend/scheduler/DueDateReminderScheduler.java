package com.moneymanager.backend.scheduler;

import com.moneymanager.backend.entity.*;
import com.moneymanager.backend.repository.EmergencyFundPlanRepository;
import com.moneymanager.backend.repository.EmiRepository;
import com.moneymanager.backend.repository.FixedDepositRepository;
import com.moneymanager.backend.repository.InsurancePolicyRepository;
import com.moneymanager.backend.repository.RecurringTransactionRepository;
import com.moneymanager.backend.service.PushService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.YearMonth;

/**
 * Sends a push notification 2 days before something is due — rent, EMI, insurance premium,
 * FD maturing — so there's a heads-up well before the actual due-day auto-log/flag fires.
 */
@Component
public class DueDateReminderScheduler {

    private static final Logger log = LoggerFactory.getLogger(DueDateReminderScheduler.class);

    private final RecurringTransactionRepository recurringTransactionRepository;
    private final EmiRepository emiRepository;
    private final InsurancePolicyRepository insurancePolicyRepository;
    private final FixedDepositRepository fixedDepositRepository;
    private final EmergencyFundPlanRepository emergencyFundPlanRepository;
    private final PushService pushService;

    public DueDateReminderScheduler(RecurringTransactionRepository recurringTransactionRepository,
                                     EmiRepository emiRepository,
                                     InsurancePolicyRepository insurancePolicyRepository,
                                     FixedDepositRepository fixedDepositRepository,
                                     EmergencyFundPlanRepository emergencyFundPlanRepository,
                                     PushService pushService) {
        this.recurringTransactionRepository = recurringTransactionRepository;
        this.emiRepository = emiRepository;
        this.insurancePolicyRepository = insurancePolicyRepository;
        this.fixedDepositRepository = fixedDepositRepository;
        this.emergencyFundPlanRepository = emergencyFundPlanRepository;
        this.pushService = pushService;
    }

    private static final int REMINDER_LEAD_DAYS = 2;

    @Scheduled(cron = "0 0 8 * * *")
    @Transactional
    public void sendDueTomorrowReminders() {
        LocalDate today = LocalDate.now();
        LocalDate target = today.plusDays(REMINDER_LEAD_DAYS);
        String currentMonth = YearMonth.from(today).toString();

        for (RecurringTransaction rt : recurringTransactionRepository.findByActiveTrue()) {
            if (rt.getRecurrenceType() == RecurrenceType.INTERVAL_DAYS) {
                LocalDate anchor = rt.getLastLoggedDate() != null
                        ? rt.getLastLoggedDate()
                        : rt.getCreatedAt().atZone(java.time.ZoneOffset.UTC).toLocalDate();
                if (target.equals(anchor.plusDays(rt.getIntervalDays()))) {
                    pushService.notifyUser(rt.getUser(), "Expiring in 2 days",
                            rt.getDescription() + " (" + money(rt.getAmount()) + ") expires/renews in 2 days", "/recurring");
                }
                continue;
            }
            if (currentMonth.equals(rt.getLastLoggedMonth())) continue;
            int effectiveDay = Math.min(rt.getDayOfMonth(), target.lengthOfMonth());
            if (target.getDayOfMonth() == effectiveDay) {
                pushService.notifyUser(rt.getUser(), "Due in 2 days",
                        rt.getDescription() + " (" + money(rt.getAmount()) + ") is due in 2 days", "/recurring");
            }
        }

        for (Emi emi : emiRepository.findByActiveTrue()) {
            if (currentMonth.equals(emi.getLastLoggedMonth())) continue;
            int effectiveDay = Math.min(emi.getDueDay(), target.lengthOfMonth());
            if (target.getDayOfMonth() == effectiveDay) {
                pushService.notifyUser(emi.getUser(), "EMI due in 2 days",
                        emi.getLoanName() + " EMI (" + money(emi.getEmiAmount()) + ") is due in 2 days", "/obligations");
            }
        }

        for (InsurancePolicy policy : insurancePolicyRepository.findAll()) {
            if (policy.isActive() && target.equals(policy.getDueDate())) {
                pushService.notifyUser(policy.getUser(), "Premium due in 2 days",
                        policy.getPolicyName() + " premium (" + money(policy.getPremiumAmount()) + ") is due in 2 days", "/obligations");
            }
        }

        for (FixedDeposit fd : fixedDepositRepository.findAll()) {
            if (target.equals(fd.getMaturityDate())) {
                pushService.notifyUser(fd.getUser(), "FD maturing in 2 days",
                        fd.getBankName() + " FD (" + money(fd.getMaturityAmount()) + ") matures in 2 days", "/obligations");
            }
        }

        for (EmergencyFundPlan plan : emergencyFundPlanRepository.findByActiveTrue()) {
            if (currentMonth.equals(plan.getLastLoggedMonth())) continue;
            int effectiveDay = Math.min(plan.getDayOfMonth(), target.lengthOfMonth());
            if (target.getDayOfMonth() == effectiveDay) {
                pushService.notifyUser(plan.getUser(), "Emergency fund contribution in 2 days",
                        money(plan.getAmount()) + " moves from " + plan.getSourceAccount().getName()
                                + " to " + plan.getTargetAccount().getName() + " in 2 days", "/obligations");
            }
        }

        log.info("Due-in-2-days reminder pass complete for {}", target);
    }

    private String money(java.math.BigDecimal amount) {
        return "₹" + amount.toPlainString();
    }
}
