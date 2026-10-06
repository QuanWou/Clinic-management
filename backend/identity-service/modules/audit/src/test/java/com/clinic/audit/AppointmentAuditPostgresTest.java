package com.clinic.audit;
import com.clinic.audit.api.AuditDto.*;
import com.clinic.audit.api.ApiProblem;
import com.clinic.audit.security.WorkloadPrincipal;
import com.clinic.audit.service.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.*;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
@SpringBootTest
@EnabledIfSystemProperty(named="audit.it.enabled",matches="true")
class AppointmentAuditPostgresTest{
 @DynamicPropertySource static void db(DynamicPropertyRegistry r){S1Postgres.configure(r);}
 @Autowired AppointmentAuditConsumer consumer;@Autowired AuditService audit;
 @Autowired EncounterAuditConsumer encounters;
 UUID clinic=UUID.randomUUID(),actor=UUID.randomUUID(),appointment=UUID.randomUUID();
 WorkloadPrincipal principal=new WorkloadPrincipal("appointment-service",Set.of("audit.write"));
 EventEnvelopeInput event(Map<String,Object> data){return new EventEnvelopeInput("1.0",UUID.randomUUID(),"/services/appointment","clinic.appointment.confirmed.v1","appointment/"+appointment,Instant.now(),"application/json",clinic,null,UUID.randomUUID().toString(),null,1,data);}
 @Test void inboxAndHashChainAppendCommitTogetherAndReplayDoesNotAppend(){
  var e=event(Map.of("appointmentId",appointment.toString(),"actorUserId",actor.toString(),"status","CONFIRMED"));
  assertTrue(consumer.accept(principal,e));assertFalse(consumer.accept(principal,e));assertEquals(1,audit.trace(e.correlationid()).size());assertTrue(audit.verify(clinic).valid());
 }
 @Test void encounterInboxDeduplicatesAndRejectsPHI(){
  UUID branch=UUID.randomUUID(),visit=UUID.randomUUID();var data=Map.<String,Object>of("encounterId",visit.toString(),"patientRef",UUID.randomUUID().toString(),"actorUserId",actor.toString(),"status","WAITING");
  var e=new EventEnvelopeInput("1.0",UUID.randomUUID(),"/services/encounter","clinic.encounter.checked_in.v1","encounter/"+visit,Instant.now(),"application/json",clinic,branch,UUID.randomUUID().toString(),null,1,data);var p=new WorkloadPrincipal("encounter-service",Set.of("audit.write"));
  assertTrue(encounters.accept(p,e));assertFalse(encounters.accept(p,e));assertEquals(1,audit.trace(e.correlationid()).size());assertTrue(audit.verify(clinic).valid());
  var forbidden=new HashMap<>(data);forbidden.put("fullName","Synthetic prohibited");var bad=new EventEnvelopeInput("1.0",UUID.randomUUID(),e.source(),e.type(),e.subject(),e.time(),e.datacontenttype(),clinic,branch,e.correlationid(),null,2,forbidden);assertThrows(ApiProblem.class,()->encounters.accept(p,bad));
 }
 @Test void rejectsOtherProducerAndPHI(){
  var safe=event(Map.of("appointmentId",appointment.toString(),"actorUserId",actor.toString()));
  assertThrows(ApiProblem.class,()->consumer.accept(new WorkloadPrincipal("clinic-service",Set.of("audit.write")),safe));
  var phi=event(Map.of("appointmentId",appointment.toString(),"actorUserId",actor.toString(),"diagnosis","Synthetic prohibited"));
  assertThrows(ApiProblem.class,()->consumer.accept(principal,phi));assertTrue(audit.trace(phi.correlationid()).isEmpty());
 }
 @Test void careEventsAreDeduplicatedAndCannotClaimCompletionOrExposeReason(){
  var p=new WorkloadPrincipal("encounter-service",Set.of("audit.write"));UUID visit=UUID.randomUUID(),branch=UUID.randomUUID();
  for(String type:List.of("clinic.encounter.awaiting_results.v1","clinic.encounter.return_queued.v1")){
   var data=Map.<String,Object>of("encounterId",visit.toString(),"patientRef",UUID.randomUUID().toString(),"actorUserId",actor.toString(),"status","AWAITING_RESULTS");
   var e=new EventEnvelopeInput("1.0",UUID.randomUUID(),"/services/encounter",type,"encounter/"+visit,Instant.now(),"application/json",clinic,branch,UUID.randomUUID().toString(),null,4,data);
   assertTrue(encounters.accept(p,e));assertFalse(encounters.accept(p,e));assertEquals(1,audit.trace(e.correlationid()).size());
   var bad=new HashMap<>(data);bad.put("status","CLINICALLY_COMPLETED");assertThrows(ApiProblem.class,()->encounters.accept(p,new EventEnvelopeInput("1.0",UUID.randomUUID(),e.source(),type,e.subject(),e.time(),e.datacontenttype(),clinic,branch,e.correlationid(),null,5,bad)));
   bad.put("status","AWAITING_RESULTS");bad.put("reason","Synthetic local clinical text");assertThrows(ApiProblem.class,()->encounters.accept(p,new EventEnvelopeInput("1.0",UUID.randomUUID(),e.source(),type,e.subject(),e.time(),e.datacontenttype(),clinic,branch,e.correlationid(),null,5,bad)));
  }assertTrue(audit.verify(clinic).valid());
 }
}
