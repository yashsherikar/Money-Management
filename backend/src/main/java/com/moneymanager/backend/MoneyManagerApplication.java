package com.moneymanager.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.util.TimeZone;

@SpringBootApplication
@EnableScheduling
public class MoneyManagerApplication {
    public static void main(String[] args) {
        // Render's container clock defaults to UTC; every LocalDate.now() and @Scheduled cron
        // in this app assumes IST (the user is in India), so pin it before anything else starts.
        TimeZone.setDefault(TimeZone.getTimeZone("Asia/Kolkata"));
        SpringApplication.run(MoneyManagerApplication.class, args);
    }
}
