package com.clinic.v2.security;
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;

public class TokenVerifier {
    private final SecretKey key;
    public TokenVerifier(String secret){
        if(secret==null || secret.getBytes(StandardCharsets.UTF_8).length<32)
            throw new IllegalArgumentException("V2 JWT secret must be at least 32 bytes");
        key=Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }
    public Actor verify(String bearer){
        if(bearer==null || !bearer.startsWith("Bearer "))return null;
        try{
            var c=Jwts.parser().verifyWith(key).build().parseSignedClaims(bearer.substring(7)).getPayload();
            if(!"access".equals(c.get("token_type",String.class)) || c.getExpiration()==null ||
                !c.getExpiration().toInstant().isAfter(Instant.now()) || c.getIssuedAt()==null ||
                c.getIssuedAt().toInstant().isAfter(Instant.now()))return null;
            UUID id=UUID.fromString(c.getSubject());
            Object raw=c.get("roles");
            if(!(raw instanceof Collection<?> list)||list.isEmpty()||
                list.stream().anyMatch(x->!(x instanceof String s) || !s.startsWith("ROLE_")))return null;
            Set<String> roles=new HashSet<>();
            list.forEach(x->roles.add((String)x));
            return new Actor(id,Set.copyOf(roles));
        }catch(RuntimeException ex){return null;}
    }
}
