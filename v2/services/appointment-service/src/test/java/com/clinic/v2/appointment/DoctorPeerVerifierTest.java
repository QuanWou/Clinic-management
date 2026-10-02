package com.clinic.v2.appointment;
import com.clinic.v2.appointment.security.DoctorPeerVerifier;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.util.*;
import java.time.Instant;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class DoctorPeerVerifierTest {
 String secret="synthetic-absence-peer-secret-at-least-32-bytes";
 String token(String issuer,String audience,String scope,long seconds){var now=Instant.now();return "Bearer "+Jwts.builder().issuer(issuer).subject(issuer).audience().add(audience).and().id(UUID.randomUUID().toString()).claim("token_type","workload").claim("scopes",List.of(scope)).issuedAt(Date.from(now)).expiration(Date.from(now.plusSeconds(seconds))).signWith(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8))).compact();}
 @Test void onlyBoundedDoctorWorkloadForDedicatedConsumerIsAccepted(){var verifier=new DoctorPeerVerifier(secret);assertTrue(verifier.matches(token("doctor-v2-service","appointment-v2-service","appointment.absence.consume",30),"appointment.absence.consume"));assertFalse(verifier.matches(token("encounter-v2-service","appointment-v2-service","appointment.absence.consume",30),"appointment.absence.consume"));assertFalse(verifier.matches(token("doctor-v2-service","search-v2-service","appointment.absence.consume",30),"appointment.absence.consume"));assertFalse(verifier.matches(token("doctor-v2-service","appointment-v2-service","appointment.arrival",30),"appointment.absence.consume"));assertFalse(verifier.matches(token("doctor-v2-service","appointment-v2-service","appointment.absence.consume",300),"appointment.absence.consume"));assertFalse(new DoctorPeerVerifier("").matches(token("doctor-v2-service","appointment-v2-service","appointment.absence.consume",30),"appointment.absence.consume"));}
}
