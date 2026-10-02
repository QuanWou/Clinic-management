package com.clinic.v2.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class TokenVerifierTest {
    private static final String SECRET="synthetic-only-test-jwt-secret-more-than-32-bytes";
    private final TokenVerifier verifier=new TokenVerifier(SECRET);

    private String signed(String type,Instant issued,Instant expires){
        return Jwts.builder()
            .subject("11111111-1111-4111-8111-111111111111")
            .claim("email","operator@example.test")
            .claim("roles",List.of("ROLE_ADMIN"))
            .claim("token_type",type)
            .issuedAt(Date.from(issued))
            .expiration(Date.from(expires))
            .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)))
            .compact();
    }
    @Test void onlyCurrentAccessTokenAuthenticates(){
        Instant now=Instant.now();
        Actor actor=verifier.verify("Bearer "+signed("access",now.minusSeconds(20),now.plusSeconds(180)));
        assertNotNull(actor);
        assertTrue(actor.hasRole("ROLE_ADMIN"));
    }
    @Test void refreshAndExpiredTokensNeverAuthorizeClinic(){
        Instant now=Instant.now();
        assertNull(verifier.verify("Bearer "+signed("refresh",now.minusSeconds(20),now.plusSeconds(180))));
        assertNull(verifier.verify("Bearer "+signed("access",now.minusSeconds(180),now.minusSeconds(10))));
        assertNull(verifier.verify("Bearer "+signed("access",now.plusSeconds(60),now.plusSeconds(180))));
    }
    @Test void malformedAndAbsentCredentialsAreDenied(){
        assertNull(verifier.verify(null));
        assertNull(verifier.verify("Basic abc"));
        assertNull(verifier.verify("Bearer gibberish"));
        assertThrows(IllegalArgumentException.class,()->new TokenVerifier("short-secret"));
    }
}
