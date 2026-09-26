package com.moneymanager.backend.security;

import com.moneymanager.backend.entity.User;
import com.moneymanager.backend.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;
import java.util.Optional;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthFilter.class);

    /** Set on the request so the 401 response can say exactly why auth failed. */
    public static final String FAILURE_REASON = "authFailureReason";

    private final JwtService jwtService;
    private final UserRepository userRepository;

    public JwtAuthFilter(JwtService jwtService, UserRepository userRepository) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                     @NonNull HttpServletResponse response,
                                     @NonNull FilterChain filterChain) throws ServletException, IOException {
        String path = request.getRequestURI();
        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            if (path.startsWith("/api/") && !path.startsWith("/api/auth/")) {
                request.setAttribute(FAILURE_REASON, "no Authorization header was sent with this request");
                log.warn("{} {}: no Authorization header on request", request.getMethod(), path);
            }
        } else {
            String token = header.substring(7);
            String rejection = jwtService.rejectionReason(token);
            if (rejection != null) {
                request.setAttribute(FAILURE_REASON, "token rejected — " + rejection);
                log.warn("{} {}: token rejected — {}", request.getMethod(), path, rejection);
            } else {
                Long userId = jwtService.extractUserId(token);
                Optional<User> user = userRepository.findById(userId);
                if (user.isEmpty()) {
                    request.setAttribute(FAILURE_REASON, "token is valid but user id " + userId + " no longer exists");
                    log.warn("{} {}: token valid but userId {} not found in DB", request.getMethod(), path, userId);
                } else if (SecurityContextHolder.getContext().getAuthentication() == null) {
                    var auth = new UsernamePasswordAuthenticationToken(user.get(), null, Collections.emptyList());
                    SecurityContextHolder.getContext().setAuthentication(auth);
                }
            }
        }
        filterChain.doFilter(request, response);
    }
}
