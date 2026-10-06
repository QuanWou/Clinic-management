package com.clinic.billing.security;
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
@Component public class ChargePeerVerifier{
 public record Peer(String issuer){}
 private final Map<String,javax.crypto.SecretKey> keys=new HashMap<>();
 public ChargePeerVerifier(@Value("${billing.charges.medical-secret:}") String medical,@Value("${billing.charges.encounter-secret:}") String encounter){put("medical-service",medical);put("encounter-service",encounter);}
 private void put(String issuer,String secret){if(secret!=null&&!secret.isBlank())keys.put(issuer,Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8)));}
 public Peer verify(String bearer){
  if(bearer==null||!bearer.startsWith("Bearer "))return null;
  for(var entry:keys.entrySet())try{var c=Jwts.parser().verifyWith(entry.getValue()).requireIssuer(entry.getKey()).requireAudience("billing-service").build().parseSignedClaims(bearer.substring(7)).getPayload();var now=Instant.now();
   if(!entry.getKey().equals(c.getSubject())||!"workload".equals(c.get("token_type",String.class))||c.getIssuedAt()==null||c.getExpiration()==null||c.getId()==null||c.getId().isBlank()||!c.getExpiration().toInstant().isAfter(now)||c.getIssuedAt().toInstant().isAfter(now.plusSeconds(5))||c.getIssuedAt().toInstant().isBefore(now.minusSeconds(120))||c.getExpiration().toInstant().isAfter(c.getIssuedAt().toInstant().plusSeconds(120)))continue;
   Object raw=c.get("scopes");if(raw instanceof Collection<?> scopes&&!scopes.isEmpty()&&scopes.stream().allMatch(x->x instanceof String s&&!s.isBlank())&&scopes.contains("billing.charge.consume"))return new Peer(entry.getKey());
  }catch(RuntimeException ex){}
  return null;
 }
}
