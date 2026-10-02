package com.clinic.v2.encounter.service;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
@Configuration @EnableScheduling
@ConditionalOnProperty(name="encounter.relay.enabled",havingValue="true")
public class EncounterAuditRelay {
 private final JdbcTemplate jdbc;private final javax.crypto.SecretKey key;private final RestClient audit;
 public EncounterAuditRelay(JdbcTemplate jdbc,@Value("${encounter.security.service-secret}") String secret,@Value("${encounter.relay.audit-url:http://127.0.0.1:8096}") String url){this.jdbc=jdbc;key=Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));var f=new SimpleClientHttpRequestFactory();f.setConnectTimeout(Duration.ofSeconds(2));f.setReadTimeout(Duration.ofSeconds(2));audit=RestClient.builder().baseUrl(url).requestFactory(f).build();}
 @Scheduled(fixedDelayString="${encounter.relay.delay-ms:1000}") @Transactional public void deliver(){
  jdbc.execute("select set_config('app.encounter_mode','relay',true)");
  for(var row:jdbc.queryForList("select * from encounter_v2.outbox_events where status='PENDING' and next_attempt_at<=now() order by created_at limit 5 for update skip locked")){
   try{var now=Instant.now();String token=Jwts.builder().issuer("encounter-v2-service").subject("encounter-v2-service").audience().add("audit-v2-service").and().id(UUID.randomUUID().toString()).claim("token_type","workload").claim("scopes",List.of("audit.write")).issuedAt(Date.from(now)).expiration(Date.from(now.plusSeconds(30))).signWith(key).compact();
    audit.post().uri("/api/v2/internal/audit/encounter-events").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).body(row.get("payload_json").toString()).retrieve().toBodilessEntity();jdbc.update("update encounter_v2.outbox_events set status='PUBLISHED',published_at=now(),last_error=null where event_id=?",row.get("event_id"));
   }catch(Exception ex){int attempts=((Number)row.get("attempts")).intValue()+1;String error=ex instanceof org.springframework.web.client.RestClientResponseException response?"DELIVERY_HTTP_"+response.getStatusCode().value():"DELIVERY_"+ex.getClass().getSimpleName();jdbc.update("update encounter_v2.outbox_events set attempts=?,status=?,next_attempt_at=now()+(? * interval '1 second'),last_error=? where event_id=?",attempts,attempts>=5?"DLQ":"PENDING",Math.min(900,1<<Math.min(attempts,9)),error,row.get("event_id"));}
  }
 }
}
