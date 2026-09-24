package com.clinic.identity.security;

import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class JwtServiceTest {

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
