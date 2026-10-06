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
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties={"audit.security.medical-secret=synthetic-medical-http-audit-secret-more-than-32-bytes"})
@EnabledIfSystemProperty(named="audit.it.enabled",matches="true")
class MedicalAuditHttpPostgresTest{
 @DynamicPropertySource static void db(DynamicPropertyRegistry r){S1Postgres.configure(r);}
 @Autowired TestRestTemplate http;
 @LocalServerPort int port;@Autowired ObjectMapper json;
 String token(String issuer,String scope){Instant n=Instant.now();return Jwts.builder().issuer(issuer).subject(issuer).audience().add("audit-service").and().id(UUID.randomUUID().toString()).claim("token_type","workload").claim("scopes",List.of(scope)).issuedAt(Date.from(n)).expiration(Date.from(n.plusSeconds(30))).signWith(Keys.hmacShaKeyFor("synthetic-medical-http-audit-secret-more-than-32-bytes".getBytes(StandardCharsets.UTF_8))).compact();}
 EventEnvelopeInput event(Map<String,Object> data,UUID encounter){return new EventEnvelopeInput("1.0",UUID.randomUUID(),"/services/medical","clinic.medical.result_reviewed.v1","encounter/"+encounter,Instant.now(),"application/json",UUID.randomUUID(),UUID.randomUUID(),UUID.randomUUID().toString(),null,2,data);}
 java.net.http.HttpResponse<String> send(String bearer,EventEnvelopeInput e){try{var request=java.net.http.HttpRequest.newBuilder(java.net.URI.create("http://127.0.0.1:"+port+"/api/internal/audit/medical-events")).header("Authorization","Bearer "+bearer).header("Content-Type","application/json").POST(java.net.http.HttpRequest.BodyPublishers.ofString(json.writeValueAsString(e))).build();return java.net.http.HttpClient.newHttpClient().send(request,java.net.http.HttpResponse.BodyHandlers.ofString());}catch(Exception x){throw new IllegalStateException(x);}}
 @Test void exactMedicalRouteAcceptsTrustedWorkloadAndReplayHasNoEffect(){
  UUID e=UUID.randomUUID();var input=event(Map.of("encounterId",e.toString(),"resourceId",UUID.randomUUID().toString(),"actorUserId",UUID.randomUUID().toString()),e);var token=token("medical-service","audit.write");var first=send(token,input);assertEquals(200,first.statusCode());assertEquals("true",first.body());var replay=send(token,input);assertEquals(200,replay.statusCode());assertEquals("false",replay.body());
 }
 @Test void wrongScopeIssuerAndPrivateResultAreRejectedThroughActualFilter(){
  UUID e=UUID.randomUUID();var data=new HashMap<String,Object>(Map.of("encounterId",e.toString(),"resourceId",UUID.randomUUID().toString(),"actorUserId",UUID.randomUUID().toString()));assertEquals(403,send(token("medical-service","audit.read"),event(data,e)).statusCode());assertEquals(401,send(token("untrusted","audit.write"),event(data,e)).statusCode());data.put("result_text","Synthetic confidential result");assertEquals(422,send(token("medical-service","audit.write"),event(data,e)).statusCode());
 }
}
