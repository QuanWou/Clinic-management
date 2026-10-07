package com.clinic.billing.security;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;

@Component
public class WorkloadTokenIssuer {
    private final SecretKey iamKey;
    private final SecretKey clinicKey;
    public WorkloadTokenIssuer(@Value("${billing.security.iam-service-secret}") String iamSecret,
                               @Value("${billing.security.clinic-service-secret}") String clinicSecret){
        iamKey=key(iamSecret,"Billing→IAM");
        clinicKey=key(clinicSecret,"Billing→Clinic");
    }
    private SecretKey key(String secret,String name){
        if(secret==null||secret.getBytes(StandardCharsets.UTF_8).length<32)
            throw new IllegalArgumentException(name+" workload secret must be at least 32 bytes");
        return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }
    public String toIam(String... scopes){return mint(iamKey,"identity-service",scopes);}
    public String toClinic(String... scopes){return mint(clinicKey,"clinic-service",scopes);}
    private String mint(SecretKey key,String audience,String... scopes){
        Instant now=Instant.now();
        return Jwts.builder().issuer("billing-service").subject("billing-service")
            .audience().add(audience).and().id(UUID.randomUUID().toString())
            .claim("token_type","workload").claim("scopes",List.of(scopes))
            .issuedAt(Date.from(now)).expiration(Date.from(now.plusSeconds(30))).signWith(key).compact();
    }
}

