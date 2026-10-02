package com.moneymanager.backend.service;

import com.moneymanager.backend.dto.EmiDtos.*;
import com.moneymanager.backend.entity.*;
import com.moneymanager.backend.repository.AccountRepository;
import com.moneymanager.backend.repository.CategoryRepository;
import com.moneymanager.backend.repository.EmiRepository;
import com.moneymanager.backend.repository.TransactionRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

@Service
public class EmiService {

    private final EmiRepository emiRepository;
    private final AccountRepository accountRepository;
    private final CategoryRepository categoryRepository;
    private final TransactionRepository transactionRepository;
    private final PushService pushService;

    public EmiService(EmiRepository emiRepository,
                       AccountRepository accountRepository,
                       CategoryRepository categoryRepository,
                       TransactionRepository transactionRepository,
                       PushService pushService) {
        this.emiRepository = emiRepository;
        this.accountRepository = accountRepository;
        this.categoryRepository = categoryRepository;
        this.transactionRepository = transactionRepository;
        this.pushService = pushService;
    }

    public List<EmiResponse> list(User user) {
        return emiRepository.findByUserIdOrderByStartDateDesc(user.getId()).stream().map(this::toResponse).toList();
    }

    public EmiResponse create(User user, EmiRequest request) {
        Account account = accountRepository.findByIdAndUserId(request.accountId(), user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "account not found"));
        Emi emi = new Emi();
        emi.setUser(user);
        emi.setAccount(account);
        applyRequest(emi, request);
        return toResponse(emiRepository.save(emi));
    }

    public EmiResponse update(User user, Long id, EmiRequest request) {
        Emi emi = get(user, id);
        Account account = accountRepository.findByIdAndUserId(request.accountId(), user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "account not found"));
        emi.setAccount(account);
        applyRequest(emi, request);
        return toResponse(emiRepository.save(emi));
    }

    public void delete(User user, Long id) {
        emiRepository.delete(get(user, id));
    }

    public EmiResponse setActive(User user, Long id, boolean active) {
        Emi emi = get(user, id);
        emi.setActive(active);
        return toResponse(emiRepository.save(emi));
    }

    /** User confirmed this month's EMI was paid — logs expense and updates balance. */
    @Transactional
    public EmiResponse confirmPaid(User user, Long id) {
        Emi emi = get(user, id);
        LocalDate today = LocalDate.now();
        String currentMonth = YearMonth.from(today).toString();
        if (currentMonth.equals(emi.getLastLoggedMonth())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "already confirmed for this month");
        }
        if (today.getDayOfMonth() < Math.min(emi.getDueDay(), today.lengthOfMonth())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "EMI is not due yet");
        }

        Category emiCategory = categoryRepository.findByNameAndIsDefaultTrue("EMI").orElse(null);
        Account account = emi.getAccount();

        Transaction txn = new Transaction();
        txn.setUser(user);
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
        Emi saved = emiRepository.save(emi);
        pushService.resolveRelated(PushService.RELATED_EMI, saved.getId());
        return toResponse(saved);
    }

    private Emi get(User user, Long id) {
        return emiRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "EMI not found"));
    }

    private void applyRequest(Emi emi, EmiRequest r) {
        emi.setLoanName(r.loanName());
        emi.setPrincipal(r.principal());
        emi.setInterestRate(r.interestRate());
        emi.setTenureMonths(r.tenureMonths());
        emi.setEmiAmount(r.emiAmount());
        emi.setStartDate(r.startDate());
        emi.setDueDay(r.dueDay());
    }

    private EmiResponse toResponse(Emi e) {
        return new EmiResponse(e.getId(), e.getAccount().getId(), e.getLoanName(), e.getPrincipal(),
                e.getInterestRate(), e.getTenureMonths(), e.getEmiAmount(), e.getStartDate(), e.getDueDay(), e.isActive());
    }
}
