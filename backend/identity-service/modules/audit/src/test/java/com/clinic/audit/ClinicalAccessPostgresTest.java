package com.clinic.audit;
import com.clinic.audit.api.*;
import com.clinic.audit.api.AuditDto.*;
import com.clinic.audit.security.WorkloadPrincipal;
import com.clinic.audit.service.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
@SpringBootTest @EnabledIfSystemProperty(named="audit.it.enabled",matches="true")
class ClinicalAccessPostgresTest {
 @DynamicPropertySource static void db(DynamicPropertyRegistry r){S1Postgres.configure(r);}
 @Autowired ClinicalAccessConsumer consumer;@Autowired AuditService audit;@Autowired JdbcTemplate jdbc;
 EventEnvelopeInput event(String source,UUID resource,Map<String,Object> data){return new EventEnvelopeInput("1.0",UUID.randomUUID(),"/services/"+source,"clinic."+source+".access_recorded.v1","clinical-access/"+resource,Instant.now(),"application/json",UUID.randomUUID(),UUID.randomUUID(),UUID.randomUUID().toString(),null,1,data);}
 @Test void deniedAndSuccessfulReadUseSecurityChainAndStableReplay(){
  for(String source:List.of("medical","encounter")){UUID resource=UUID.randomUUID();var input=event(source,resource,Map.of("resourceId",resource.toString(),"actorUserId",UUID.randomUUID().toString(),"operation",source.equals("medical")?"READ_DRAFT":"READ_ENCOUNTER","outcome","DENIED"));var peer=new WorkloadPrincipal(source+"-service",Set.of("audit.write"));assertTrue(consumer.accept(peer,input));assertFalse(consumer.accept(peer,input));assertEquals(1,jdbc.queryForObject("select count(*) from audit_v2.audit_events where action=? and resource_id=? and outcome='DENIED' and category='SECURITY'",Integer.class,input.type(),resource.toString()));assertTrue(audit.verify(input.clinicid()).valid());}
 }
 @Test void forgedSourcePhiAndUnboundedActionNeverEnterInbox(){
  UUID resource=UUID.randomUUID();var data=new HashMap<String,Object>(Map.of("resourceId",resource.toString(),"actorUserId",UUID.randomUUID().toString(),"operation","READ_DRAFT","outcome","SUCCESS"));var medical=new WorkloadPrincipal("medical-service",Set.of("audit.write"));assertThrows(ApiProblem.class,()->consumer.accept(medical,event("encounter",resource,data)));data.put("diagnosis","Synthetic confidential");assertThrows(ApiProblem.class,()->consumer.accept(medical,event("medical",resource,data)));data.remove("diagnosis");data.put("operation","Synthetic arbitrary text");assertThrows(ApiProblem.class,()->consumer.accept(medical,event("medical",resource,data)));data.put("operation","CARE_MUTATION");assertThrows(ApiProblem.class,()->consumer.accept(medical,event("medical",resource,data)));assertEquals(0,jdbc.queryForObject("select count(*) from audit_v2.audit_events where resource_id=?",Integer.class,resource.toString()));
 }
}
