package com.moneymanager.backend.scheduler;

import com.moneymanager.backend.entity.*;
import com.moneymanager.backend.repository.AccountRepository;
import com.moneymanager.backend.repository.CategoryRepository;
import com.moneymanager.backend.repository.EmiRepository;
import com.moneymanager.backend.repository.TransactionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.YearMonth;

/**
 * Auto-logs each active EMI as an expense transaction once its due day has passed for the
 * current month. lastLoggedMonth on the EMI guards against double-logging on repeated runs.
 */
@Component
public class EmiAutoLogScheduler {

    private static final Logger log = LoggerFactory.getLogger(EmiAutoLogScheduler.class);

    private final EmiRepository emiRepository;
    private final AccountRepository accountRepository;
    private final CategoryRepository categoryRepository;
    private final TransactionRepository transactionRepository;

    public EmiAutoLogScheduler(EmiRepository emiRepository, AccountRepository accountRepository,
                                CategoryRepository categoryRepository, TransactionRepository transactionRepository) {
        this.emiRepository = emiRepository;
        this.accountRepository = accountRepository;
        this.categoryRepository = categoryRepository;
        this.transactionRepository = transactionRepository;
    }

    @Scheduled(cron = "0 0 1 * * *")
    @Transactional
    public void logDueEmis() {
        LocalDate today = LocalDate.now();
        String currentMonth = YearMonth.from(today).toString();
        Category emiCategory = categoryRepository.findByNameAndIsDefaultTrue("EMI").orElse(null);

        for (Emi emi : emiRepository.findByActiveTrue()) {
            boolean alreadyLogged = currentMonth.equals(emi.getLastLoggedMonth());
            if (alreadyLogged || today.getDayOfMonth() < Math.min(emi.getDueDay(), today.lengthOfMonth())) {
                continue;
            }
            Account account = emi.getAccount();

            Transaction txn = new Transaction();
            txn.setUser(emi.getUser());
            txn.setAccount(account);
            txn.setCategory(emiCategory);
            txn.setType(TransactionType.EXPENSE);
            txn.setAmount(emi.getEmiAmount());
            txn.setDescription("EMI - " + emi.getLoanName());
            txn.setTxnDate(today);
            transactionRepository.save(txn);

            account.setBalance(account.getBalance().subtract(emi.getEmiAmount()));
            accountRepository.save(account);

            emi.setLastLoggedMonth(currentMonth);
            emiRepository.save(emi);
            log.info("Auto-logged EMI {} for user {}", emi.getLoanName(), emi.getUser().getId());
        }
    }
}
