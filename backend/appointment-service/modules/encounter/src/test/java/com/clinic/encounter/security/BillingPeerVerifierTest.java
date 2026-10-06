package com.clinic.encounter.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class BillingPeerVerifierTest {
 private static final String SECRET="synthetic-billing-source-peer-secret-32-bytes";
 private String token(String issuer,String audience,String scope){
  var now=Instant.now();return "Bearer "+Jwts.builder().issuer(issuer).subject(issuer)
   .audience().add(audience).and().id(UUID.randomUUID().toString()).claim("token_type","workload")
   .claim("scopes",List.of(scope)).issuedAt(Date.from(now)).expiration(Date.from(now.plusSeconds(30)))
   .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8))).compact();
 }
 @Test void onlyBillingIssuerWithEncounterAudienceAndSourceScopeIsAccepted(){
  var peer=new BillingPeerVerifier(SECRET);
  assertTrue(peer.matches(token("billing-service","encounter-service","billing.source.read"),"billing.source.read"));
  assertFalse(peer.matches(token("billing-service","billing-service","billing.source.read"),"billing.source.read"));
  assertFalse(peer.matches(token("medical-service","encounter-service","billing.source.read"),"billing.source.read"));
  assertFalse(peer.matches(token("billing-service","encounter-service","audit.write"),"billing.source.read"));
  assertFalse(new BillingPeerVerifier("").matches(token("billing-service","encounter-service","billing.source.read"),"billing.source.read"));
 }
}
