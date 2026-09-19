package com.frugality.moneymanager.security;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class JwtServiceTest {

    private final JwtService jwtService = new JwtService(
            "test-secret-key-that-is-long-enough-for-hmac-sha256", 60_000);

    @Test
    void generatesTokenThatRoundTripsUserIdAndEmail() {
        String token = jwtService.generateToken(42L, "user@example.com");

        assertTrue(jwtService.isValid(token));
        assertEquals(42L, jwtService.extractUserId(token));
        assertEquals("user@example.com", jwtService.extractEmail(token));
    }

    @Test
    void expiredOrTamperedTokenIsInvalid() {
        JwtService expiring = new JwtService("test-secret-key-that-is-long-enough-for-hmac-sha256", -1);
        String alreadyExpired = expiring.generateToken(1L, "a@b.com");
        assertFalse(jwtService.isValid("not-a-real-token"));
        assertFalse(expiring.isValid(alreadyExpired));
    }
}
