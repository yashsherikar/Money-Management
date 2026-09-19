package com.moneymanager.backend.service;

import com.moneymanager.backend.dto.InvestmentDtos.*;
import com.moneymanager.backend.entity.Investment;
import com.moneymanager.backend.entity.InvestmentTransaction;
import com.moneymanager.backend.entity.InvestmentTxnType;
import com.moneymanager.backend.entity.User;
import com.moneymanager.backend.repository.InvestmentRepository;
import com.moneymanager.backend.repository.InvestmentTransactionRepository;
import com.moneymanager.backend.util.XirrCalculator;
import com.moneymanager.backend.util.XirrCalculator.CashFlow;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
public class InvestmentService {

    private final InvestmentRepository investmentRepository;
    private final InvestmentTransactionRepository txnRepository;

    public InvestmentService(InvestmentRepository investmentRepository, InvestmentTransactionRepository txnRepository) {
        this.investmentRepository = investmentRepository;
        this.txnRepository = txnRepository;
    }

    public List<InvestmentResponse> list(User user) {
        return investmentRepository.findByUserIdOrderByCreatedAtDesc(user.getId()).stream()
                .map(this::toResponse).toList();
    }

    public PortfolioSummary summary(User user) {
        List<Investment> investments = investmentRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
        BigDecimal totalCurrent = BigDecimal.ZERO;
        BigDecimal totalInvested = BigDecimal.ZERO;
        BigDecimal totalRedeemed = BigDecimal.ZERO;
        List<CashFlow> allFlows = new ArrayList<>();

        for (Investment inv : investments) {
            totalCurrent = totalCurrent.add(inv.getCurrentValue());
            Totals t = accumulate(txnRepository.findByInvestmentIdOrderByTxnDateAsc(inv.getId()), allFlows);
            totalInvested = totalInvested.add(t.invested());
            totalRedeemed = totalRedeemed.add(t.redeemed());
        }
        if (totalCurrent.compareTo(BigDecimal.ZERO) != 0) {
            allFlows.add(new CashFlow(LocalDate.now(), totalCurrent.doubleValue()));
        }

        Double xirr = XirrCalculator.xirr(allFlows);
        BigDecimal gain = totalCurrent.add(totalRedeemed).subtract(totalInvested);
        return new PortfolioSummary(totalCurrent, totalInvested, totalRedeemed, gain,
                xirr == null ? null : xirr * 100);
    }

    @Transactional
    public InvestmentResponse create(User user, InvestmentRequest request) {
        Investment inv = new Investment();
        inv.setUser(user);
        inv.setName(request.name());
        inv.setType(request.type());
        inv.setNote(request.note());
        inv.setCurrentValue(BigDecimal.ZERO);
        return toResponse(investmentRepository.save(inv));
    }

    @Transactional
    public InvestmentResponse updateCurrentValue(User user, Long id, CurrentValueRequest request) {
        Investment inv = get(user, id);
        inv.setCurrentValue(request.currentValue());
        return toResponse(investmentRepository.save(inv));
    }

    @Transactional
    public InvestmentResponse addTransaction(User user, Long investmentId, InvestmentTxnRequest request) {
        Investment inv = get(user, investmentId);
        InvestmentTransaction txn = new InvestmentTransaction();
        txn.setInvestment(inv);
        txn.setTxnDate(request.txnDate());
        txn.setType(request.type());
        txn.setAmount(request.amount());
        txnRepository.save(txn);
        return toResponse(inv);
    }

    @Transactional
    public void deleteTransaction(User user, Long txnId) {
        InvestmentTransaction txn = txnRepository.findByIdAndInvestment_UserId(txnId, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "transaction not found"));
        txnRepository.delete(txn);
    }

    @Transactional
    public void delete(User user, Long id) {
        investmentRepository.delete(get(user, id));
    }

    private Investment get(User user, Long id) {
        return investmentRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "investment not found"));
    }

    private record Totals(BigDecimal invested, BigDecimal redeemed) {}

    /** Sums invested/redeemed and appends each transaction as a signed cash flow into `flows`. */
    private Totals accumulate(List<InvestmentTransaction> txns, List<CashFlow> flows) {
        BigDecimal invested = BigDecimal.ZERO;
        BigDecimal redeemed = BigDecimal.ZERO;
        for (InvestmentTransaction t : txns) {
            boolean isBuy = t.getType() == InvestmentTxnType.BUY;
            double signed = isBuy ? -t.getAmount().doubleValue() : t.getAmount().doubleValue();
            flows.add(new CashFlow(t.getTxnDate(), signed));
            invested = isBuy ? invested.add(t.getAmount()) : invested;
            redeemed = isBuy ? redeemed : redeemed.add(t.getAmount());
        }
        return new Totals(invested, redeemed);
    }

    private InvestmentResponse toResponse(Investment inv) {
        List<InvestmentTransaction> txns = txnRepository.findByInvestmentIdOrderByTxnDateAsc(inv.getId());
        List<CashFlow> flows = new ArrayList<>();
        Totals totals = accumulate(txns, flows);
        if (inv.getCurrentValue().compareTo(BigDecimal.ZERO) != 0) {
            flows.add(new CashFlow(LocalDate.now(), inv.getCurrentValue().doubleValue()));
        }
        Double xirr = XirrCalculator.xirr(flows);
        BigDecimal gain = inv.getCurrentValue().add(totals.redeemed()).subtract(totals.invested());

        List<InvestmentTxnResponse> txnResponses = txns.stream()
                .map(t -> new InvestmentTxnResponse(t.getId(), t.getTxnDate(), t.getType(), t.getAmount()))
                .toList();

        return new InvestmentResponse(
                inv.getId(), inv.getName(), inv.getType(), inv.getNote(), inv.getCurrentValue(),
                totals.invested(), totals.redeemed(), gain,
                xirr == null ? null : xirr * 100,
                txnResponses
        );
    }
}
