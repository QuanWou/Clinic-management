package com.clinic.v2.iam.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;

@Component
public class UserTokenVerifier {
    private final SecretKey key;
    public UserTokenVerifier(@Value("${iam.security.jwt-secret}") String secret){
        if(secret==null || secret.getBytes(StandardCharsets.UTF_8).length<32)
            throw new IllegalArgumentException("IAM user JWT secret must be at least 32 bytes");
        key=Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }
    public Actor verify(String bearer){
        if(bearer==null || !bearer.startsWith("Bearer ")) return null;
        try{
            Claims c=Jwts.parser().verifyWith(key).build().parseSignedClaims(bearer.substring(7)).getPayload();
            if(!"access".equals(c.get("token_type",String.class)) || c.getExpiration()==null ||
               !c.getExpiration().toInstant().isAfter(Instant.now()) || c.getIssuedAt()==null ||
               c.getIssuedAt().toInstant().isAfter(Instant.now())) return null;
            UUID id=UUID.fromString(c.getSubject());
            Object raw=c.get("roles");
            if(!(raw instanceof Collection<?> values) || values.isEmpty()) return null;
            Set<String> roles=new HashSet<>();
            for(Object v:values){
                if(!(v instanceof String s) || !s.startsWith("ROLE_")) return null;
                roles.add(s);
            }
            return new Actor(id,Set.copyOf(roles),c.getIssuedAt().toInstant());
        }catch(RuntimeException ex){return null;}
    }
}
