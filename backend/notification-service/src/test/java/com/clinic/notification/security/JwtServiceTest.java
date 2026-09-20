package com.clinic.notification.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class JwtServiceTest {

    private static final String SECRET = "clinic-management-local-jwt-secret-key-at-least-32-bytes";

    @Test
    void readsIdentityServiceAccessTokenContract() {
        UUID userId = UUID.randomUUID();
        String email = "admin@clinic.local";
        JwtService jwtService = new JwtService(new JwtProperties(SECRET, 60, 7));
        Instant now = Instant.now();

        String token = Jwts.builder()
                .subject(userId.toString())
                .claims(Map.of(
                        "email", email,
                        "roles", List.of("ROLE_ADMIN", "ROLE_DOCTOR")
                ))
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(60, ChronoUnit.MINUTES)))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)))
                .compact();

        assertThat(jwtService.extractUserId(token)).isEqualTo(userId);
        assertThat(jwtService.extractEmail(token)).isEqualTo(email);
        assertThat(jwtService.extractAuthorities(token))
                .extracting("authority")
                .containsExactly("ROLE_ADMIN", "ROLE_DOCTOR");
    }
}
