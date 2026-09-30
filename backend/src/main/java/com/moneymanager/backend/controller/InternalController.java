package com.moneymanager.backend.controller;

import com.moneymanager.backend.scheduler.DueDateReminderScheduler;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Lets an external scheduler (e.g. cron-job.org) wake this instance once a day to run the
 * due-date reminder pass, instead of an uptime pinger keeping it running 24/7 — Render's free
 * tier caps at 750 instance-hours/month, which a 24/7 pinger burns through in a single month.
 */
@RestController
@RequestMapping("/api/internal")
public class InternalController {

    private final DueDateReminderScheduler reminderScheduler;
    private final String cronSecret;

    public InternalController(DueDateReminderScheduler reminderScheduler,
                               @Value("${internal.cron-secret:}") String cronSecret) {
        this.reminderScheduler = reminderScheduler;
        this.cronSecret = cronSecret;
    }

    @PostMapping("/trigger-reminders")
    public ResponseEntity<String> triggerReminders(@RequestHeader(value = "X-Cron-Secret", required = false) String suppliedSecret) {
        if (cronSecret.isBlank() || !cronSecret.equals(suppliedSecret)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        reminderScheduler.sendDueTomorrowReminders();
        return ResponseEntity.ok("reminders sent");
    }
}
