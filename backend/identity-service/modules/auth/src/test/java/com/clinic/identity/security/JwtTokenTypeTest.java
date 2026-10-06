package com.clinic.identity.security;

import org.junit.jupiter.api.Test;

import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JwtTokenTypeTest {
    private final JwtService jwt = new JwtService(new JwtProperties(
            "0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF", 30, 7));

    @Test
    void accessAndRefreshTokensHaveDistinctPurposesAndValidSubjects() {
        UUID user = UUID.randomUUID();
        String access = jwt.generateAccessToken(user, "doctor@example.test", Set.of("ROLE_DOCTOR"));
        String refresh = jwt.generateRefreshToken(user);

        assertEquals(user, jwt.extractUserId(access));
        assertEquals(user, jwt.extractUserId(refresh));
        assertEquals("access", jwt.extractAllClaims(access).get("token_type"));
        assertEquals("refresh", jwt.extractAllClaims(refresh).get("token_type"));
        assertTrue(jwt.isAccessTokenValid(access));
        assertFalse(jwt.isRefreshTokenValid(access));
        assertTrue(jwt.isRefreshTokenValid(refresh));
        assertFalse(jwt.isAccessTokenValid(refresh));
        assertTrue(jwt.extractAllClaims(access).get("roles", java.util.List.class).contains("ROLE_DOCTOR"));
    }

    @Test
    void invalidTokenIsNotAcceptedForEitherPurpose() {
        assertFalse(jwt.isAccessTokenValid("not-a-jwt"));
        assertFalse(jwt.isRefreshTokenValid("not-a-jwt"));
    }
}
