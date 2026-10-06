package com.clinic.audit.service;
import com.clinic.audit.api.*;
import com.clinic.audit.api.AuditDto.*;
import com.clinic.audit.security.WorkloadPrincipal;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
@Service public class BillingAuditConsumer{
 private final AuditService audit;private final EventEnvelopeValidator validator;private final JdbcTemplate jdbc;
 public BillingAuditConsumer(AuditService a,EventEnvelopeValidator v,JdbcTemplate j){audit=a;validator=v;jdbc=j;}
 @Transactional public boolean accept(WorkloadPrincipal p,EventEnvelopeInput e){
  if(p==null||!"billing-service".equals(p.issuer())||!p.hasScope("audit.write"))throw ApiProblem.forbidden();validator.validate(e);
  if(!"/services/billing".equals(e.source())||e.branchid()==null||!Set.of("clinic.billing.bill_issued.v1","clinic.billing.onsite_collected.v1","clinic.billing.online_collected.v1","clinic.billing.adjustment_approved.v1","clinic.billing.shift_submitted.v1","clinic.billing.shift_approved.v1","clinic.billing.notification_retry_requested.v1","clinic.billing.charge_retry_requested.v1").contains(e.type())||!Set.of("billingId","resourceId","actorUserId").equals(e.data().keySet()))throw ApiProblem.invalid("Invalid Billing event metadata");
  try{UUID encounter=UUID.fromString(e.data().get("billingId").toString()),resource=UUID.fromString(e.data().get("resourceId").toString()),actor=UUID.fromString(e.data().get("actorUserId").toString());if(!("billing/"+encounter).equals(e.subject()))throw ApiProblem.invalid("Billing subject mismatch");
   jdbc.execute("select pg_advisory_xact_lock(hashtextextended('audit-billing:"+e.id()+"',0))");if(jdbc.queryForObject("select count(*) from audit_v2.producer_inbox where source='billing-service' and event_id=?",Integer.class,e.id())>0)return false;
   audit.append(new AuditInput(e.clinicid(),e.branchid(),actor,null,"SYSTEM",e.type(),"billing",resource.toString(),"SUCCESS",null,e.correlationid(),e.time(),Map.of("sourceEventId",e.id().toString(),"aggregateVersion",e.aggregateversion(),"billingId",encounter.toString())));jdbc.update("insert into audit_v2.producer_inbox(source,event_id) values('billing-service',?)",e.id());return true;
  }catch(IllegalArgumentException ex){throw ApiProblem.invalid("Invalid Billing references");}
 }
}
