package com.clinic.iam.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;

@Component
public class WorkloadTokens {
    private final SecretKey inboundKey;
    private final SecretKey clinicOutboundKey;
    private final String audience;
    private final Set<String> allowedIssuers;

    public WorkloadTokens(@Value("${iam.security.workload-inbound-secret}") String inboundSecret,
                          @Value("${iam.clinic.workload-outbound-secret}") String outboundSecret,
                          @Value("${iam.security.workload-audience}") String audience,
                          @Value("${iam.security.allowed-workload-issuers}") String issuers) {
        this.inboundKey = key(inboundSecret, "IAM workload inbound");
        this.clinicOutboundKey = key(outboundSecret, "IAM→Clinic workload outbound");
        this.audience = audience;
        Set<String> parsed = new HashSet<>();
        for (String value : issuers.split(",")) {
            if (!value.isBlank()) parsed.add(value.trim());
        }
        if (parsed.isEmpty()) throw new IllegalArgumentException("At least one workload issuer is required");
        this.allowedIssuers = Set.copyOf(parsed);
    }

    private SecretKey key(String secret, String name) {
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalArgumentException(name + " secret must be at least 32 bytes");
        }
        return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    /** Mint only the IAM→Clinic token used by ClinicDirectoryClient. */
    public String mint(String issuer, String targetAudience, String... scopes) {
        Instant now = Instant.now();
        return Jwts.builder()
            .issuer(issuer)
            .subject(issuer)
            .audience().add(targetAudience).and()
            .id(UUID.randomUUID().toString())
            .claim("token_type", "workload")
            .claim("scopes", List.of(scopes))
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plusSeconds(30)))
            .signWith(clinicOutboundKey)
            .compact();
    }

    /** Verify Clinic→IAM workload tokens. */
    public WorkloadPrincipal verify(String bearer) {
        if (bearer == null || !bearer.startsWith("Bearer ")) return null;
        try {
            Claims c = Jwts.parser()
                .verifyWith(inboundKey)
                .requireAudience(audience)
                .build()
                .parseSignedClaims(bearer.substring(7))
                .getPayload();
            Instant now = Instant.now();
            if (!"workload".equals(c.get("token_type", String.class))
                || c.getIssuer() == null
                || !c.getIssuer().equals(c.getSubject())
                || !allowedIssuers.contains(c.getIssuer())
                || c.getIssuedAt() == null
                || c.getIssuedAt().toInstant().isAfter(now.plusSeconds(5))
                || c.getIssuedAt().toInstant().isBefore(now.minusSeconds(120))
                || c.getExpiration() == null
                || !c.getExpiration().toInstant().isAfter(now)
                || c.getId() == null) {
                return null;
            }
            Object raw = c.get("scopes");
            if (!(raw instanceof Collection<?> values)
                || values.isEmpty()
                || values.stream().anyMatch(v -> !(v instanceof String s) || s.isBlank())) {
                return null;
            }
            Set<String> scopes = new HashSet<>();
            values.forEach(v -> scopes.add((String) v));
            Set<String> permitted="clinic-service".equals(c.getIssuer())
                ?Set.of("iam.authorize","iam.contexts.read","iam.owner.provision"):Set.of("iam.authorize");
            if(!permitted.containsAll(scopes))return null;
            return new WorkloadPrincipal(c.getIssuer(), Set.copyOf(scopes));
        } catch (RuntimeException ex) {
            return null;
        }
    }
}
