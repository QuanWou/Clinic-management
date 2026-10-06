package com.clinic.encounter.service;

import com.clinic.encounter.api.EncounterDto.*;
import com.clinic.encounter.security.EncounterDb;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.util.*;

/** Enrich only rows already selected by an authorized, branch-scoped operation.
 * Patient HTTP reads run after the local transaction, once per bounded page. */
@Component
public class PatientViews {
 private final JdbcTemplate jdbc;private final EncounterDb db;private final EncounterSources sources;private final TransactionTemplate tx;
 public PatientViews(JdbcTemplate jdbc,EncounterDb db,EncounterSources sources,PlatformTransactionManager manager){this.jdbc=jdbc;this.db=db;this.sources=sources;tx=new TransactionTemplate(manager);}
 @SuppressWarnings("unchecked")
 public <T>T enrich(UUID clinic,UUID branch,T value){
  var visits=new LinkedHashSet<UUID>();collect(value,visits);if(visits.isEmpty())return value;
  if(visits.size()>200)throw com.clinic.encounter.api.ApiProblem.invalid("Use a page of at most 200 visits");
  Map<UUID,Reception> patients=tx.execute(t->{db.scope(clinic,branch);var found=new HashMap<UUID,Reception>();jdbc.query("select id,patient_id,doctor_id,checked_in_at from encounter_v2.visits where id in ("+String.join(",",Collections.nCopies(visits.size(),"?"))+")",rs->{found.put(rs.getObject("id",UUID.class),new Reception(rs.getObject("patient_id",UUID.class),rs.getObject("doctor_id",UUID.class),rs.getTimestamp("checked_in_at")==null?null:rs.getTimestamp("checked_in_at").toInstant()));},visits.toArray());return found;});
  var summaries=new HashMap<UUID,PatientSummary>();for(var p:sources.identities(clinic,patients.values().stream().map(Reception::patientId).distinct().toList()))summaries.put(p.patientId(),p);
  return (T)apply(value,patients,summaries);
 }
 private record Reception(UUID patientId,UUID doctorId,java.time.Instant checkedInAt){}
 private void collect(Object value,Set<UUID> ids){
  if(value instanceof VisitView v)ids.add(v.id());else if(value instanceof TicketView t)ids.add(t.visitId());
  else if(value instanceof EncounterService.ArrivalRecovery a)collect(a.visit(),ids);
  else if(value instanceof EncounterService.WorklistPage p)collect(p.items(),ids);
  else if(value instanceof EncounterService.QueuePage p)collect(p.items(),ids);
  else if(value instanceof EncounterService.PendingPage p)collect(p.items(),ids);
  else if(value instanceof List<?> rows)rows.forEach(r->collect(r,ids));
 }
 private Object apply(Object value,Map<UUID,Reception> patients,Map<UUID,PatientSummary> summaries){
  if(value instanceof VisitView v)return v.withPatient(summaries.get(patients.containsKey(v.id())?patients.get(v.id()).patientId():null));
  if(value instanceof TicketView t){var r=patients.get(t.visitId());return r==null?t:t.withPatient(summaries.get(r.patientId())).withReception(r.doctorId(),r.checkedInAt());}
  if(value instanceof EncounterService.ArrivalRecovery a)return new EncounterService.ArrivalRecovery(a.operation(),a.createdAt(),(VisitView)apply(a.visit(),patients,summaries));
  if(value instanceof EncounterService.WorklistPage p)return new EncounterService.WorklistPage(p.items().stream().map(v->(VisitView)apply(v,patients,summaries)).toList(),p.nextAfter());
  if(value instanceof EncounterService.QueuePage p)return new EncounterService.QueuePage(p.items().stream().map(v->(TicketView)apply(v,patients,summaries)).toList(),p.nextAfterNumber());
  if(value instanceof EncounterService.PendingPage p)return new EncounterService.PendingPage(p.items().stream().map(v->(VisitView)apply(v,patients,summaries)).toList(),p.nextAfter());
  if(value instanceof List<?> rows)return rows.stream().map(r->apply(r,patients,summaries)).toList();return value;
 }
}
