package com.clinic.audit.service;
import com.clinic.audit.api.*;
import com.clinic.audit.api.AuditDto.*;
import com.clinic.audit.security.WorkloadPrincipal;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
@Service
public class AppointmentAuditConsumer {
 private final AuditService audit;private final EventEnvelopeValidator validator;private final JdbcTemplate jdbc;
 public AppointmentAuditConsumer(AuditService audit,EventEnvelopeValidator validator,JdbcTemplate jdbc){this.audit=audit;this.validator=validator;this.jdbc=jdbc;}
 @Transactional public boolean accept(WorkloadPrincipal principal,EventEnvelopeInput event){
  if(principal==null||!"appointment-service".equals(principal.issuer())||!principal.hasScope("audit.write"))throw ApiProblem.forbidden();
  validator.validate(event);
  if(!"/services/appointment".equals(event.source())||!Set.of("clinic.appointment.confirmed.v1","clinic.appointment.cancelled.v1","clinic.appointment.rescheduled.v1","clinic.appointment.exception_recorded.v1","clinic.appointment.exception_resolved.v1").contains(event.type()))throw ApiProblem.invalid("Unsupported appointment event");
  Set<String> allowed=Set.of("appointmentId","patientRef","slotId","oldSlotId","newSlotId","status","actorUserId","startsAt","exceptionType","recipientUserId","manualContactRequired");
  if(!allowed.containsAll(event.data().keySet()))throw ApiProblem.invalid("Unsupported appointment metadata");
  jdbc.execute("select pg_advisory_xact_lock(hashtextextended('audit-appointment:"+event.id()+"',0))");
  if(jdbc.queryForObject("select count(*) from audit_v2.producer_inbox where source='appointment-service' and event_id=?",Integer.class,event.id())>0)return false;
  try{
   UUID actor=UUID.fromString(String.valueOf(event.data().get("actorUserId")));
   UUID appointment=UUID.fromString(String.valueOf(event.data().get("appointmentId")));
   audit.append(new AuditInput(event.clinicid(),event.branchid(),actor,null,"SYSTEM",event.type(),"appointment",appointment.toString(),"SUCCESS",null,event.correlationid(),event.time(),Map.of("sourceEventId",event.id().toString(),"aggregateVersion",event.aggregateversion(),"status",String.valueOf(event.data().get("status")))));
   jdbc.update("insert into audit_v2.producer_inbox(source,event_id) values('appointment-service',?)",event.id());return true;
  }catch(IllegalArgumentException e){throw ApiProblem.invalid("Invalid appointment event references");}
 }
}
