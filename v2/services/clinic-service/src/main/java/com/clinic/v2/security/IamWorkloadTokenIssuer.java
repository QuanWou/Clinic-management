package com.clinic.v2.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;

@Component
public class IamWorkloadTokenIssuer {
    private final SecretKey key;

    public IamWorkloadTokenIssuer(@Value("${clinic.security.iam-service-secret}") String secret) {
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalArgumentException("Clinic→IAM workload secret must be at least 32 bytes");
        }
        key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public String issue(String... scopes) {
        Instant now = Instant.now();
        return Jwts.builder()
            .issuer("clinic-v2-service")
            .subject("clinic-v2-service")
            .audience().add("identity-v2-service").and()
            .id(UUID.randomUUID().toString())
            .claim("token_type", "workload")
            .claim("scopes", List.of(scopes))
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plusSeconds(30)))
            .signWith(key)
            .compact();
    }
}
