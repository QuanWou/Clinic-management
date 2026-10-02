package com.clinic.v2;
import com.clinic.v2.integration.SearchProjectionRelay;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import com.sun.net.httpserver.HttpServer;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.atomic.*;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties={"clinic.security.iam-service-secret=synthetic-clinic-to-iam-secret-more-than-32-bytes","clinic.security.iam-directory-secret=synthetic-iam-to-clinic-secret-more-than-32-bytes"})
@EnabledIfSystemProperty(named="clinic.it.enabled",matches="true")
class ProjectionOutboxPostgresTest {
 @DynamicPropertySource static void database(DynamicPropertyRegistry r){S1Postgres.configure(r);}
 @Autowired JdbcTemplate jdbc;@Autowired PlatformTransactionManager manager;@Autowired ObjectMapper json;
 UUID clinic=UUID.randomUUID(),branch=UUID.randomUUID();
 void seed(){jdbc.execute("select set_config('app.access_mode','system',true)");jdbc.queryForObject("select set_config('app.clinic_id',?,true)",String.class,clinic.toString());
 jdbc.update("insert into clinic.clinics(id,owner_user_id,slug,name) values(?,?,?,?)",clinic,UUID.randomUUID(),"synthetic-"+clinic,"Synthetic Clinic");
 jdbc.update("insert into clinic.branches(id,clinic_id,name,address,opening_hours) values(?,?,?,?,?)",branch,clinic,"Synthetic branch","Synthetic address","08-17");
 }
 @Test void businessRollbackDoesNotLeaveOutboxAndSnapshotIsPublicOnly(){
  var tx=new TransactionTemplate(manager);
  int before=jdbc.queryForObject("select count(*) from clinic.projection_outbox",Integer.class);
  assertThrows(IllegalStateException.class,()->tx.execute(s->{seed();throw new IllegalStateException("Synthetic rollback");}));
  assertEquals(before,jdbc.queryForObject("select count(*) from clinic.projection_outbox",Integer.class));
  tx.execute(s->{seed();return null;});
  assertTrue(jdbc.queryForObject("select count(*) from clinic.projection_outbox where clinic_id=?",Integer.class,clinic)>0);
  String snapshot=jdbc.queryForObject("select clinic.public_projection(?)::text",String.class,clinic);
  assertTrue(snapshot.contains("Synthetic"));assertFalse(snapshot.contains("contact"));assertFalse(snapshot.contains("registration_code"));assertFalse(snapshot.contains("created_by"));
 }
 @Test void failedHttpRetriesThenAcknowledgesWithStableEventId()throws Exception{
  var tx=new TransactionTemplate(manager);tx.execute(s->{seed();return null;});
  // Isolate this fixture from the other test's pending rows.
  jdbc.update("update clinic.projection_outbox set status='PUBLISHED' where clinic_id<>?",clinic);
  var attempts=new AtomicInteger();var ids=new ArrayList<String>();var body=new AtomicReference<String>();
  var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
  server.createContext("/api/v2/internal/projections/snapshot",exchange->{
   String text=new String(exchange.getRequestBody().readAllBytes(),StandardCharsets.UTF_8);body.set(text);
   synchronized(ids){ids.add(json.readTree(text).path("eventId").asText());}
   assertTrue(exchange.getRequestHeaders().getFirst("Authorization").startsWith("Bearer "));
   exchange.sendResponseHeaders(attempts.incrementAndGet()==1?503:200,-1);exchange.close();
  });server.start();
  try{
   var relay=new SearchProjectionRelay(jdbc,json,"http://127.0.0.1:"+server.getAddress().getPort(),"synthetic-projection-relay-secret-at-least-32-bytes");
   tx.execute(s->{relay.deliver();return null;});
   jdbc.update("update clinic.projection_outbox set next_attempt_at=now() where clinic_id=?",clinic);
   tx.execute(s->{relay.deliver();return null;});
   assertEquals(0,jdbc.queryForObject("select count(*) from clinic.projection_outbox where clinic_id=? and status='PENDING'",Integer.class,clinic));
   assertTrue(ids.size()>1);assertEquals(ids.getFirst(),ids.getLast());
   var delivery=json.readTree(body.get());assertEquals(delivery.path("eventId").asText(),delivery.path("event").path("id").asText());
   assertEquals("clinic.clinic.public_changed.v1",delivery.path("event").path("type").asText());
  }finally{server.stop(0);}
 }
}

