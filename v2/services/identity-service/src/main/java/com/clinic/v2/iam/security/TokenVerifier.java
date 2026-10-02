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
public class TokenVerifier {
 private final SecretKey key;
 public TokenVerifier(@Value("${iam.security.jwt-secret}") String secret){
  if(secret==null||secret.getBytes(StandardCharsets.UTF_8).length<32)throw new IllegalArgumentException("IAM JWT secret must be at least 32 bytes");
  key=Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
 }
 public Actor verify(String bearer){
  if(bearer==null||!bearer.startsWith("Bearer "))return null;
  try{
   var c=Jwts.parser().verifyWith(key).build().parseSignedClaims(bearer.substring(7)).getPayload();
   if(!"access".equals(c.get("token_type",String.class))||c.getExpiration()==null||!c.getExpiration().toInstant().isAfter(Instant.now())||c.getIssuedAt()==null||c.getIssuedAt().toInstant().isAfter(Instant.now()))return null;
   Object raw=c.get("roles");
   if(!(raw instanceof Collection<?> roles)||roles.isEmpty()||roles.stream().anyMatch(x->!(x instanceof String s)||!s.startsWith("ROLE_")))return null;
   Set<String> names=new HashSet<>();roles.forEach(x->names.add((String)x));
   return new Actor(UUID.fromString(c.getSubject()),Set.copyOf(names),c.getIssuedAt().toInstant());
  }catch(RuntimeException ex){return null;}
 }
}
