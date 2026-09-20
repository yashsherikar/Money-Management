package com.moneymanager.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Simple in-memory fixed-window limiter, per client IP. Stricter on /api/auth/** to blunt
 * credential stuffing/brute force on login and signup; looser everywhere else under /api/**.
 * ponytail: buckets map grows one entry per distinct IP forever (never evicted) — fine at this
 * app's traffic, add a periodic sweep if that ever changes.
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final int AUTH_LIMIT_PER_MINUTE = 15;
    private static final int GENERAL_LIMIT_PER_MINUTE = 120;

    private record Window(long minute, AtomicInteger count) {}

    private final ConcurrentHashMap<String, Window> buckets = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String path = request.getRequestURI();
        if (!path.startsWith("/api/")) {
            filterChain.doFilter(request, response);
            return;
        }

        boolean isAuth = path.startsWith("/api/auth/");
        int limit = isAuth ? AUTH_LIMIT_PER_MINUTE : GENERAL_LIMIT_PER_MINUTE;
        String key = (isAuth ? "auth:" : "api:") + clientIp(request);
        long currentMinute = System.currentTimeMillis() / 60_000;

        Window window = buckets.compute(key, (k, existing) -> {
            if (existing == null || existing.minute() != currentMinute) {
                return new Window(currentMinute, new AtomicInteger(1));
            }
            existing.count().incrementAndGet();
            return existing;
        });

        if (window.count().get() > limit) {
            response.setStatus(429);
            response.setContentType("application/json");
            response.getWriter().write("{\"message\":\"too many requests — slow down and try again in a minute\"}");
            return;
        }

        filterChain.doFilter(request, response);
    }

    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
