package com.clinic.audit;
import com.clinic.audit.api.AuditDto.EventEnvelopeInput;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.*;
import org.springframework.http.*;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.time.Instant;
import java.nio.charset.StandardCharsets;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties={"audit.security.billing-secret=synthetic-billing-http-audit-secret-more-than-32-bytes"})
@EnabledIfSystemProperty(named="audit.it.enabled",matches="true")
class BillingAuditHttpPostgresTest{
 @DynamicPropertySource static void db(DynamicPropertyRegistry r){S1Postgres.configure(r);}
 @Autowired TestRestTemplate http;
 @LocalServerPort int port;@Autowired ObjectMapper json;
 String token(String issuer,String scope){Instant n=Instant.now();return Jwts.builder().issuer(issuer).subject(issuer).audience().add("audit-service").and().id(UUID.randomUUID().toString()).claim("token_type","workload").claim("scopes",List.of(scope)).issuedAt(Date.from(n)).expiration(Date.from(n.plusSeconds(30))).signWith(Keys.hmacShaKeyFor("synthetic-billing-http-audit-secret-more-than-32-bytes".getBytes(StandardCharsets.UTF_8))).compact();}
 EventEnvelopeInput event(Map<String,Object> data,UUID encounter){return new EventEnvelopeInput("1.0",UUID.randomUUID(),"/services/billing","clinic.billing.bill_issued.v1","billing/"+encounter,Instant.now(),"application/json",UUID.randomUUID(),UUID.randomUUID(),UUID.randomUUID().toString(),null,2,data);}
 java.net.http.HttpResponse<String> send(String bearer,EventEnvelopeInput e){try{var request=java.net.http.HttpRequest.newBuilder(java.net.URI.create("http://127.0.0.1:"+port+"/api/internal/audit/billing-events")).header("Authorization","Bearer "+bearer).header("Content-Type","application/json").POST(java.net.http.HttpRequest.BodyPublishers.ofString(json.writeValueAsString(e))).build();return java.net.http.HttpClient.newHttpClient().send(request,java.net.http.HttpResponse.BodyHandlers.ofString());}catch(Exception x){throw new IllegalStateException(x);}}
 @Test void exactBillingRouteAcceptsTrustedWorkloadAndReplayHasNoEffect(){
  UUID e=UUID.randomUUID();var input=event(Map.of("billingId",e.toString(),"resourceId",UUID.randomUUID().toString(),"actorUserId",UUID.randomUUID().toString()),e);var token=token("billing-service","audit.write");var first=send(token,input);assertEquals(200,first.statusCode());assertEquals("true",first.body());var replay=send(token,input);assertEquals(200,replay.statusCode());assertEquals("false",replay.body());
 }
 @Test void notificationRecoveryIsAuditedWithOnlyResourceAndActorIdentifiers(){
  UUID id=UUID.randomUUID();var input=new EventEnvelopeInput("1.0",UUID.randomUUID(),"/services/billing","clinic.billing.notification_retry_requested.v1","billing/"+id,Instant.now(),"application/json",UUID.randomUUID(),UUID.randomUUID(),UUID.randomUUID().toString(),null,2,Map.of("billingId",id.toString(),"resourceId",id.toString(),"actorUserId",UUID.randomUUID().toString()));assertEquals(200,send(token("billing-service","audit.write"),input).statusCode());assertEquals("false",send(token("billing-service","audit.write"),input).body());
 }
 @Test void wrongScopeIssuerAndPrivateResultAreRejectedThroughActualFilter(){
  UUID e=UUID.randomUUID();var data=new HashMap<String,Object>(Map.of("billingId",e.toString(),"resourceId",UUID.randomUUID().toString(),"actorUserId",UUID.randomUUID().toString()));assertEquals(403,send(token("billing-service","audit.read"),event(data,e)).statusCode());assertEquals(401,send(token("untrusted","audit.write"),event(data,e)).statusCode());data.put("result_text","Synthetic confidential result");assertEquals(422,send(token("billing-service","audit.write"),event(data,e)).statusCode());
 }
 @Test void onlineCollectionEventIsAcceptedOnceWithIdentifierOnlyEnvelope(){UUID bill=UUID.randomUUID();var input=new EventEnvelopeInput("1.0",UUID.randomUUID(),"/services/billing","clinic.billing.online_collected.v1","billing/"+bill,Instant.now(),"application/json",UUID.randomUUID(),UUID.randomUUID(),UUID.randomUUID().toString(),null,3,Map.of("billingId",bill.toString(),"resourceId",UUID.randomUUID().toString(),"actorUserId",UUID.randomUUID().toString()));assertEquals(200,send(token("billing-service","audit.write"),input).statusCode());assertEquals("false",send(token("billing-service","audit.write"),input).body());}

}
