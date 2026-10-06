package com.clinic.appointment.security;
import com.clinic.appointment.api.ApiProblem;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;
import java.util.*;
import java.time.*;
import java.nio.charset.StandardCharsets;
@Component public class BillingSourceAuthorization {
 private final RestClient iam;private final javax.crypto.SecretKey key;
 public BillingSourceAuthorization(@Value("${appointment.security.identity-url}") String url,@Value("${appointment.security.iam-service-secret:${APPOINTMENT_IAM_SERVICE_SECRET:}}") String secret){var f=new SimpleClientHttpRequestFactory();f.setConnectTimeout(Duration.ofSeconds(2));f.setReadTimeout(Duration.ofSeconds(2));iam=RestClient.builder().baseUrl(url).requestFactory(f).build();key=secret.isBlank()?null:Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));}
 public record Decision(boolean allowed){}
 public void require(UUID actor,UUID clinic,UUID branch){
  if(key==null||actor==null)throw ApiProblem.forbidden();
  try{var now=Instant.now();String token=Jwts.builder().issuer("appointment-service").subject("appointment-service").audience().add("identity-service").and().id(UUID.randomUUID().toString()).claim("token_type","workload").claim("scopes",List.of("iam.authorize")).issuedAt(Date.from(now)).expiration(Date.from(now.plusSeconds(30))).signWith(key).compact();
   var decision=iam.post().uri("/api/internal/iam/authorization/check").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).body(Map.of("actorUserId",actor,"clinicId",clinic,"branchId",branch,"capability","BILLING")).retrieve().body(Decision.class);if(decision==null||!decision.allowed())throw ApiProblem.forbidden();
  }catch(ApiProblem e){throw e;}catch(Exception e){throw ApiProblem.forbidden();}
 }
}
