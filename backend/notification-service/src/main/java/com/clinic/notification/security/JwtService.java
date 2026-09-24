package com.clinic.notification.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Service;

/** Reads the identity-service access-token contract: UUID subject, email claim and ROLE_* authorities. */
@Service
public class JwtService {
    private final SecretKey key;

    public JwtService(JwtProperties properties) {
        this.key = Keys.hmacShaKeyFor(properties.secret().getBytes(StandardCharsets.UTF_8));
    }

    private Claims claims(String token) {
        return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
    }

    public String extractEmail(String token) {
        return claims(token).get("email", String.class);
    }

    public UUID extractUserId(String token) {
        return UUID.fromString(claims(token).getSubject());
    }

    public Collection<? extends GrantedAuthority> extractAuthorities(String token) {
        Object roles = claims(token).get("roles");
        if (!(roles instanceof List<?> roleList) || roleList.stream().anyMatch(role -> !(role instanceof String))) {
            throw new IllegalArgumentException("Invalid roles claim");
        }
        return roleList.stream().map(role -> new SimpleGrantedAuthority((String) role)).toList();
    }

    public boolean isAccessTokenValid(String token) {
        try {
            Claims claims = claims(token);
            UUID.fromString(claims.getSubject());
            Object roles = claims.get("roles");
            return claims.getExpiration().after(new Date())
                    && "access".equals(claims.get("token_type", String.class))
                    && claims.get("email", String.class) != null
                    && roles instanceof List<?> roleList && !roleList.isEmpty()
                    && roleList.stream().allMatch(role -> role instanceof String name
                    && name.matches("ROLE_(ADMIN|RECEPTIONIST|DOCTOR|PATIENT)"));
        } catch (Exception ex) {
            return false;
        }
    }
}
