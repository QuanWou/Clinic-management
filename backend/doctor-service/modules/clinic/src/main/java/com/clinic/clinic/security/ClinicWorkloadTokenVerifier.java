package com.clinic.clinic.security;

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
public class ClinicWorkloadTokenVerifier {
    private Map<String, SecretKey> keys;
    @Value("${clinic.security.encounter-service-secret:}")
    public void encounterSecret(String secret){var map=new HashMap<>(keys);add(map,"encounter-service",secret,false);keys=Map.copyOf(map);}
    @Value("${clinic.security.patient-service-secret:}")
    public void patientSecret(String secret){var map=new HashMap<>(keys);add(map,"patient-service",secret,false);keys=Map.copyOf(map);}

    public ClinicWorkloadTokenVerifier(
            @Value("${clinic.security.iam-directory-secret}") String iamSecret,
            @Value("${clinic.security.doctor-service-secret:}") String doctorSecret,
            @Value("${clinic.security.catalog-service-secret:}") String catalogSecret,
            @Value("${clinic.security.appointment-service-secret:}") String appointmentSecret) {
        Map<String, SecretKey> map = new HashMap<>();
        add(map, "identity-service", iamSecret, true);
        add(map, "doctor-service", doctorSecret, false);
        add(map, "catalog-service", catalogSecret, false);
        add(map, "appointment-service", appointmentSecret, false);
        keys = Map.copyOf(map);
    }

    private void add(Map<String, SecretKey> map, String issuer, String secret, boolean required) {
        if (secret == null || secret.isBlank()) {
            if (required) throw new IllegalArgumentException(issuer + " workload secret is required");
            return;
        }
        if (secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalArgumentException(issuer + " workload secret must be at least 32 bytes");
        }
        map.put(issuer, Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8)));
    }

    public Workload verify(String bearer, String requiredScope, String expectedIssuer) {
        return verifyAny(bearer, requiredScope, expectedIssuer);
    }

    public Workload verifyAny(String bearer, String requiredScope, String... allowedIssuers) {
        if (bearer == null || !bearer.startsWith("Bearer ")) return null;
        for (String expectedIssuer : allowedIssuers) {
            SecretKey key = keys.get(expectedIssuer);
            if (key == null) continue;
            try {
                Claims c = Jwts.parser().verifyWith(key).requireAudience("clinic-service")
                    .build().parseSignedClaims(bearer.substring(7)).getPayload();
                Instant now = Instant.now();
                if (!expectedIssuer.equals(c.getIssuer())
                    || !expectedIssuer.equals(c.getSubject())
                    || !"workload".equals(c.get("token_type", String.class))
                    || c.getExpiration() == null
                    || !c.getExpiration().toInstant().isAfter(now)
                    || c.getIssuedAt() == null
                    || c.getIssuedAt().toInstant().isAfter(now.plusSeconds(5))
                    || c.getIssuedAt().toInstant().isBefore(now.minusSeconds(120))
                    || c.getId() == null) {
                    continue;
                }
                Object raw = c.get("scopes");
                if (!(raw instanceof Collection<?> scopes)
                    || scopes.stream().noneMatch(requiredScope::equals)) {
                    continue;
                }
                return new Workload(expectedIssuer);
            } catch (RuntimeException ignored) {
                // Try the next configured issuer/key. No permissive fallback.
            }
        }
        return null;
    }

    public record Workload(String issuer) {}
}
