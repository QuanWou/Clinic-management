package com.clinic.audit.service;
import com.clinic.audit.api.*;
import com.clinic.audit.api.AuditDto.*;
import com.clinic.audit.security.WorkloadPrincipal;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
@Service public class MedicalAuditConsumer{
 private final ClinicalAccessConsumer access;private final AuditService audit;private final EventEnvelopeValidator validator;private final JdbcTemplate jdbc;
 public MedicalAuditConsumer(AuditService a,EventEnvelopeValidator v,JdbcTemplate j,ClinicalAccessConsumer access){this.access=access;audit=a;validator=v;jdbc=j;}
 @Transactional public boolean accept(WorkloadPrincipal p,EventEnvelopeInput e){
  if(p==null||!"medical-service".equals(p.issuer())||!p.hasScope("audit.write"))throw ApiProblem.forbidden();validator.validate(e);if("clinic.medical.access_recorded.v1".equals(e.type()))return access.accept(p,e);
  if(!"/services/medical".equals(e.source())||e.branchid()==null||!Set.of("clinic.medical.draft_saved.v1","clinic.medical.order_changed.v1","clinic.medical.result_recorded.v1","clinic.medical.result_reviewed.v1","clinic.medical.validated.v1","clinic.medical.billing_retry_requested.v1").contains(e.type())||!Set.of("encounterId","resourceId","actorUserId").equals(e.data().keySet()))throw ApiProblem.invalid("Invalid Medical event metadata");
  try{UUID encounter=UUID.fromString(e.data().get("encounterId").toString()),resource=UUID.fromString(e.data().get("resourceId").toString()),actor=UUID.fromString(e.data().get("actorUserId").toString());if(!("encounter/"+encounter).equals(e.subject()))throw ApiProblem.invalid("Medical subject mismatch");
   jdbc.execute("select pg_advisory_xact_lock(hashtextextended('audit-medical:"+e.id()+"',0))");if(jdbc.queryForObject("select count(*) from audit_v2.producer_inbox where source='medical-service' and event_id=?",Integer.class,e.id())>0)return false;
   audit.append(new AuditInput(e.clinicid(),e.branchid(),actor,null,"SYSTEM",e.type(),"medical",resource.toString(),"SUCCESS",null,e.correlationid(),e.time(),Map.of("sourceEventId",e.id().toString(),"aggregateVersion",e.aggregateversion(),"encounterId",encounter.toString())));jdbc.update("insert into audit_v2.producer_inbox(source,event_id) values('medical-service',?)",e.id());return true;
  }catch(IllegalArgumentException ex){throw ApiProblem.invalid("Invalid Medical references");}
 }
}

