package com.moneymanager.backend.service;

import com.moneymanager.backend.dto.AuthDtos.*;
import com.moneymanager.backend.entity.User;
import com.moneymanager.backend.entity.UserSession;
import com.moneymanager.backend.repository.UserRepository;
import com.moneymanager.backend.repository.UserSessionRepository;
import com.moneymanager.backend.security.JwtService;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class AuthService {

    private static final int MAX_ACTIVE_SESSIONS = 3;

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final UserSessionRepository sessionRepository;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService,
                        UserSessionRepository sessionRepository) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.sessionRepository = sessionRepository;
    }

    public AuthResponse signup(SignupRequest request) {
        if (userRepository.existsByIgnoreCaseEmail(request.email())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "email already registered");
        }
        User user = new User();
        user.setEmail(request.email().toLowerCase());
        user.setPassword(passwordEncoder.encode(request.password()));
        user.setName(request.name());
        user = userRepository.save(user);
        return toResponse(user);
    }

    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByIgnoreCaseEmail(request.email())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "no account with this email — please sign up"));
        if (!passwordEncoder.matches(request.password(), user.getPassword())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid credentials");
        }
        return toResponse(user);
    }

    @Transactional
    public void logout(String jti) {
        sessionRepository.deleteByJti(jti);
    }

    private AuthResponse toResponse(User user) {
        String token = jwtService.generateToken(user.getId(), user.getEmail());
        sessionRepository.save(new UserSession(user, jwtService.extractJti(token)));

        List<UserSession> sessions = sessionRepository.findByUserIdOrderByCreatedAtAsc(user.getId());
        int excess = sessions.size() - MAX_ACTIVE_SESSIONS;
        if (excess > 0) {
            sessionRepository.deleteAll(sessions.subList(0, excess));
        }

        return new AuthResponse(token, user.getId(), user.getEmail(), user.getName());
    }
}
