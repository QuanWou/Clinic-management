package com.clinic.audit.security;

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
    private final String audience;

    public WorkloadTokenVerifier(
        @Value("${audit.security.identity-secret:}") String identity,
        @Value("${audit.security.clinic-secret:}") String clinic,
        @Value("${audit.security.doctor-secret:}") String doctor,
        @Value("${audit.security.catalog-secret:}") String catalog,
        @Value("${audit.security.audience:audit-service}") String audience) {
        Map<String,SecretKey> map=new HashMap<>();
        add(map,"identity-service",identity);
        add(map,"clinic-service",clinic);
        add(map,"doctor-service",doctor);
        add(map,"catalog-service",catalog);
        this.keys=map;
        this.audience=audience;
    }

    @Value("${audit.security.appointment-secret:}")
    public void appointmentSecret(String secret){add(keys,"appointment-service",secret);}
    @Value("${audit.security.encounter-secret:}")
    public void encounterSecret(String secret){add(keys,"encounter-service",secret);}
    @Value("${audit.security.medical-secret:}")
    public void medicalSecret(String secret){add(keys,"medical-service",secret);}

    @Value("${audit.security.billing-secret:}") public void billingSecret(String secret){add(keys,"billing-service",secret);}
    private void add(Map<String,SecretKey> map,String issuer,String secret){
        if(secret==null||secret.isBlank())return;
        byte[] bytes=secret.getBytes(StandardCharsets.UTF_8);
        if(bytes.length<32)throw new IllegalArgumentException("Audit workload secret for "+issuer+" must be at least 32 bytes");
        map.put(issuer,Keys.hmacShaKeyFor(bytes));
    }

    public WorkloadPrincipal verify(String bearer){
        if(bearer==null||!bearer.startsWith("Bearer "))return null;
        String token=bearer.substring(7);
        for(var entry:keys.entrySet()){
            try{
                Claims c=Jwts.parser().verifyWith(entry.getValue()).requireAudience(audience)
                    .build().parseSignedClaims(token).getPayload();
                Instant now=Instant.now();
                if(!entry.getKey().equals(c.getIssuer())||!entry.getKey().equals(c.getSubject())
                    ||!"workload".equals(c.get("token_type",String.class))
                    ||c.getIssuedAt()==null||c.getExpiration()==null||c.getId()==null
                    ||c.getIssuedAt().toInstant().isAfter(now.plusSeconds(5))
                    ||c.getIssuedAt().toInstant().isBefore(now.minusSeconds(120))
                    ||!c.getExpiration().toInstant().isAfter(now))continue;
                Object raw=c.get("scopes");
                if(!(raw instanceof Collection<?> list)||list.isEmpty())continue;
                Set<String> scopes=new HashSet<>();
                for(Object item:list){
                    if(!(item instanceof String s)||s.isBlank())return null;
                    scopes.add(s);
                }
                return new WorkloadPrincipal(entry.getKey(),Set.copyOf(scopes));
            }catch(RuntimeException ignored){}
        }
        return null;
    }
}
