package com.clinic.v2.notification;
import com.clinic.v2.notification.api.ApiProblem;
import com.clinic.v2.notification.security.Actor;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import org.springframework.http.*;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties={"notification.security.billing-secret=synthetic-billing-notification-secret-at-least-32-bytes","notification.security.appointment-secret=synthetic-appointment-notification-secret-at-least-32-bytes","notification.reminder-delay-ms=3600000"})
@EnabledIfSystemProperty(named="notification.it.enabled",matches="true")
class FinancialNotificationPostgresTest{
 @DynamicPropertySource static void db(DynamicPropertyRegistry r){S1Postgres.configure(r);}
 @Autowired FinancialNotificationService service;@Autowired NotificationService notifications;@Autowired ObjectMapper json;@Autowired JdbcTemplate jdbc;@Autowired TestRestTemplate http;
 @BeforeEach void httpTransport(){http.getRestTemplate().setRequestFactory(new org.springframework.http.client.JdkClientHttpRequestFactory());}
 UUID user=UUID.randomUUID(),clinic=UUID.randomUUID(),bill=UUID.randomUUID();
 ObjectNode event(){var e=json.createObjectNode().put("specversion","1.0").put("id",UUID.randomUUID().toString()).put("source","/services/billing").put("type","clinic.billing.onsite_collected.v1").put("subject","billing/"+bill).put("time",Instant.now().toString()).put("datacontenttype","application/json").put("clinicid",clinic.toString()).put("branchid",UUID.randomUUID().toString()).put("correlationid",UUID.randomUUID().toString()).put("aggregateversion",2);e.putObject("data").put("billingId",bill.toString()).put("resourceId",UUID.randomUUID().toString()).put("recipientUserId",user.toString());return e;}
 @Test void concurrentReplayCreatesOneSafeUserOwnedFinancialNotification()throws Exception{
  var event=event();var pool=Executors.newFixedThreadPool(6);try{var futures=new ArrayList<Future<Boolean>>();for(int i=0;i<12;i++)futures.add(pool.submit(()->service.ingest(event).applied()));int applied=0;for(var f:futures)if(f.get(20,TimeUnit.SECONDS))applied++;assertEquals(1,applied);}finally{pool.shutdownNow();}
  var mine=notifications.mine(new Actor(user,Set.of()));assertEquals(1,mine.size());assertEquals("PAYMENT_RECORDED",mine.getFirst().get("kind"));assertNull(mine.getFirst().get("appointment_id"));assertEquals(bill,mine.getFirst().get("billing_id"));assertTrue(mine.getFirst().get("message").toString().contains("biên nhận nội bộ"));assertFalse(mine.getFirst().get("message").toString().contains(user.toString()));assertTrue(notifications.mine(new Actor(UUID.randomUUID(),Set.of())).isEmpty());assertEquals(0,jdbc.queryForObject("select count(*) from notification_v2.financial_event_inbox",Integer.class));
 }
 @Test void changedReplayOrExtraClinicalFinancialContactFieldsAreRejectedWithoutAdditionalEffect(){
  var e=event();service.ingest(e);var changed=e.deepCopy();((ObjectNode)changed.path("data")).put("recipientUserId",UUID.randomUUID().toString());assertThrows(ApiProblem.class,()->service.ingest(changed));
  for(String field:List.of("diagnosis","amountVnd","name","phone","actorUserId","externalRef")){var prohibited=event();((ObjectNode)prohibited.path("data")).put(field,"Synthetic prohibited detail");assertThrows(ApiProblem.class,()->service.ingest(prohibited));}
  var old=e.deepCopy();old.put("aggregateversion",1);assertThrows(ApiProblem.class,()->service.ingest(old));assertEquals(1,notifications.mine(new Actor(user,Set.of())).size());
 }
 String bearer(String issuer,String audience,String scope,String secret){var now=Instant.now();return "Bearer "+Jwts.builder().issuer(issuer).subject(issuer).audience().add(audience).and().id(UUID.randomUUID().toString()).claim("token_type","workload").claim("scopes",List.of(scope)).issuedAt(Date.from(now)).expiration(Date.from(now.plusSeconds(30))).signWith(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8))).compact();}
 ResponseEntity<String> post(String path,String bearer,ObjectNode event){var h=new HttpHeaders();h.setContentType(MediaType.APPLICATION_JSON);h.set("Authorization",bearer);return http.postForEntity(path,new HttpEntity<>(event,h),String.class);}
 @Test void billingHttpEndpointRequiresDedicatedIssuerAudienceScopeAndExactEnvelope(){
  String secret="synthetic-billing-notification-secret-at-least-32-bytes",path="/api/v2/internal/notifications/billing-events";var e=event();String token=bearer("billing-v2-service","notification-v2-service","notification.billing.consume",secret);
  assertEquals(200,post(path,token,e).getStatusCode().value());assertEquals(200,post(path,token,e).getStatusCode().value());
  assertEquals(401,post(path,bearer("other","notification-v2-service","notification.billing.consume",secret),e).getStatusCode().value());assertEquals(401,post(path,bearer("billing-v2-service","other","notification.billing.consume",secret),e).getStatusCode().value());
  assertEquals(403,post(path,bearer("appointment-service","notification-v2-service","notification.consume","synthetic-appointment-notification-secret-at-least-32-bytes"),e).getStatusCode().value());
  assertEquals(403,post("/api/v2/internal/notifications/events",token,e).getStatusCode().value());var bad=event();((ObjectNode)bad.path("data")).put("diagnosis","Synthetic confidential");assertEquals(400,post(path,token,bad).getStatusCode().value());assertEquals(1,notifications.mine(new Actor(user,Set.of())).size());
 }
}
