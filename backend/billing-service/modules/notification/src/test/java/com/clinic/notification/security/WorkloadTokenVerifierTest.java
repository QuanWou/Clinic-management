package com.clinic.notification.security;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.nio.charset.StandardCharsets;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
class WorkloadTokenVerifierTest{
 final String secret="synthetic-workload-secret-at-least-32-bytes";final String audience="notification-service";
 String token(Instant issued,Instant expiry,String target,String issuer,Object scopes){
  return "Bearer "+Jwts.builder().issuer(issuer).subject(issuer).audience().add(target).and().id(UUID.randomUUID().toString())
    .claim("token_type","workload").claim("scopes",scopes).issuedAt(Date.from(issued)).expiration(Date.from(expiry))
    .signWith(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8))).compact();
 }
 @Test void financialPeerUsesItsOwnIssuerAudienceScopeAndFailsClosedWhenUnconfigured(){
  var v=new WorkloadTokenVerifier("",audience);v.billingVerifier(new BillingPeerVerifier(secret));Instant now=Instant.now();assertNotNull(v.verify(token(now,now.plusSeconds(30),audience,"billing-service",List.of("notification.billing.consume"))));assertNull(v.verify(token(now,now.plusSeconds(30),"other","billing-service",List.of("notification.billing.consume"))));assertNull(v.verify(token(now,now.plusSeconds(30),audience,"billing-service",List.of("notification.consume"))));assertNull(v.verify(token(now,now.plusSeconds(600),audience,"billing-service",List.of("notification.billing.consume"))));assertFalse(new BillingPeerVerifier("").matches(token(now,now.plusSeconds(30),audience,"billing-service",List.of("notification.billing.consume")),"notification.billing.consume"));
 }
 @Test void acceptsShortLivedWorkloadButRejectsAudienceIssuerTimeAndMalformedScopes(){
  var v=new WorkloadTokenVerifier(secret,audience);Instant now=Instant.now();
  assertNotNull(v.verify(token(now,now.plusSeconds(30),audience,"appointment-service",List.of("notification.consume"))));
  assertNull(v.verify(token(now,now.plusSeconds(30),"other","appointment-service",List.of("test"))));
  assertNull(v.verify(token(now,now.plusSeconds(30),audience,"other-service",List.of("test"))));
  assertNull(v.verify(token(now.plusSeconds(30),now.plusSeconds(60),audience,"appointment-service",List.of("test"))));
  assertNull(v.verify(token(now,now.plusSeconds(600),audience,"appointment-service",List.of("test"))));
  assertNull(v.verify(token(now.minusSeconds(180),now.plusSeconds(30),audience,"appointment-service",List.of("test"))));
  assertNull(v.verify(token(now,now.plusSeconds(30),audience,"appointment-service",List.of(1))));
 }
}

