package com.clinic.v2.audit.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

class WorkloadTokenVerifierTest {
    private static final String IDENTITY="synthetic-audit-identity-secret-more-than-32-bytes";
    private static final String CLINIC="synthetic-audit-clinic-secret-more-than-32-bytes";
    private final WorkloadTokenVerifier verifier=new WorkloadTokenVerifier(IDENTITY,CLINIC,"","",
        "audit-v2-service");

    private String token(String issuer,String secret,String audience,List<String> scopes,Instant issued,Instant expires){
        return Jwts.builder().issuer(issuer).subject(issuer).audience().add(audience).and()
            .id(UUID.randomUUID().toString()).claim("token_type","workload").claim("scopes",scopes)
            .issuedAt(Date.from(issued)).expiration(Date.from(expires))
            .signWith(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8))).compact();
    }

    @Test void configuredIssuerAndAudienceAreAuthenticated(){
        Instant now=Instant.now();
        var p=verifier.verify("Bearer "+token("clinic-v2-service",CLINIC,"audit-v2-service",
            List.of("audit.write"),now.minusSeconds(5),now.plusSeconds(30)));
        assertNotNull(p);
        assertEquals("clinic-v2-service",p.issuer());
        assertTrue(p.hasScope("audit.write"));
    }

    @Test void issuerCannotForgeAnotherConfiguredService(){
        Instant now=Instant.now();
        assertNull(verifier.verify("Bearer "+token("identity-v2-service",CLINIC,"audit-v2-service",
            List.of("audit.read"),now.minusSeconds(5),now.plusSeconds(30))));
    }

    @Test void wrongAudienceExpiredAndUnknownIssuerFailClosed(){
        Instant now=Instant.now();
        assertNull(verifier.verify("Bearer "+token("clinic-v2-service",CLINIC,"wrong",
            List.of("audit.write"),now.minusSeconds(5),now.plusSeconds(30))));
        assertNull(verifier.verify("Bearer "+token("clinic-v2-service",CLINIC,"audit-v2-service",
            List.of("audit.write"),now.minusSeconds(60),now.minusSeconds(1))));
        assertNull(verifier.verify("Bearer "+token("unknown-service",CLINIC,"audit-v2-service",
            List.of("audit.write"),now.minusSeconds(5),now.plusSeconds(30))));
    }
}
