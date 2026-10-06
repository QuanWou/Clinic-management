package com.clinic.doctor.integration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.time.*;
import java.util.*;
import java.nio.charset.StandardCharsets;
/** Leases commit before HTTP. Consumer effects are scoped and replay safe. */
@Configuration @EnableScheduling
@ConditionalOnProperty(name="absence.relay.enabled",havingValue="true")
public class AbsenceDeliveryRelay {
 private final JdbcTemplate jdbc;private final TransactionTemplate tx;private final RestClient client;private final javax.crypto.SecretKey key;
 public AbsenceDeliveryRelay(JdbcTemplate jdbc,PlatformTransactionManager manager,@Value("${absence.relay.appointment-url:http://127.0.0.1:8099}") String url,@Value("${absence.relay.secret}") String secret){this.jdbc=jdbc;tx=new TransactionTemplate(manager);key=Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));var f=new SimpleClientHttpRequestFactory();f.setConnectTimeout(Duration.ofSeconds(2));f.setReadTimeout(Duration.ofSeconds(3));client=RestClient.builder().baseUrl(url).requestFactory(f).build();}
 public record Delivery(UUID eventId,UUID id,UUID clinicId,UUID branchId,UUID doctorId,Instant startsAt,Instant endsAt,long version,String state,UUID actorUserId){}
 public record Reply(boolean complete){}
 @Scheduled(fixedDelayString="${absence.relay.delay-ms:1000}") public void deliver(){
  UUID lease=UUID.randomUUID();var rows=tx.execute(s->{var due=jdbc.queryForList("select * from doctor.absence_deliveries where (status='PENDING' and next_attempt_at<=now()) or (status='CLAIMED' and lease_until<now()) order by created_at,event_id limit 3 for update skip locked");for(var row:due)jdbc.update("update doctor.absence_deliveries set status='CLAIMED',lease_id=?,lease_until=now()+interval '30 seconds' where event_id=?",lease,row.get("event_id"));return due;});
  for(var row:rows){UUID event=(UUID)row.get("event_id");boolean complete=false;String error=null;
   try{var now=Instant.now();String token=Jwts.builder().issuer("doctor-service").subject("doctor-service").audience().add("appointment-service").and().id(UUID.randomUUID().toString()).claim("token_type","workload").claim("scopes",List.of("appointment.absence.consume")).issuedAt(Date.from(now)).expiration(Date.from(now.plusSeconds(30))).signWith(key).compact();
    var body=new Delivery(event,(UUID)row.get("absence_id"),(UUID)row.get("clinic_id"),(UUID)row.get("branch_id"),(UUID)row.get("doctor_id"),((java.sql.Timestamp)row.get("starts_at")).toInstant(),((java.sql.Timestamp)row.get("ends_at")).toInstant(),((Number)row.get("source_version")).longValue(),(String)row.get("source_state"),(UUID)row.get("actor_user_id"));
    var reply=client.post().uri("/api/internal/doctor-absences").header("Authorization","Bearer "+token).body(body).retrieve().body(Reply.class);if(reply==null)throw new IllegalStateException("Missing acknowledgement");complete=reply.complete();
   }catch(Exception e){error="DELIVERY_FAILED";}
   final boolean done=complete;final String failure=error;tx.execute(s->{int attempts=((Number)row.get("attempts")).intValue()+(failure==null?0:1);jdbc.update("update doctor.absence_deliveries set status=?,attempts=?,next_attempt_at=now()+(? * interval '1 second'),lease_id=null,lease_until=null,last_error=? where event_id=? and lease_id=?",done?"PUBLISHED":attempts>=8?"DLQ":"PENDING",attempts,failure==null?1:Math.min(300,1<<Math.min(attempts,8)),failure,event,lease);return null;});
  }
 }
}
