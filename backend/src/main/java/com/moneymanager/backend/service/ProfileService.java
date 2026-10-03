package com.moneymanager.backend.service;

import com.moneymanager.backend.dto.ProfileDtos.*;
import com.moneymanager.backend.entity.Account;
import com.moneymanager.backend.entity.User;
import com.moneymanager.backend.entity.UdharEntry;
import com.moneymanager.backend.entity.UdharType;
import com.moneymanager.backend.repository.AccountRepository;
import com.moneymanager.backend.repository.UdharEntryRepository;
import com.moneymanager.backend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

@Service
public class ProfileService {

    private static final int MAX_PIN_ATTEMPTS = 5;
    private static final Duration PIN_LOCKOUT = Duration.ofMinutes(15);
    private static final int MAX_PHOTO_LENGTH = 400_000; // ~300KB image as base64

    private final UserRepository userRepository;
    private final AccountRepository accountRepository;
    private final UdharEntryRepository udharEntryRepository;
    private final PasswordEncoder passwordEncoder;

    public ProfileService(UserRepository userRepository, AccountRepository accountRepository,
                           UdharEntryRepository udharEntryRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.accountRepository = accountRepository;
        this.udharEntryRepository = udharEntryRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public ProfileResponse get(User user) {
        return toResponse(user);
    }

    public ProfileResponse update(User user, UpdateProfileRequest request) {
        if (StringUtils.hasText(request.name())) {
            user.setName(request.name());
        }
        if (request.phone() != null) {
            String phone = normalizePhone(request.phone());
            if (phone == null) {
                user.setPhone(null);
            } else {
                userRepository.findByPhone(phone).ifPresent(other -> {
                    if (!other.getId().equals(user.getId())) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                "That phone number is already on another account");
                    }
                });
                user.setPhone(phone);
            }
        }
        if (request.upiId() != null) {
            user.setUpiId(StringUtils.hasText(request.upiId()) ? request.upiId().trim() : null);
        }
        userRepository.save(user);
        return toResponse(user);
    }

    /** Keep last 10 digits for Indian mobiles; null if empty/invalid. */
    public static String normalizePhone(String raw) {
        if (!StringUtils.hasText(raw)) return null;
        String digits = raw.replaceAll("\\D", "");
        if (digits.length() >= 10) {
            digits = digits.substring(digits.length() - 10);
        }
        if (digits.length() < 10) return null;
        return digits;
    }

    public ProfileResponse changePassword(User user, ChangePasswordRequest request) {
        if (!passwordEncoder.matches(request.currentPassword(), user.getPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "current password is incorrect");
        }
        user.setPassword(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);
        return toResponse(user);
    }

    /** Setting/changing the secret PIN requires the login password — ties it to the stronger credential. */
    public ProfileResponse setPin(User user, SetPinRequest request) {
        if (!passwordEncoder.matches(request.currentPassword(), user.getPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "current password is incorrect");
        }
        user.setPinHash(passwordEncoder.encode(request.pin()));
        user.setPinFailedAttempts(0);
        user.setPinLockedUntil(null);
        userRepository.save(user);
        return toResponse(user);
    }

    public ProfileResponse updatePhoto(User user, PhotoRequest request) {
        if (request.photo().length() > MAX_PHOTO_LENGTH) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "photo is too large");
        }
        user.setPhoto(request.photo());
        userRepository.save(user);
        return toResponse(user);
    }

    public ProfileResponse removePhoto(User user) {
        user.setPhoto(null);
        userRepository.save(user);
        return toResponse(user);
    }

    /**
     * The actual security boundary: the real total is computed and returned only after the PIN
     * check passes here, server-side — masking it in the UI alone would do nothing, since the
     * frontend would still have received the real number to hide.
     */
    @Transactional
    public TotalBalanceResponse revealBalance(User user, RevealBalanceRequest request) {
        verifySecretPin(user, request.pin());

        List<Account> accounts = accountRepository.findByUserIdOrderByCreatedAtAsc(user.getId());
        BigDecimal cashOnHand = accounts.stream()
                .map(Account::getBalance)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        List<AccountBalance> byAccount = accounts.stream()
                .map(a -> new AccountBalance(a.getId(), a.getName(), a.getType(), a.getBalance()))
                .toList();

        BigDecimal udharOwed = udharEntryRepository.findByUserIdOrderByTxnDateDesc(user.getId()).stream()
                .filter(e -> !e.isSettled() && e.getType() == UdharType.BORROWED)
                .map(UdharEntry::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal lockedMinimumBalance = accounts.stream()
                .map(Account::getMinimumBalance)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal total = cashOnHand.subtract(udharOwed).subtract(lockedMinimumBalance);
        return new TotalBalanceResponse(total, cashOnHand, udharOwed, lockedMinimumBalance, byAccount);
    }

    /** Shared by revealing the total balance and editing an account's balance — same PIN, same
     *  rate limit, so a brute-force attempt against one counts against the other too. */
    @Transactional
    public void verifySecretPin(User user, String pin) {
        if (user.getPinHash() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "set a secret PIN first");
        }
        if (user.getPinLockedUntil() != null && user.getPinLockedUntil().isAfter(Instant.now())) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "too many wrong attempts — try again later");
        }
        if (!StringUtils.hasText(pin) || !passwordEncoder.matches(pin, user.getPinHash())) {
            registerFailedAttempt(user);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "incorrect PIN");
        }
        user.setPinFailedAttempts(0);
        user.setPinLockedUntil(null);
        userRepository.save(user);
    }

    private void registerFailedAttempt(User user) {
        int attempts = user.getPinFailedAttempts() + 1;
        if (attempts >= MAX_PIN_ATTEMPTS) {
            user.setPinLockedUntil(Instant.now().plus(PIN_LOCKOUT));
            user.setPinFailedAttempts(0);
        } else {
            user.setPinFailedAttempts(attempts);
        }
        userRepository.save(user);
    }

    private ProfileResponse toResponse(User u) {
        return new ProfileResponse(
                u.getId(),
                u.getEmail(),
                u.getName(),
                u.getPhone(),
                u.getUpiId(),
                u.getPhoto(),
                u.getPinHash() != null
        );
    }
}
