package com.frugality.moneymanager.service;

import com.frugality.moneymanager.dto.EmiDtos.*;
import com.frugality.moneymanager.entity.Account;
import com.frugality.moneymanager.entity.Emi;
import com.frugality.moneymanager.entity.User;
import com.frugality.moneymanager.repository.AccountRepository;
import com.frugality.moneymanager.repository.EmiRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class EmiService {

    private final EmiRepository emiRepository;
    private final AccountRepository accountRepository;

    public EmiService(EmiRepository emiRepository, AccountRepository accountRepository) {
        this.emiRepository = emiRepository;
        this.accountRepository = accountRepository;
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
