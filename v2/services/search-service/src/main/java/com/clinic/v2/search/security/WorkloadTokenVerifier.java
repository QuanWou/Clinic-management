package com.clinic.v2.search.security;

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
  private final Map<String,SecretKey> keys; private final String audience;
  public WorkloadTokenVerifier(@Value("${search.security.clinic-secret:}") String clinic,
      @Value("${search.security.doctor-secret:}") String doctor,
      @Value("${search.security.catalog-secret:}") String catalog,
      @Value("${search.security.audience:search-v2-service}") String audience){
    Map<String,SecretKey> map=new HashMap<>();
    add(map,"clinic-v2-service",clinic);add(map,"doctor-v2-service",doctor);add(map,"catalog-v2-service",catalog);
    this.keys=Map.copyOf(map);this.audience=audience;
  }
  private void add(Map<String,SecretKey> map,String issuer,String secret){
    if(secret==null||secret.isBlank())return;
    byte[] bytes=secret.getBytes(StandardCharsets.UTF_8);
    if(bytes.length<32)throw new IllegalArgumentException("Search workload secret for "+issuer+" must be at least 32 bytes");
    map.put(issuer,Keys.hmacShaKeyFor(bytes));
  }
  public WorkloadPrincipal verify(String bearer){
    if(bearer==null||!bearer.startsWith("Bearer "))return null;
    String token=bearer.substring(7);
    for(var e:keys.entrySet()){
      try{
        Claims c=Jwts.parser().verifyWith(e.getValue()).requireAudience(audience).build().parseSignedClaims(token).getPayload();
        Instant now=Instant.now();
        if(!e.getKey().equals(c.getIssuer())||!e.getKey().equals(c.getSubject())||!"workload".equals(c.get("token_type",String.class))
          ||c.getIssuedAt()==null||c.getExpiration()==null||c.getId()==null||c.getIssuedAt().toInstant().isAfter(now.plusSeconds(5))
          ||c.getIssuedAt().toInstant().isBefore(now.minusSeconds(120))||!c.getExpiration().toInstant().isAfter(now))continue;
        Object raw=c.get("scopes");if(!(raw instanceof Collection<?> list)||list.isEmpty())continue;
        Set<String> scopes=new HashSet<>();for(Object x:list){if(!(x instanceof String s)||s.isBlank())return null;scopes.add(s);}
        return new WorkloadPrincipal(e.getKey(),Set.copyOf(scopes));
      }catch(RuntimeException ignored){}
    }
    return null;
  }
}
