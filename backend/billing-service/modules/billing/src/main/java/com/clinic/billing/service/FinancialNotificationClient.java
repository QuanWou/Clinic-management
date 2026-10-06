package com.clinic.billing.service;
import com.clinic.billing.api.ApiProblem;
import com.fasterxml.jackson.databind.JsonNode;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
@Component public class FinancialNotificationClient{
 private final RestClient patient,notification;private final javax.crypto.SecretKey key;
 public FinancialNotificationClient(@Value("${billing.security.service-secret}") String secret,@Value("${billing.notification.patient-url:http://127.0.0.1:8098}") String patientUrl,@Value("${billing.notification.notification-url:http://127.0.0.1:8100}") String notificationUrl){
  key=Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));var f=new SimpleClientHttpRequestFactory();f.setConnectTimeout(Duration.ofSeconds(2));f.setReadTimeout(Duration.ofSeconds(2));patient=RestClient.builder().baseUrl(patientUrl).requestFactory(f).build();notification=RestClient.builder().baseUrl(notificationUrl).requestFactory(f).build();
 }
 public record Recipient(String status,UUID userId){}
 public record Ack(UUID eventId,boolean applied){}
 private String token(String audience,String scope){var now=Instant.now();return "Bearer "+Jwts.builder().issuer("billing-service").subject("billing-service").audience().add(audience).and().id(UUID.randomUUID().toString()).claim("token_type","workload").claim("scopes",List.of(scope)).issuedAt(Date.from(now)).expiration(Date.from(now.plusSeconds(30))).signWith(key).compact();}
 private void outside(){if(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive())throw new IllegalStateException("Notification HTTP must be outside Billing transaction");}
 public Recipient recipient(UUID clinic,UUID patientId){
  outside();try{var result=patient.get().uri("/api/internal/notification-recipients/clinics/{c}/patients/{p}",clinic,patientId).header("Authorization",token("patient-service","patient.notification.recipient")).retrieve().body(Recipient.class);
   if(result==null||!Set.of("OWNED","NO_ACCOUNT","LINK_UNAVAILABLE").contains(result.status())||("OWNED".equals(result.status())!=(result.userId()!=null)))throw ApiProblem.dependency("Invalid Patient notification proof");return result;
  }catch(org.springframework.web.client.RestClientException ex){throw ApiProblem.dependency("Patient notification source unavailable");}
 }
 public void send(JsonNode event){
  outside();try{var ack=notification.post().uri("/api/internal/notifications/billing-events").header("Authorization",token("notification-service","notification.billing.consume")).contentType(MediaType.APPLICATION_JSON).body(event).retrieve().body(Ack.class);
   if(ack==null||!event.path("id").asText().equals(String.valueOf(ack.eventId())))throw ApiProblem.dependency("Notification acknowledgement mismatch");
  }catch(org.springframework.web.client.RestClientException ex){throw ApiProblem.dependency("Financial notification delivery unavailable");}
 }
}
