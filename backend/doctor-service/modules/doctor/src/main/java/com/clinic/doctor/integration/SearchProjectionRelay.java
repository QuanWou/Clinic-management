package com.clinic.doctor.integration;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import java.time.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** At-least-once delivery. Search commits its inbox and projection before responding. */
@Configuration
@EnableScheduling
@ConditionalOnProperty(name="projection.relay.enabled",havingValue="true")
public class SearchProjectionRelay {
 private final JdbcTemplate jdbc; private final ObjectMapper json; private final RestClient client; private final byte[] secret;
 public SearchProjectionRelay(JdbcTemplate jdbc,ObjectMapper json,@Value("${projection.relay.search-url:http://127.0.0.1:8097}") String url,
   @Value("${projection.relay.secret:}") String secret){
  this.jdbc=jdbc;this.json=json;this.secret=secret.getBytes(StandardCharsets.UTF_8);
  if(this.secret.length<32)throw new IllegalArgumentException("Projection relay secret must be at least 32 bytes");
  var factory=new SimpleClientHttpRequestFactory();factory.setConnectTimeout(Duration.ofSeconds(2));factory.setReadTimeout(Duration.ofSeconds(2));
  client=RestClient.builder().baseUrl(url).requestFactory(factory).build();
 }
 @Scheduled(fixedDelayString="${projection.relay.refresh-ms:60000}")
 @Transactional public void refresh(){jdbc.execute("select doctor.refresh_projection_time_boundaries()");}
 @Scheduled(fixedDelayString="${projection.relay.delay-ms:1000}")
 @Transactional(isolation=Isolation.REPEATABLE_READ)
 public void deliver(){
  var due=jdbc.queryForList("select * from doctor.projection_outbox where status='PENDING' and next_attempt_at<=now() order by sequence_id limit 5 for update skip locked");
  for(var row:due){
   long id=((Number)row.get("sequence_id")).longValue();
   try{
    UUID clinic=(UUID)row.get("clinic_id");UUID event=(UUID)row.get("event_id");
    long version=jdbc.queryForObject("select max(sequence_id) from doctor.projection_outbox where clinic_id=?",Long.class,clinic);
    String payload=jdbc.queryForObject("select doctor.public_projection(?)::text",String.class,clinic);
    if(payload==null)throw new IllegalStateException("Snapshot missing");
    ObjectNode envelope=json.createObjectNode();envelope.put("eventId",event.toString());envelope.put("clinicId",clinic.toString());envelope.put("sourceVersion",version);
    var snapshot=json.readTree(payload);
    envelope.set("snapshot",snapshot);
    ObjectNode invalidation=json.createObjectNode();invalidation.put("specversion","1.0");invalidation.put("id",event.toString());
    invalidation.put("source","/services/doctor");invalidation.put("type","clinic.doctor.public_changed.v1");
    invalidation.put("subject","clinic/"+clinic);invalidation.put("time",((java.sql.Timestamp)row.get("created_at")).toInstant().toString());
    invalidation.put("datacontenttype","application/json");invalidation.put("clinicid",clinic.toString());invalidation.put("correlationid",event.toString());invalidation.put("aggregateversion",id);
    invalidation.set("data",json.createObjectNode().put("clinicId",clinic.toString()));envelope.set("event",invalidation);
    Instant now=Instant.now();
    String token=Jwts.builder().issuer("doctor-service").subject("doctor-service").audience().add("search-service").and()
      .id(UUID.randomUUID().toString()).claim("token_type","workload").claim("scopes",List.of("search.project"))
      .issuedAt(Date.from(now)).expiration(Date.from(now.plusSeconds(30))).signWith(Keys.hmacShaKeyFor(secret)).compact();
    client.post().uri("/api/internal/projections/snapshot").header("Authorization","Bearer "+token).body(envelope).retrieve().toBodilessEntity();
    jdbc.update("update doctor.projection_outbox set status='PUBLISHED',published_at=now(),last_error=null where sequence_id=?",id);
   }catch(Exception failure){
    int attempts=((Number)row.get("attempts")).intValue()+1;
    jdbc.update("update doctor.projection_outbox set attempts=?,status=?,next_attempt_at=now()+(? * interval '1 second'),last_error='DELIVERY_FAILED' where sequence_id=?",
      attempts,attempts>=5?"DEAD_LETTER":"PENDING",Math.min(900,1<<Math.min(attempts,9)),id);
   }
  }
 }
}

