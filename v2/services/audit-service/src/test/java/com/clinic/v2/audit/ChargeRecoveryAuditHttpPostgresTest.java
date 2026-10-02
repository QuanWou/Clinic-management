package com.clinic.v2.audit;
import com.clinic.v2.audit.api.AuditDto.EventEnvelopeInput;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.time.Instant;
import java.nio.charset.StandardCharsets;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties={"audit.security.billing-secret=synthetic-recovery-audit-secret-at-least-32-bytes","audit.security.medical-secret=synthetic-recovery-audit-secret-at-least-32-bytes","audit.security.encounter-secret=synthetic-recovery-audit-secret-at-least-32-bytes"})
@EnabledIfSystemProperty(named="audit.it.enabled",matches="true")
class ChargeRecoveryAuditHttpPostgresTest{
 @DynamicPropertySource static void db(DynamicPropertyRegistry r){S1Postgres.configure(r);}
 @LocalServerPort int port;@Autowired ObjectMapper json;
 @Test void eachRecoveryProducerHasScopedMetadataOnlyAuditWithReplayAndPrivateDataDenial()throws Exception{
  for(String producer:List.of("billing","medical","encounter")){
   UUID aggregate=UUID.randomUUID();var data=new LinkedHashMap<String,Object>();data.put("actorUserId",UUID.randomUUID().toString());data.put("billing".equals(producer)?"billingId":"encounterId",aggregate.toString());
   if("encounter".equals(producer)){data.put("patientRef",UUID.randomUUID().toString());data.put("status","CLINICALLY_COMPLETED");}else data.put("resourceId",UUID.randomUUID().toString());
   Instant now=Instant.now();String token=Jwts.builder().issuer(producer+"-v2-service").subject(producer+"-v2-service").audience().add("audit-v2-service").and().id(UUID.randomUUID().toString()).claim("token_type","workload").claim("scopes",List.of("audit.write")).issuedAt(Date.from(now)).expiration(Date.from(now.plusSeconds(30))).signWith(Keys.hmacShaKeyFor("synthetic-recovery-audit-secret-at-least-32-bytes".getBytes(StandardCharsets.UTF_8))).compact();
   var event=new EventEnvelopeInput("1.0",UUID.randomUUID(),"/services/"+producer,"clinic."+producer+"."+("billing".equals(producer)?"charge":"billing")+"_retry_requested.v1",("billing".equals(producer)?"billing/":"encounter/")+aggregate,now,"application/json",UUID.randomUUID(),UUID.randomUUID(),UUID.randomUUID().toString(),null,2,data);
   var client=java.net.http.HttpClient.newHttpClient();var request=java.net.http.HttpRequest.newBuilder(java.net.URI.create("http://127.0.0.1:"+port+"/api/v2/internal/audit/"+producer+"-events")).header("Authorization","Bearer "+token).header("Content-Type","application/json").POST(java.net.http.HttpRequest.BodyPublishers.ofString(json.writeValueAsString(event))).build();
   var first=client.send(request,java.net.http.HttpResponse.BodyHandlers.ofString());assertEquals(200,first.statusCode());var accepted=json.readTree(first.body());assertTrue(accepted.isBoolean()?accepted.asBoolean():accepted.path("applied").asBoolean());var replay=json.readTree(client.send(request,java.net.http.HttpResponse.BodyHandlers.ofString()).body());assertFalse(replay.isBoolean()?replay.asBoolean():replay.path("applied").asBoolean());
   data.put("diagnosis","Synthetic confidential");var privateRequest=java.net.http.HttpRequest.newBuilder(request.uri()).header("Authorization","Bearer "+token).header("Content-Type","application/json").POST(java.net.http.HttpRequest.BodyPublishers.ofString(json.writeValueAsString(event))).build();assertEquals(422,client.send(privateRequest,java.net.http.HttpResponse.BodyHandlers.ofString()).statusCode());
  }
 }
}
