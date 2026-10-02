package com.clinic.v2.iam.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class SecurityTokenTest {
    private static final String USER_SECRET="synthetic-user-jwt-secret-more-than-32-bytes";
    private static final String WORKLOAD_SECRET="synthetic-workload-secret-more-than-32-bytes";

    @Test
    void accessTokenCarriesIssuedAtAndRejectsRefresh() {
        TokenVerifier verifier=new TokenVerifier(USER_SECRET);
        Instant now=Instant.now();
        String access=Jwts.builder()
            .subject(UUID.randomUUID().toString())
            .claim("roles", List.of("ROLE_ADMIN"))
            .claim("token_type","access")
            .issuedAt(Date.from(now.minusSeconds(5)))
            .expiration(Date.from(now.plusSeconds(60)))
            .signWith(Keys.hmacShaKeyFor(USER_SECRET.getBytes(StandardCharsets.UTF_8)))
            .compact();
        Actor actor=verifier.verify("Bearer "+access);
        assertNotNull(actor);
        assertNotNull(actor.issuedAt());

        String refresh=Jwts.builder()
            .subject(UUID.randomUUID().toString())
            .claim("roles", List.of("ROLE_ADMIN"))
            .claim("token_type","refresh")
            .issuedAt(Date.from(now.minusSeconds(5)))
            .expiration(Date.from(now.plusSeconds(60)))
            .signWith(Keys.hmacShaKeyFor(USER_SECRET.getBytes(StandardCharsets.UTF_8)))
            .compact();
        assertNull(verifier.verify("Bearer "+refresh));
    }

    @Test
    void workloadTokenChecksIssuerAudienceScopeAndExpiry() {
        WorkloadTokens tokens=new WorkloadTokens(WORKLOAD_SECRET,WORKLOAD_SECRET,"identity-v2-service","clinic-v2-service");
        String bearer="Bearer "+tokens.mint("clinic-v2-service","identity-v2-service","iam.authorize","iam.contexts.read");
        WorkloadPrincipal principal=tokens.verify(bearer);
        assertNotNull(principal);
        assertEquals("clinic-v2-service",principal.issuer());
        assertTrue(principal.hasScope("iam.authorize"));
        assertTrue(principal.hasScope("iam.contexts.read"));

        WorkloadTokens wrongAudience=new WorkloadTokens(WORKLOAD_SECRET,WORKLOAD_SECRET,"different-service","clinic-v2-service");
        assertNull(wrongAudience.verify(bearer));
        WorkloadTokens reception=new WorkloadTokens(WORKLOAD_SECRET,WORKLOAD_SECRET,"identity-v2-service","encounter-v2-service,patient-v2-service");
        assertNotNull(reception.verify("Bearer "+reception.mint("encounter-v2-service","identity-v2-service","iam.authorize")));
        assertNull(reception.verify("Bearer "+reception.mint("encounter-v2-service","identity-v2-service","iam.owner.provision")));
    }

    @Test
    void shortSecretsFailFast() {
        assertThrows(IllegalArgumentException.class,()->new TokenVerifier("short"));
        assertThrows(IllegalArgumentException.class,()->new WorkloadTokens("short",WORKLOAD_SECRET,"identity-v2-service","clinic-v2-service"));
        assertThrows(IllegalArgumentException.class,()->new WorkloadTokens(WORKLOAD_SECRET,"short","identity-v2-service","clinic-v2-service"));
    }
}
