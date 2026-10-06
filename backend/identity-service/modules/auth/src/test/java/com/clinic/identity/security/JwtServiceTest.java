package com.clinic.identity.security;

import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class JwtServiceTest {

    @Test
    void accessTokenPreservesSignedIssuancePrecision() {
        var before=java.time.Instant.now();
        var claims=jwtService.extractAllClaims(jwtService.generateAccessToken(UUID.randomUUID(),"qa@example.invalid",java.util.List.of("ROLE_PATIENT")));
        var issued=java.time.Instant.parse(claims.get("auth_issued_at",String.class));
        assertThat(issued).isBetween(before,java.time.Instant.now());
        assertThat(issued.truncatedTo(java.time.temporal.ChronoUnit.SECONDS)).isEqualTo(claims.getIssuedAt().toInstant());
    }

    private final JwtService jwtService = new JwtService(new JwtProperties(
            "0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF",
            30,
            7
    ));

    @Test
    void generateRefreshTokenCreatesUniqueTokensForSameUser() {
        UUID userId = UUID.randomUUID();

        String firstToken = jwtService.generateRefreshToken(userId);
        String secondToken = jwtService.generateRefreshToken(userId);

        assertThat(secondToken).isNotEqualTo(firstToken);
        assertThat(jwtService.extractAllClaims(firstToken).getId()).isNotBlank();
        assertThat(jwtService.extractAllClaims(secondToken).getId()).isNotBlank();
        assertThat(jwtService.extractUserId(firstToken)).isEqualTo(userId);
        assertThat(jwtService.extractUserId(secondToken)).isEqualTo(userId);
    }
}
