package com.clinic.v2.iam.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;

@Component
public class ClinicWorkloadTokenIssuer {
    private final SecretKey key;
    public ClinicWorkloadTokenIssuer(@Value("${iam.security.clinic-directory-secret:}") String secret){
        if(secret==null || secret.getBytes(StandardCharsets.UTF_8).length<32)
            throw new IllegalArgumentException("IAM clinic-directory workload secret must be at least 32 bytes");
        key=Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }
    public String issue(){
        Instant now=Instant.now();
        return Jwts.builder().subject("iam-service").audience().add("clinic-service").and()
            .claim("token_type","workload").claim("scopes",List.of("clinic.scope.read"))
            .issuedAt(Date.from(now)).expiration(Date.from(now.plusSeconds(30))).signWith(key).compact();
    }
}
