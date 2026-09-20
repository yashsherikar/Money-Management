package com.moneymanager.backend.service;

import com.moneymanager.backend.dto.EmergencyFundDtos.*;
import com.moneymanager.backend.entity.Account;
import com.moneymanager.backend.entity.AccountType;
import com.moneymanager.backend.entity.EmergencyFundPlan;
import com.moneymanager.backend.entity.User;
import com.moneymanager.backend.repository.AccountRepository;
import com.moneymanager.backend.repository.EmergencyFundPlanRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

@Service
public class EmergencyFundService {

    private final EmergencyFundPlanRepository emergencyFundPlanRepository;
    private final AccountRepository accountRepository;

    public EmergencyFundService(EmergencyFundPlanRepository emergencyFundPlanRepository, AccountRepository accountRepository) {
        this.emergencyFundPlanRepository = emergencyFundPlanRepository;
        this.accountRepository = accountRepository;
    }

    @Transactional(readOnly = true)
    public List<EmergencyFundResponse> list(User user) {
        return emergencyFundPlanRepository.findByUserIdOrderByDayOfMonthAsc(user.getId()).stream()
                .map(this::toResponse).toList();
    }

    /** Active plans whose day has arrived this month and haven't been transferred yet. */
    @Transactional(readOnly = true)
    public List<EmergencyFundResponse> due(User user) {
        LocalDate today = LocalDate.now();
        String currentMonth = YearMonth.from(today).toString();
        return emergencyFundPlanRepository.findByUserIdOrderByDayOfMonthAsc(user.getId()).stream()
                .filter(EmergencyFundPlan::isActive)
                .filter(p -> !currentMonth.equals(p.getLastLoggedMonth()))
                .filter(p -> today.getDayOfMonth() >= Math.min(p.getDayOfMonth(), today.lengthOfMonth()))
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public EmergencyFundResponse create(User user, EmergencyFundRequest request) {
        EmergencyFundPlan plan = new EmergencyFundPlan();
        plan.setUser(user);
        applyRequest(user, plan, request);
        return toResponse(emergencyFundPlanRepository.save(plan));
    }

    @Transactional
    public EmergencyFundResponse setActive(User user, Long id, boolean active) {
        EmergencyFundPlan plan = get(user, id);
        plan.setActive(active);
        return toResponse(emergencyFundPlanRepository.save(plan));
    }

    @Transactional
    public void delete(User user, Long id) {
        emergencyFundPlanRepository.delete(get(user, id));
    }

    /** User confirmed this month's contribution actually happened: moves the money between accounts. */
    @Transactional
    public EmergencyFundResponse confirmContribution(User user, Long id) {
        EmergencyFundPlan plan = get(user, id);
        String currentMonth = YearMonth.from(LocalDate.now()).toString();
        if (currentMonth.equals(plan.getLastLoggedMonth())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "already confirmed for this month");
        }

        Account source = plan.getSourceAccount();
        Account target = plan.getTargetAccount();
        source.setBalance(source.getBalance().subtract(plan.getAmount()));
        target.setBalance(target.getBalance().add(plan.getAmount()));
        accountRepository.save(source);
        accountRepository.save(target);

        plan.setLastLoggedMonth(currentMonth);
        return toResponse(emergencyFundPlanRepository.save(plan));
    }

    private void applyRequest(User user, EmergencyFundPlan plan, EmergencyFundRequest r) {
        Account source = accountRepository.findByIdAndUserId(r.sourceAccountId(), user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "source account not found"));
        Account target = accountRepository.findByIdAndUserId(r.targetAccountId(), user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "target account not found"));
        if (target.getType() != AccountType.EMERGENCY_FUND) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "target account must be an emergency fund account");
        }
        if (source.getId().equals(target.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "source and target must be different accounts");
        }
        plan.setSourceAccount(source);
        plan.setTargetAccount(target);
        plan.setAmount(r.amount());
        plan.setDayOfMonth(r.dayOfMonth());
    }

    private EmergencyFundPlan get(User user, Long id) {
        return emergencyFundPlanRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "emergency fund plan not found"));
    }

    private EmergencyFundResponse toResponse(EmergencyFundPlan p) {
        return new EmergencyFundResponse(
                p.getId(),
                p.getSourceAccount().getId(),
                p.getSourceAccount().getName(),
                p.getTargetAccount().getId(),
                p.getTargetAccount().getName(),
                p.getAmount(),
                p.getDayOfMonth(),
                p.isActive()
        );
    }
}
