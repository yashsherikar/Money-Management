package com.moneymanager.backend.service;

import com.moneymanager.backend.dto.FixedDepositDtos.*;
import com.moneymanager.backend.entity.FixedDeposit;
import com.moneymanager.backend.entity.User;
import com.moneymanager.backend.repository.FixedDepositRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
public class FixedDepositService {

    private static final long MATURING_SOON_DAYS = 30;

    private final FixedDepositRepository fixedDepositRepository;

    public FixedDepositService(FixedDepositRepository fixedDepositRepository) {
        this.fixedDepositRepository = fixedDepositRepository;
    }

    public List<FdResponse> list(User user) {
        return fixedDepositRepository.findByUserIdOrderByMaturityDateAsc(user.getId()).stream()
                .map(this::toResponse).toList();
    }

    public FdResponse create(User user, FdRequest request) {
        FixedDeposit fd = new FixedDeposit();
        fd.setUser(user);
        applyRequest(fd, request);
        return toResponse(fixedDepositRepository.save(fd));
    }

    public FdResponse update(User user, Long id, FdRequest request) {
        FixedDeposit fd = get(user, id);
        applyRequest(fd, request);
        return toResponse(fixedDepositRepository.save(fd));
    }

    public void delete(User user, Long id) {
        fixedDepositRepository.delete(get(user, id));
    }

    private FixedDeposit get(User user, Long id) {
        return fixedDepositRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "fixed deposit not found"));
    }

    private void applyRequest(FixedDeposit fd, FdRequest r) {
        fd.setBankName(r.bankName());
        fd.setPrincipal(r.principal());
        fd.setInterestRate(r.interestRate());
        fd.setStartDate(r.startDate());
        fd.setMaturityDate(r.maturityDate());
        fd.setMaturityAmount(r.maturityAmount());
    }

    private FdResponse toResponse(FixedDeposit fd) {
        long daysToMaturity = ChronoUnit.DAYS.between(LocalDate.now(), fd.getMaturityDate());
        boolean maturingSoon = daysToMaturity >= 0 && daysToMaturity <= MATURING_SOON_DAYS;
        return new FdResponse(fd.getId(), fd.getBankName(), fd.getPrincipal(), fd.getInterestRate(),
                fd.getStartDate(), fd.getMaturityDate(), fd.getMaturityAmount(), daysToMaturity, maturingSoon);
    }
}
