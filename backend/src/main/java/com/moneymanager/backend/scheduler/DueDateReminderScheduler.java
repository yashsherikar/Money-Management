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
import java.time.LocalTime;
import java.time.YearMonth;
import java.time.ZoneId;

/**
 * Recurring due reminders:
 * <ul>
 *   <li>2 days before — morning (~8:00 IST)</li>
 *   <li>1 day before — morning (~8:00 IST)</li>
 *   <li>on the due day — afternoon (~16:00 IST)</li>
 * </ul>
 * Uses Asia/Kolkata so Render's UTC clock does not shift the window.
 */
@Component
public class DueDateReminderScheduler {

    private static final Logger log = LoggerFactory.getLogger(DueDateReminderScheduler.class);
    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

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

    /** Morning pass: 2-days-before and 1-day-before reminders. */
    @Scheduled(cron = "0 0 8 * * *", zone = "Asia/Kolkata")
    @Transactional
    public void sendMorningReminders() {
        sendRemindersForLeadDays(2);
        sendRemindersForLeadDays(1);
        log.info("Morning due-date reminder pass complete");
    }

    /** Afternoon pass: due-today reminders around 4pm IST. */
    @Scheduled(cron = "0 0 16 * * *", zone = "Asia/Kolkata")
    @Transactional
    public void sendDueTodayReminders() {
        sendRemindersForLeadDays(0);
        log.info("Due-today (4pm) reminder pass complete");
    }

    /**
     * External cron (cron-job.org) entry point. Picks morning vs afternoon pass from IST clock
     * so a single endpoint still covers both windows when the free-tier instance was asleep.
     */
    @Transactional
    public void sendDueTomorrowReminders() {
        LocalTime now = LocalTime.now(IST);
        if (now.getHour() < 13) {
            sendRemindersForLeadDays(2);
            sendRemindersForLeadDays(1);
            log.info("Triggered morning reminder pass (IST hour {})", now.getHour());
        } else {
            sendRemindersForLeadDays(0);
            log.info("Triggered due-today reminder pass (IST hour {})", now.getHour());
        }
    }

    private void sendRemindersForLeadDays(int leadDays) {
        LocalDate today = LocalDate.now(IST);
        LocalDate target = today.plusDays(leadDays);
        String currentMonth = YearMonth.from(today).toString();
        String whenLabel = whenLabel(leadDays);
        String titlePrefix = titlePrefix(leadDays);

        for (RecurringTransaction rt : recurringTransactionRepository.findByActiveTrue()) {
            if (rt.getRecurrenceType() == RecurrenceType.INTERVAL_DAYS) {
                LocalDate anchor = rt.getLastLoggedDate() != null
                        ? rt.getLastLoggedDate()
                        : rt.getCreatedAt().atZone(java.time.ZoneOffset.UTC).toLocalDate();
                if (target.equals(anchor.plusDays(rt.getIntervalDays()))) {
                    pushService.notifyUser(rt.getUser(), titlePrefix,
                            rt.getDescription() + " (" + money(rt.getAmount()) + ") " + whenLabel,
                            "/recurring?confirm=" + rt.getId(), PushService.ACTION_PAID_VIEW, null,
                            PushService.RELATED_RECURRING_TRANSACTION, rt.getId());
                }
                continue;
            }
            if (currentMonth.equals(rt.getLastLoggedMonth())) continue;
            int effectiveDay = Math.min(rt.getDayOfMonth(), target.lengthOfMonth());
            if (target.getDayOfMonth() == effectiveDay) {
                pushService.notifyUser(rt.getUser(), titlePrefix,
                        rt.getDescription() + " (" + money(rt.getAmount()) + ") " + whenLabel,
                        "/recurring?confirm=" + rt.getId(), PushService.ACTION_PAID_VIEW, null,
                        PushService.RELATED_RECURRING_TRANSACTION, rt.getId());
            }
        }

        for (Emi emi : emiRepository.findByActiveTrue()) {
            if (currentMonth.equals(emi.getLastLoggedMonth())) continue;
            int effectiveDay = Math.min(emi.getDueDay(), target.lengthOfMonth());
            if (target.getDayOfMonth() == effectiveDay) {
                pushService.notifyUser(emi.getUser(), "EMI " + titlePrefix.toLowerCase(),
                        emi.getLoanName() + " EMI (" + money(emi.getEmiAmount()) + ") " + whenLabel,
                        "/obligations", PushService.ACTION_PAID_VIEW, null,
                        PushService.RELATED_EMI, emi.getId());
            }
        }

        for (InsurancePolicy policy : insurancePolicyRepository.findAll()) {
            if (policy.isActive() && target.equals(policy.getDueDate())) {
                pushService.notifyUser(policy.getUser(), "Premium " + titlePrefix.toLowerCase(),
                        policy.getPolicyName() + " premium (" + money(policy.getPremiumAmount()) + ") " + whenLabel,
                        "/obligations", PushService.ACTION_PAID_VIEW);
            }
        }

        for (FixedDeposit fd : fixedDepositRepository.findAll()) {
            if (target.equals(fd.getMaturityDate())) {
                String fdTitle = leadDays == 0 ? "FD maturing today" : "FD maturing " + whenLabel;
                pushService.notifyUser(fd.getUser(), fdTitle,
                        fd.getBankName() + " FD (" + money(fd.getMaturityAmount()) + ") "
                                + (leadDays == 0 ? "matures today" : "matures " + whenLabel),
                        "/obligations", PushService.ACTION_VIEW_ONLY);
            }
        }

        for (EmergencyFundPlan plan : emergencyFundPlanRepository.findByActiveTrue()) {
            if (currentMonth.equals(plan.getLastLoggedMonth())) continue;
            int effectiveDay = Math.min(plan.getDayOfMonth(), target.lengthOfMonth());
            if (target.getDayOfMonth() == effectiveDay) {
                pushService.notifyUser(plan.getUser(), "Emergency fund " + titlePrefix.toLowerCase(),
                        money(plan.getAmount()) + " moves from " + plan.getSourceAccount().getName()
                                + " to " + plan.getTargetAccount().getName() + " " + whenLabel,
                        "/obligations", PushService.ACTION_PAID_VIEW, null,
                        PushService.RELATED_EMERGENCY_FUND, plan.getId());
            }
        }
    }

    private static String whenLabel(int leadDays) {
        return switch (leadDays) {
            case 0 -> "is due today";
            case 1 -> "is due tomorrow";
            default -> "is due in " + leadDays + " days";
        };
    }

    private static String titlePrefix(int leadDays) {
        return switch (leadDays) {
            case 0 -> "Due today";
            case 1 -> "Due tomorrow";
            default -> "Due in " + leadDays + " days";
        };
    }

    private String money(java.math.BigDecimal amount) {
        return "₹" + amount.toPlainString();
    }
}
