package com.clinic.v2.audit.service;
import com.clinic.v2.audit.api.*;
import com.clinic.v2.audit.api.AuditDto.*;
import com.clinic.v2.audit.security.WorkloadPrincipal;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
@Service
public class EncounterAuditConsumer {
 private final ClinicalAccessConsumer access;private final AuditService audit;private final EventEnvelopeValidator validator;private final JdbcTemplate jdbc;
 public EncounterAuditConsumer(AuditService audit,EventEnvelopeValidator validator,JdbcTemplate jdbc,ClinicalAccessConsumer access){this.access=access;this.audit=audit;this.validator=validator;this.jdbc=jdbc;}
 @Transactional public boolean accept(WorkloadPrincipal principal,EventEnvelopeInput event){
  if(principal==null||!"encounter-v2-service".equals(principal.issuer())||!principal.hasScope("audit.write"))throw ApiProblem.forbidden();validator.validate(event);if("clinic.encounter.access_recorded.v1".equals(event.type()))return access.accept(principal,event);
  if(!"/services/encounter".equals(event.source())||!Set.of("clinic.encounter.checked_in.v1","clinic.encounter.arrival_recovered.v1","clinic.encounter.queue_changed.v1","clinic.encounter.started.v1","clinic.encounter.awaiting_results.v1","clinic.encounter.return_queued.v1","clinic.encounter.clinically_completed.v1","clinic.encounter.closed.v1","clinic.encounter.billing_retry_requested.v1").contains(event.type())||event.branchid()==null||!Set.of("encounterId","patientRef","actorUserId","status").equals(event.data().keySet()))throw ApiProblem.invalid("Invalid encounter event metadata");
  String status=String.valueOf(event.data().get("status"));
  boolean stateAllowed=switch(event.type()){
   case "clinic.encounter.checked_in.v1" -> "WAITING".equals(status);
   case "clinic.encounter.started.v1" -> "IN_PROGRESS".equals(status);
   case "clinic.encounter.clinically_completed.v1" -> "CLINICALLY_COMPLETED".equals(status);
   case "clinic.encounter.closed.v1" -> "CLOSED".equals(status);
   case "clinic.encounter.billing_retry_requested.v1" -> "CLINICALLY_COMPLETED".equals(status);
   case "clinic.encounter.awaiting_results.v1","clinic.encounter.return_queued.v1" -> "AWAITING_RESULTS".equals(status);
   default -> Set.of("WAITING","AWAITING_RESULTS").contains(status);
  };
  if(!stateAllowed)throw ApiProblem.invalid("Encounter event state mismatch");
  try{UUID actor=UUID.fromString(String.valueOf(event.data().get("actorUserId"))),visit=UUID.fromString(String.valueOf(event.data().get("encounterId")));UUID.fromString(String.valueOf(event.data().get("patientRef")));if(!("encounter/"+visit).equals(event.subject()))throw ApiProblem.invalid("Encounter subject mismatch");
   jdbc.execute("select pg_advisory_xact_lock(hashtextextended('audit-encounter:"+event.id()+"',0))");if(jdbc.queryForObject("select count(*) from audit_v2.producer_inbox where source='encounter-v2-service' and event_id=?",Integer.class,event.id())>0)return false;
   audit.append(new AuditInput(event.clinicid(),event.branchid(),actor,null,"SYSTEM",event.type(),"encounter",visit.toString(),"SUCCESS",null,event.correlationid(),event.time(),Map.of("sourceEventId",event.id().toString(),"aggregateVersion",event.aggregateversion(),"status",status)));jdbc.update("insert into audit_v2.producer_inbox(source,event_id) values('encounter-v2-service',?)",event.id());return true;
  }catch(IllegalArgumentException ex){throw ApiProblem.invalid("Invalid encounter references");}
 }
}

