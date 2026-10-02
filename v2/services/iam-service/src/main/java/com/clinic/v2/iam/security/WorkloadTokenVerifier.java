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
public class WorkloadTokenVerifier {
    private final Map<String,SecretKey> keys;
    public WorkloadTokenVerifier(
        @Value("${iam.security.clinic-service-secret:}") String clinicSecret,
        @Value("${iam.security.bootstrap-secret:}") String bootstrapSecret) {
        Map<String,SecretKey> configured=new HashMap<>();
        add(configured,"clinic-service",clinicSecret);
        add(configured,"platform-bootstrap",bootstrapSecret);
        this.keys=Map.copyOf(configured);
    }
    private void add(Map<String,SecretKey> target,String subject,String secret){
        if(secret!=null && !secret.isBlank()){
            if(secret.getBytes(StandardCharsets.UTF_8).length<32)
                throw new IllegalArgumentException(subject+" workload secret must be at least 32 bytes");
            target.put(subject,Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8)));
        }
    }
    public Workload verify(String bearer,String requiredScope){
        if(bearer==null || !bearer.startsWith("Bearer ")) return null;
        String token=bearer.substring(7);
        for(var entry:keys.entrySet()){
            try{
                Claims c=Jwts.parser().verifyWith(entry.getValue()).build().parseSignedClaims(token).getPayload();
                if(!entry.getKey().equals(c.getSubject()) || !"workload".equals(c.get("token_type",String.class)) ||
                   c.getExpiration()==null || !c.getExpiration().toInstant().isAfter(Instant.now()) ||
                   c.getIssuedAt()==null || c.getIssuedAt().toInstant().isAfter(Instant.now()) ||
                   c.getAudience()==null || !c.getAudience().contains("iam-service")) continue;
                Object raw=c.get("scopes");
                if(!(raw instanceof Collection<?> scopes) || scopes.stream().noneMatch(requiredScope::equals)) continue;
                return new Workload(entry.getKey());
            }catch(RuntimeException ignored){}
        }
        return null;
    }
    public record Workload(String subject){}
}
