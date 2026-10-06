package com.clinic.medical.service;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.function.Supplier;
@Configuration @EnableScheduling @ConditionalOnProperty(name="medical.charges.enabled",havingValue="true")
public class BillingChargeRelay{
 private final JdbcTemplate jdbc;private final TransactionTemplate tx;private final javax.crypto.SecretKey key;private final RestClient billing;private final ObjectMapper json;
 public BillingChargeRelay(JdbcTemplate jdbc,PlatformTransactionManager manager,ObjectMapper json,@Value("${medical.security.service-secret}") String secret,@Value("${medical.charges.billing-url:http://127.0.0.1:8103}") String url){this.jdbc=jdbc;this.json=json;tx=new TransactionTemplate(manager);key=Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));var f=new SimpleClientHttpRequestFactory();f.setConnectTimeout(Duration.ofSeconds(2));f.setReadTimeout(Duration.ofSeconds(2));billing=RestClient.builder().baseUrl(url).requestFactory(f).build();}
 private <T>T local(Supplier<T> body){return tx.execute(t->{jdbc.execute("select set_config('app.medical_mode','charge-relay',true)");return body.get();});}
 public record Claim(UUID event,UUID lease,String payload,int attempts){}
 public record Ack(UUID eventId,boolean received){}
 public Claim claim(){return local(()->{var rows=jdbc.queryForList("select * from medical_v2.billing_deliveries where (status='PENDING' and next_attempt_at<=now()) or (status='CLAIMED' and lease_until<=now()) order by created_at,event_id limit 1 for update skip locked");if(rows.isEmpty())return null;var r=rows.getFirst();UUID event=(UUID)r.get("event_id"),lease=UUID.randomUUID();jdbc.update("update medical_v2.billing_deliveries set status='CLAIMED',lease_token=?,lease_until=now()+interval '30 seconds' where event_id=?",lease,event);return new Claim(event,lease,r.get("payload_json").toString(),((Number)r.get("attempts")).intValue());});}
 public void deliver(Claim job){
  try{if(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive())throw new IllegalStateException("Billing event HTTP must be outside source transaction");var now=Instant.now();String token=Jwts.builder().issuer("medical-service").subject("medical-service").audience().add("billing-service").and().id(UUID.randomUUID().toString()).claim("token_type","workload").claim("scopes",List.of("billing.charge.consume")).issuedAt(Date.from(now)).expiration(Date.from(now.plusSeconds(30))).signWith(key).compact();
   var ack=billing.post().uri("/api/internal/charges/events").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).body(json.readTree(job.payload())).retrieve().body(Ack.class);if(ack==null||!job.event().equals(ack.eventId()))throw new IllegalStateException("Billing inbox acknowledgement mismatch");
   local(()->jdbc.update("update medical_v2.billing_deliveries set status='PUBLISHED',lease_token=null,lease_until=null,published_at=now(),last_error=null where event_id=? and lease_token=? and status='CLAIMED'",job.event(),job.lease()));
  }catch(Exception ex){int attempts=job.attempts()+1;local(()->jdbc.update("update medical_v2.billing_deliveries set status=?,attempts=?,lease_token=null,lease_until=null,last_error='BILLING_INBOX_DELIVERY_FAILURE',next_attempt_at=now()+(? * interval '1 second') where event_id=? and lease_token=? and status='CLAIMED'",attempts>=8?"DLQ":"PENDING",attempts,Math.min(900,1<<Math.min(attempts,9)),job.event(),job.lease()));}
 }
 @Scheduled(fixedDelayString="${medical.charges.delay-ms:1000}")public void run(){for(int i=0;i<5;i++){var job=claim();if(job==null)return;deliver(job);}}
}
