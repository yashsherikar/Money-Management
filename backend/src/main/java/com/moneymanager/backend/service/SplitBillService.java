package com.moneymanager.backend.service;

import com.moneymanager.backend.dto.SplitBillDtos.*;
import com.moneymanager.backend.entity.Account;
import com.moneymanager.backend.entity.SplitBill;
import com.moneymanager.backend.entity.SplitBillParticipant;
import com.moneymanager.backend.entity.User;
import com.moneymanager.backend.repository.AccountRepository;
import com.moneymanager.backend.repository.SplitBillParticipantRepository;
import com.moneymanager.backend.repository.SplitBillRepository;
import com.moneymanager.backend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;

@Service
public class SplitBillService {

    private final SplitBillRepository splitBillRepository;
    private final SplitBillParticipantRepository participantRepository;
    private final AccountRepository accountRepository;
    private final UserRepository userRepository;
    private final PushService pushService;

    public SplitBillService(SplitBillRepository splitBillRepository,
                             SplitBillParticipantRepository participantRepository,
                             AccountRepository accountRepository,
                             UserRepository userRepository,
                             PushService pushService) {
        this.splitBillRepository = splitBillRepository;
        this.participantRepository = participantRepository;
        this.accountRepository = accountRepository;
        this.userRepository = userRepository;
        this.pushService = pushService;
    }

    @Transactional(readOnly = true)
    public List<SplitBillResponse> list(User user) {
        return splitBillRepository.findByUserIdOrderByBillDateDesc(user.getId()).stream()
                .map(this::toResponse).toList();
    }

    /** Split bills where the current user is a linked participant — what they owe, and to whom. */
    @Transactional(readOnly = true)
    public List<OwedSplitBillResponse> owedByMe(User user) {
        return participantRepository.findByUserIdOrderByIdDesc(user.getId()).stream()
                .map(p -> {
                    SplitBill bill = p.getSplitBill();
                    User payer = bill.getUser();
                    String upiLink = null;
                    if (StringUtils.hasText(payer.getUpiId())) {
                        upiLink = "upi://pay?pa=" + encode(payer.getUpiId())
                                + "&pn=" + encode(payer.getName())
                                + "&am=" + p.getShareAmount().toPlainString()
                                + "&cu=INR"
                                + "&tn=" + encode(bill.getTitle());
                    }
                    return new OwedSplitBillResponse(p.getId(), bill.getId(), bill.getTitle(),
                            p.getShareAmount(), p.isPaid(), payer.getName(), upiLink);
                })
                .toList();
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
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
            if (StringUtils.hasText(p.email())) {
                userRepository.findByIgnoreCaseEmail(p.email().trim()).ifPresent(participant::setUser);
            }
            bill.getParticipants().add(participant);
        }

        SplitBillResponse response = toResponse(splitBillRepository.save(bill));
        for (SplitBillParticipant participant : bill.getParticipants()) {
            if (participant.getUser() != null) {
                pushService.notifyUser(participant.getUser(), "Split bill",
                        user.getName() + " added you to \"" + bill.getTitle() + "\" — you owe ₹" + participant.getShareAmount(), "/split-bills");
            }
        }
        return response;
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
                .map(p -> new ParticipantResponse(p.getId(), p.getName(), p.getShareAmount(), p.isPaid(), p.getPaidDate(), p.getUser() != null))
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
