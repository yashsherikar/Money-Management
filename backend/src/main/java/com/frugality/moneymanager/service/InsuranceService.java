package com.frugality.moneymanager.service;

import com.frugality.moneymanager.dto.InsuranceDtos.*;
import com.frugality.moneymanager.entity.InsurancePolicy;
import com.frugality.moneymanager.entity.User;
import com.frugality.moneymanager.repository.InsurancePolicyRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
public class InsuranceService {

    private static final long DUE_SOON_DAYS = 15;

    private final InsurancePolicyRepository insurancePolicyRepository;

    public InsuranceService(InsurancePolicyRepository insurancePolicyRepository) {
        this.insurancePolicyRepository = insurancePolicyRepository;
    }

    public List<InsuranceResponse> list(User user) {
        return insurancePolicyRepository.findByUserIdOrderByDueDateAsc(user.getId()).stream()
                .map(this::toResponse).toList();
    }

    public InsuranceResponse create(User user, InsuranceRequest request) {
        InsurancePolicy policy = new InsurancePolicy();
        policy.setUser(user);
        applyRequest(policy, request);
        return toResponse(insurancePolicyRepository.save(policy));
    }

    public InsuranceResponse update(User user, Long id, InsuranceRequest request) {
        InsurancePolicy policy = get(user, id);
        applyRequest(policy, request);
        return toResponse(insurancePolicyRepository.save(policy));
    }

    public void delete(User user, Long id) {
        insurancePolicyRepository.delete(get(user, id));
    }

    private InsurancePolicy get(User user, Long id) {
        return insurancePolicyRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "insurance policy not found"));
    }

    private void applyRequest(InsurancePolicy p, InsuranceRequest r) {
        p.setType(r.type());
        p.setPolicyName(r.policyName());
        p.setPremiumAmount(r.premiumAmount());
        p.setDueDate(r.dueDate());
        p.setFrequency(r.frequency());
    }

    private InsuranceResponse toResponse(InsurancePolicy p) {
        long daysToDue = ChronoUnit.DAYS.between(LocalDate.now(), p.getDueDate());
        boolean dueSoon = daysToDue >= 0 && daysToDue <= DUE_SOON_DAYS;
        return new InsuranceResponse(p.getId(), p.getType(), p.getPolicyName(), p.getPremiumAmount(),
                p.getDueDate(), p.getFrequency(), p.isActive(), daysToDue, dueSoon);
    }
}
