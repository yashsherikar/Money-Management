package com.frugality.moneymanager.service;

import com.frugality.moneymanager.dto.SplitBillDtos.*;
import com.frugality.moneymanager.entity.Account;
import com.frugality.moneymanager.entity.SplitBill;
import com.frugality.moneymanager.entity.SplitBillParticipant;
import com.frugality.moneymanager.entity.User;
import com.frugality.moneymanager.repository.AccountRepository;
import com.frugality.moneymanager.repository.SplitBillParticipantRepository;
import com.frugality.moneymanager.repository.SplitBillRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Service
public class SplitBillService {

    private final SplitBillRepository splitBillRepository;
    private final SplitBillParticipantRepository participantRepository;
    private final AccountRepository accountRepository;

    public SplitBillService(SplitBillRepository splitBillRepository,
                             SplitBillParticipantRepository participantRepository,
                             AccountRepository accountRepository) {
        this.splitBillRepository = splitBillRepository;
        this.participantRepository = participantRepository;
        this.accountRepository = accountRepository;
    }

    public List<SplitBillResponse> list(User user) {
        return splitBillRepository.findByUserIdOrderByBillDateDesc(user.getId()).stream()
                .map(this::toResponse).toList();
    }

    @Transactional
    public SplitBillResponse create(User user, SplitBillRequest request) {
        BigDecimal shareTotal = request.participants().stream()
                .map(ParticipantRequest::shareAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        if (shareTotal.compareTo(request.totalAmount()) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "participant shares exceed total amount");
        }

        SplitBill bill = new SplitBill();
        bill.setUser(user);
        bill.setTitle(request.title());
        bill.setTotalAmount(request.totalAmount());
        bill.setBillDate(request.billDate());
        bill.setNote(request.note());

        if (request.accountId() != null) {
            Account account = getOwnedAccount(user, request.accountId());
            bill.setAccount(account);
            account.setBalance(account.getBalance().subtract(request.totalAmount()));
            accountRepository.save(account);
        }

        for (ParticipantRequest p : request.participants()) {
            SplitBillParticipant participant = new SplitBillParticipant();
            participant.setSplitBill(bill);
            participant.setName(p.name());
            participant.setShareAmount(p.shareAmount());
            bill.getParticipants().add(participant);
        }

        return toResponse(splitBillRepository.save(bill));
    }

    @Transactional
    public SplitBillResponse markParticipantPaid(User user, Long participantId) {
        SplitBillParticipant participant = participantRepository.findByIdAndSplitBill_UserId(participantId, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "participant not found"));
        if (participant.isPaid()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "already marked paid");
        }
        participant.setPaid(true);
        participant.setPaidDate(LocalDate.now());

        SplitBill bill = participant.getSplitBill();
        if (bill.getAccount() != null) {
            Account account = bill.getAccount();
            account.setBalance(account.getBalance().add(participant.getShareAmount()));
            accountRepository.save(account);
        }
        return toResponse(bill);
    }

    @Transactional
    public void delete(User user, Long id) {
        SplitBill bill = getOwned(user, id);
        if (bill.getAccount() != null) {
            BigDecimal paidSum = bill.getParticipants().stream()
                    .filter(SplitBillParticipant::isPaid)
                    .map(SplitBillParticipant::getShareAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            Account account = bill.getAccount();
            account.setBalance(account.getBalance().add(bill.getTotalAmount()).subtract(paidSum));
            accountRepository.save(account);
        }
        splitBillRepository.delete(bill);
    }

    private Account getOwnedAccount(User user, Long accountId) {
        return accountRepository.findByIdAndUserId(accountId, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "account not found"));
    }

    private SplitBill getOwned(User user, Long id) {
        return splitBillRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "split bill not found"));
    }

    private SplitBillResponse toResponse(SplitBill bill) {
        BigDecimal shareTotal = bill.getParticipants().stream()
                .map(SplitBillParticipant::getShareAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal collected = bill.getParticipants().stream()
                .filter(SplitBillParticipant::isPaid)
                .map(SplitBillParticipant::getShareAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal pending = shareTotal.subtract(collected);
        BigDecimal yourShare = bill.getTotalAmount().subtract(shareTotal);

        List<ParticipantResponse> participants = bill.getParticipants().stream()
                .map(p -> new ParticipantResponse(p.getId(), p.getName(), p.getShareAmount(), p.isPaid(), p.getPaidDate()))
                .toList();

        return new SplitBillResponse(
                bill.getId(), bill.getTitle(), bill.getTotalAmount(),
                bill.getAccount() == null ? null : bill.getAccount().getId(),
                bill.getAccount() == null ? null : bill.getAccount().getName(),
                bill.getBillDate(), bill.getNote(),
                yourShare, collected, pending, participants
        );
    }
}
