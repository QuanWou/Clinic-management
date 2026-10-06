package com.clinic.appointment.security;
import io.jsonwebtoken.Jwts;import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;import org.springframework.stereotype.Component;
import java.nio.charset.StandardCharsets;import java.time.Instant;import java.util.*;
@Component
public class WorkloadTokenIssuer{
 private final javax.crypto.SecretKey key;
 public WorkloadTokenIssuer(@Value("${appointment.security.workload-secret}") String secret){
  byte[] b=secret.getBytes(StandardCharsets.UTF_8);if(b.length<32)throw new IllegalArgumentException("Appointment workload secret must be >=32 bytes");key=Keys.hmacShaKeyFor(b);
 }
 public String bearer(String audience,String... scopes){
  Instant now=Instant.now();return "Bearer "+Jwts.builder().issuer("appointment-service").subject("appointment-service")
   .audience().add(audience).and().id(UUID.randomUUID().toString()).claim("token_type","workload").claim("scopes",List.of(scopes))
   .issuedAt(Date.from(now)).expiration(Date.from(now.plusSeconds(30))).signWith(key).compact();
 }
}
