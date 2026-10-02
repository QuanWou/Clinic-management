package com.clinic.v2.audit.service;
import com.clinic.v2.audit.api.*;
import com.clinic.v2.audit.api.AuditDto.*;
import com.clinic.v2.audit.security.WorkloadPrincipal;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
@Service public class ClinicalAccessConsumer {
 private final AuditService audit;private final EventEnvelopeValidator validator;private final JdbcTemplate jdbc;
 public ClinicalAccessConsumer(AuditService a,EventEnvelopeValidator v,JdbcTemplate j){audit=a;validator=v;jdbc=j;}
 @Transactional public boolean accept(WorkloadPrincipal principal,EventEnvelopeInput event){
  if(principal==null||!Set.of("medical-v2-service","encounter-v2-service").contains(principal.issuer())||!principal.hasScope("audit.write"))throw ApiProblem.forbidden();validator.validate(event);
  String source=principal.issuer().split("-")[0];if(!event.source().equals("/services/"+source)||!event.type().equals("clinic."+source+".access_recorded.v1")||event.branchid()==null||event.aggregateversion()!=1||!Set.of("resourceId","actorUserId","operation","outcome").equals(event.data().keySet()))throw ApiProblem.invalid("Invalid clinical access metadata");
  try{
   UUID resource=UUID.fromString(String.valueOf(event.data().get("resourceId"))),actor=UUID.fromString(String.valueOf(event.data().get("actorUserId")));String operation=String.valueOf(event.data().get("operation")),outcome=String.valueOf(event.data().get("outcome"));
   Set<String> operations=source.equals("medical")?Set.of("READ_DRAFT","READ_ORDERS","READ_READINESS","READ_LAB_WORKLIST","CARE_MUTATION"):Set.of("READ_WORKLIST","READ_ENCOUNTER","CARE_MUTATION");
   if(!event.subject().equals("clinical-access/"+resource)||!operations.contains(operation)||!Set.of("SUCCESS","DENIED").contains(outcome)||("CARE_MUTATION".equals(operation)&&!"DENIED".equals(outcome)))throw ApiProblem.invalid("Invalid clinical access action");
   jdbc.queryForObject("select pg_advisory_xact_lock(hashtextextended(?,0))",Object.class,"audit-"+source+":"+event.id());
   if(jdbc.queryForObject("select count(*) from audit_v2.producer_inbox where source=? and event_id=?",Integer.class,principal.issuer(),event.id())>0)return false;
   audit.append(new AuditInput(event.clinicid(),event.branchid(),actor,null,"SECURITY",event.type(),source+"-access",resource.toString(),outcome,"DENIED".equals(outcome)?"AUTHORIZATION_REJECTED":null,event.correlationid(),event.time(),Map.of("sourceEventId",event.id().toString(),"operation",operation)));
   jdbc.update("insert into audit_v2.producer_inbox(source,event_id) values(?,?)",principal.issuer(),event.id());return true;
  }catch(IllegalArgumentException ex){throw ApiProblem.invalid("Invalid clinical access references");}
 }
}
