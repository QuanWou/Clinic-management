package com.clinic.v2.patient.security;
import com.clinic.v2.patient.api.ApiProblem;
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
@Component
public class EncounterPeerVerifier {
 private final javax.crypto.SecretKey key;
 public EncounterPeerVerifier(@Value("${patient.security.encounter-secret:}") String secret){key=secret==null||secret.isBlank()?null:Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));}
 public void require(String bearer,String scope){if(!matches(bearer,scope))throw ApiProblem.forbidden();}
 public boolean matches(String bearer,String scope){
  if(key==null||bearer==null||!bearer.startsWith("Bearer "))return false;
  try{Claims c=Jwts.parser().verifyWith(key).requireAudience("patient-v2-service").build().parseSignedClaims(bearer.substring(7)).getPayload();var now=Instant.now();
   if(!"encounter-v2-service".equals(c.getIssuer())||!c.getIssuer().equals(c.getSubject())||!"workload".equals(c.get("token_type",String.class))||c.getIssuedAt()==null||c.getExpiration()==null||c.getId()==null||c.getId().isBlank()||!c.getExpiration().toInstant().isAfter(now)||c.getIssuedAt().toInstant().isAfter(now.plusSeconds(5))||c.getIssuedAt().toInstant().isBefore(now.minusSeconds(120))||c.getExpiration().toInstant().isAfter(c.getIssuedAt().toInstant().plusSeconds(120)))return false;
   Object raw=c.get("scopes");return raw instanceof Collection<?> list&&!list.isEmpty()&&list.stream().allMatch(x->x instanceof String s&&!s.isBlank())&&list.contains(scope);
  }catch(RuntimeException ex){return false;}
 }
}
