package com.clinic.v2.patient.security;
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
@Component
public class WorkloadTokenVerifier{
 private final javax.crypto.SecretKey key;private final String audience;
 private EncounterPeerVerifier encounter;
 private BillingPeerVerifier billing;
 @org.springframework.beans.factory.annotation.Autowired public void billingVerifier(BillingPeerVerifier peer){this.billing=peer;}
 @org.springframework.beans.factory.annotation.Autowired public void encounterVerifier(EncounterPeerVerifier peer){this.encounter=peer;}
 public WorkloadTokenVerifier(@Value("${patient.security.appointment-secret:}") String secret,@Value("${patient.security.audience:patient-v2-service}") String audience){
  this.audience=audience;
  this.key=secret==null||secret.isBlank()?null:Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
 }
 public WorkloadPrincipal verify(String bearer){
  if(billing!=null&&billing.matches(bearer,"patient.notification.recipient"))return new WorkloadPrincipal("billing-v2-service",Set.of("patient.notification.recipient"));
  if(encounter!=null&&encounter.matches(bearer,"patient.clinic.read"))return new WorkloadPrincipal("encounter-v2-service",Set.of("patient.clinic.read"));
  if(key==null||bearer==null||!bearer.startsWith("Bearer "))return null;
  try{
   Claims c=Jwts.parser().verifyWith(key).requireAudience(audience).build().parseSignedClaims(bearer.substring(7)).getPayload();
   Instant now=Instant.now();
   if(!"appointment-service".equals(c.getIssuer())||!"appointment-service".equals(c.getSubject())||!"workload".equals(c.get("token_type",String.class))
     ||c.getIssuedAt()==null||c.getExpiration()==null||c.getId()==null||c.getId().isBlank()||!c.getExpiration().toInstant().isAfter(now)
     ||c.getIssuedAt().toInstant().isAfter(now.plusSeconds(5))||c.getIssuedAt().toInstant().isBefore(now.minusSeconds(120))
     ||c.getExpiration().toInstant().isAfter(c.getIssuedAt().toInstant().plusSeconds(120)))return null;
   Object raw=c.get("scopes");if(!(raw instanceof Collection<?> list)||list.isEmpty())return null;
   Set<String>s=new HashSet<>();for(Object x:list){if(!(x instanceof String v)||v.isBlank())return null;s.add(v);}
   return new WorkloadPrincipal("appointment-service",Set.copyOf(s));
  }catch(RuntimeException e){return null;}
 }
}
