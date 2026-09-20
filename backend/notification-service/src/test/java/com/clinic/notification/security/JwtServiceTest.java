package com.clinic.notification.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtServiceTest {
    private static final String SECRET = "0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF";
    private final JwtService service = new JwtService(new JwtProperties(SECRET, 60, 7));

    @Test
    void acceptsIdentityServiceJwtContract() {
        UUID userId = UUID.randomUUID();
        String token = Jwts.builder().subject(userId.toString())
                .claim("email", "user@example.com")
                .claim("roles", List.of("ROLE_PATIENT", "ROLE_DOCTOR"))
                .claim("token_type", "access")
                .expiration(Date.from(Instant.now().plusSeconds(600)))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8))).compact();
        assertThat(service.extractUserId(token)).isEqualTo(userId);
        assertThat(service.extractEmail(token)).isEqualTo("user@example.com");
        assertThat(service.extractAuthorities(token)).extracting("authority")
                .containsExactly("ROLE_PATIENT", "ROLE_DOCTOR");
        assertThat(service.isAccessTokenValid(token)).isTrue();
    }

    @Test
    void expiredTokenIsRejected() {
        String token = Jwts.builder().subject(UUID.randomUUID().toString())
                .claim("email", "user@example.com").claim("roles", List.of("ROLE_PATIENT"))
                .claim("token_type", "access")
                .expiration(Date.from(Instant.now().minusSeconds(60)))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8))).compact();
        assertThatThrownBy(() -> service.extractUserId(token)).isInstanceOf(RuntimeException.class);
    }

    @Test
    void refreshTokenCannotAuthenticateAsAccessToken() {
        String token = Jwts.builder().subject(UUID.randomUUID().toString())
                .claim("email", "user@example.com").claim("roles", List.of("ROLE_PATIENT"))
                .claim("token_type", "refresh")
                .expiration(Date.from(Instant.now().plusSeconds(600)))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8))).compact();
        assertThat(service.isAccessTokenValid(token)).isFalse();
    }
}
