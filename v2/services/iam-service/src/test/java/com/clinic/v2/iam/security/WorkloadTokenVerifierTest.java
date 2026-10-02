package com.clinic.v2.iam.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

class WorkloadTokenVerifierTest {
    static final String CLINIC_SECRET="synthetic-clinic-caller-secret-more-than-32-bytes";
    static final String BOOTSTRAP_SECRET="synthetic-bootstrap-secret-more-than-32-bytes";

    @Test void verifiesOnlyExpectedSubjectAudienceAndScope(){
        WorkloadTokenVerifier verifier=new WorkloadTokenVerifier(CLINIC_SECRET,BOOTSTRAP_SECRET);
        String good=token("clinic-service","iam-service","iam.authorize",CLINIC_SECRET);
        assertEquals("clinic-service",verifier.verify("Bearer "+good,"iam.authorize").subject());
        assertNull(verifier.verify("Bearer "+good,"iam.owner.provision"));
        assertNull(verifier.verify("Bearer "+token("clinic-service","wrong-audience","iam.authorize",CLINIC_SECRET),"iam.authorize"));
        assertNull(verifier.verify("Bearer "+token("platform-bootstrap","iam-service","iam.authorize",BOOTSTRAP_SECRET),"iam.platform.bootstrap"));
    }

    @Test void rejectsExpiredOrWrongSignature(){
        WorkloadTokenVerifier verifier=new WorkloadTokenVerifier(CLINIC_SECRET,BOOTSTRAP_SECRET);
        assertNull(verifier.verify("Bearer "+expired(CLINIC_SECRET),"iam.authorize"));
        assertNull(verifier.verify("Bearer "+token("clinic-service","iam-service","iam.authorize",
            "different-synthetic-secret-more-than-32-bytes"),"iam.authorize"));
    }

    private static String token(String subject,String audience,String scope,String secret){
        Instant now=Instant.now();
        return Jwts.builder().subject(subject).audience().add(audience).and()
            .claim("token_type","workload").claim("scopes",List.of(scope))
            .issuedAt(Date.from(now.minusSeconds(1))).expiration(Date.from(now.plusSeconds(30)))
            .signWith(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8))).compact();
    }
    private static String expired(String secret){
        Instant now=Instant.now();
        return Jwts.builder().subject("clinic-service").audience().add("iam-service").and()
            .claim("token_type","workload").claim("scopes",List.of("iam.authorize"))
            .issuedAt(Date.from(now.minusSeconds(60))).expiration(Date.from(now.minusSeconds(1)))
            .signWith(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8))).compact();
    }
}
