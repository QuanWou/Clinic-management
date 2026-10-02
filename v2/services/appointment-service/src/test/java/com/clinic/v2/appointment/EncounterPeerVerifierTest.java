package com.clinic.v2.appointment;
import com.clinic.v2.appointment.security.EncounterPeerVerifier;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
class EncounterPeerVerifierTest {
 private static final String SECRET="synthetic-encounter-peer-secret-at-least-32-bytes";
 private String token(String issuer,String audience,String scope,Instant issued,Instant expires){return "Bearer "+Jwts.builder().issuer(issuer).subject(issuer).audience().add(audience).and().id(UUID.randomUUID().toString()).claim("token_type","workload").claim("scopes",List.of(scope)).issuedAt(Date.from(issued)).expiration(Date.from(expires)).signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8))).compact();}
 @Test void peerRequiresCorrectIssuerAudienceScopeAndBoundedLifetime(){
  var verifier=new EncounterPeerVerifier(SECRET);var now=Instant.now();
  assertTrue(verifier.matches(token("encounter-v2-service","appointment-v2-service","expected",now,now.plusSeconds(30)),"expected"));
  assertFalse(verifier.matches(token("appointment-service","appointment-v2-service","expected",now,now.plusSeconds(30)),"expected"));
  assertFalse(verifier.matches(token("encounter-v2-service","other-service","expected",now,now.plusSeconds(30)),"expected"));
  assertFalse(verifier.matches(token("encounter-v2-service","appointment-v2-service","other",now,now.plusSeconds(30)),"expected"));
  assertFalse(verifier.matches(token("encounter-v2-service","appointment-v2-service","expected",now,now.plusSeconds(3600)),"expected"));
  assertFalse(new EncounterPeerVerifier("").matches(token("encounter-v2-service","appointment-v2-service","expected",now,now.plusSeconds(30)),"expected"));
 }
}
