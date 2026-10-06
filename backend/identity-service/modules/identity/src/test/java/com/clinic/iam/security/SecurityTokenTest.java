package com.clinic.iam.security;

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
    void preciseSignedIssuanceSeparatesTokensOnBothSidesOfSameSecondRevocation() {
        Instant second=Instant.now().minusSeconds(2).truncatedTo(java.time.temporal.ChronoUnit.SECONDS);
        Instant cut=second.plusNanos(500_000_000);
        TokenVerifier verifier=new TokenVerifier(USER_SECRET);
        var states=org.mockito.Mockito.mock(com.clinic.iam.repo.UserSecurityStateRepository.class);
        var scope=org.mockito.Mockito.mock(DatabaseScope.class);
        UUID user=UUID.randomUUID();var state=new com.clinic.iam.domain.UserSecurityState();state.userId=user;state.invalidBefore=cut;
        org.mockito.Mockito.when(states.findById(user)).thenReturn(java.util.Optional.of(state));
        var sessions=new SessionSecurityService(scope,states);
        for(var issued:List.of(second.plusNanos(100_000_000),second.plusNanos(900_000_000))){
            String token=Jwts.builder().subject(user.toString()).claim("roles",List.of("ROLE_PATIENT")).claim("token_type","access").claim("auth_issued_at",issued.toString()).issuedAt(Date.from(second)).expiration(Date.from(Instant.now().plusSeconds(60))).signWith(Keys.hmacShaKeyFor(USER_SECRET.getBytes(StandardCharsets.UTF_8))).compact();
            Actor actor=verifier.verify("Bearer "+token);assertNotNull(actor);assertEquals(issued,actor.issuedAt());assertEquals(issued.isAfter(cut),sessions.accessAllowed(actor));
        }
        String bad=Jwts.builder().subject(user.toString()).claim("roles",List.of("ROLE_PATIENT")).claim("token_type","access").claim("auth_issued_at",second.plusSeconds(1).toString()).issuedAt(Date.from(second)).expiration(Date.from(Instant.now().plusSeconds(60))).signWith(Keys.hmacShaKeyFor(USER_SECRET.getBytes(StandardCharsets.UTF_8))).compact();
        assertNull(verifier.verify("Bearer "+bad));
    }

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
        WorkloadTokens tokens=new WorkloadTokens(WORKLOAD_SECRET,WORKLOAD_SECRET,"identity-service","clinic-service");
        String bearer="Bearer "+tokens.mint("clinic-service","identity-service","iam.authorize","iam.contexts.read");
        WorkloadPrincipal principal=tokens.verify(bearer);
        assertNotNull(principal);
        assertEquals("clinic-service",principal.issuer());
        assertTrue(principal.hasScope("iam.authorize"));
        assertTrue(principal.hasScope("iam.contexts.read"));

        WorkloadTokens wrongAudience=new WorkloadTokens(WORKLOAD_SECRET,WORKLOAD_SECRET,"different-service","clinic-service");
        assertNull(wrongAudience.verify(bearer));
        WorkloadTokens reception=new WorkloadTokens(WORKLOAD_SECRET,WORKLOAD_SECRET,"identity-service","encounter-service,patient-service");
        assertNotNull(reception.verify("Bearer "+reception.mint("encounter-service","identity-service","iam.authorize")));
        assertNull(reception.verify("Bearer "+reception.mint("encounter-service","identity-service","iam.owner.provision")));
    }

    @Test
    void shortSecretsFailFast() {
        assertThrows(IllegalArgumentException.class,()->new TokenVerifier("short"));
        assertThrows(IllegalArgumentException.class,()->new WorkloadTokens("short",WORKLOAD_SECRET,"identity-service","clinic-service"));
        assertThrows(IllegalArgumentException.class,()->new WorkloadTokens(WORKLOAD_SECRET,"short","identity-service","clinic-service"));
    }
}
