package com.clinic.v2.search.service;
import com.clinic.v2.search.api.*;
import com.clinic.v2.search.api.SearchDto.*;
import com.clinic.v2.search.security.WorkloadPrincipal;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import jakarta.validation.*;
import jakarta.validation.constraints.*;
import java.util.*;
import java.time.Instant;

@Service
public class ProjectionSnapshotService {
 private final JdbcTemplate jdbc;private final ObjectMapper json;private final SearchProjectionService projections;private final Validator validator;
 public ProjectionSnapshotService(JdbcTemplate jdbc,ObjectMapper json,SearchProjectionService projections,Validator validator){
  this.jdbc=jdbc;this.json=json;this.projections=projections;this.validator=validator;
 }
 public record Delivery(@NotNull UUID eventId,@NotNull UUID clinicId,@Min(1) long sourceVersion,@NotNull JsonNode snapshot,@NotNull JsonNode event){}
 @Transactional public ProjectionResult accept(WorkloadPrincipal principal,Delivery delivery){
  if(principal==null||!principal.hasScope("search.project")||!Set.of("clinic-v2-service","doctor-v2-service","catalog-v2-service").contains(principal.issuer()))throw ApiProblem.forbidden();
  String source=principal.issuer();UUID clinic=delivery.clinicId();
  JsonNode event=delivery.event();String domain=source.replace("-v2-service","");
  if(event==null||!"1.0".equals(event.path("specversion").asText())||!delivery.eventId().toString().equals(event.path("id").asText())||
     !clinic.toString().equals(event.path("clinicid").asText())||!("/services/"+domain).equals(event.path("source").asText())||
     !("clinic."+domain+".public_changed.v1").equals(event.path("type").asText())||event.path("aggregateversion").asLong()<1||
     event.path("aggregateversion").asLong()>delivery.sourceVersion())throw ApiProblem.invalid("Invalid authenticated projection event");
  jdbc.execute("select pg_advisory_xact_lock(hashtextextended('search:"+clinic+"',0))");
  if(jdbc.queryForObject("select count(*) from search_v2.projection_inbox where source=? and event_id=?",Integer.class,source,delivery.eventId())>0)
   return new ProjectionResult(false,"REPLAY",delivery.sourceVersion(),Instant.now());
  var versions=jdbc.queryForList("select source_version from search_v2.projection_snapshot_versions where source=? and clinic_id=?",Long.class,source,clinic);
  boolean applied=versions.isEmpty()||versions.getFirst()<delivery.sourceVersion();
  if(applied){
   if(source.equals("clinic-v2-service")){
    var input=decode(delivery.snapshot().path("clinic"),delivery,ClinicProjectionInput.class);if(!clinic.equals(input.clinicId()))throw ApiProblem.forbidden();
    projections.projectClinic(input);
   }else{
    if(jdbc.queryForObject("select count(*) from search_v2.public_clinics where clinic_id=?",Integer.class,clinic)==0)throw ApiProblem.unavailable("Clinic projection has not arrived");
    boolean doctor=source.equals("doctor-v2-service");String field=doctor?"doctors":"offerings",table=doctor?"public_doctors":"public_offerings";
    JsonNode records=delivery.snapshot().path(field);if(!records.isArray()||records.size()>2000)throw ApiProblem.invalid("Invalid projection snapshot");
    jdbc.update("update search_v2."+table+" set public_visible=false where clinic_id=?",clinic);
    for(JsonNode record:records){
     if(doctor){
      var d=decode(record,delivery,DoctorProjectionInput.class);scope(clinic,d.clinicId(),d.branchId());
      jdbc.update("insert into search_v2.public_doctors(doctor_id,clinic_id,branch_id,display_name,specialty_code,specialty_name,professional_title,public_visible,source_version,indexed_at) values(?,?,?,?,?,?,?,?,?,now()) on conflict(doctor_id,clinic_id,branch_id) do update set display_name=excluded.display_name,specialty_code=excluded.specialty_code,specialty_name=excluded.specialty_name,professional_title=excluded.professional_title,public_visible=excluded.public_visible,source_version=excluded.source_version,indexed_at=now()",
       d.doctorId(),clinic,d.branchId(),d.displayName(),d.specialtyCode(),d.specialtyName(),d.professionalTitle(),d.publicVisible(),delivery.sourceVersion());
     }else{
      var o=decode(record,delivery,OfferingProjectionInput.class);scope(clinic,o.clinicId(),o.branchId());
      jdbc.update("insert into search_v2.public_offerings(offering_id,clinic_id,branch_id,code,name,specialty_code,amount_vnd,currency,price_version_id,effective_from,public_visible,source_version,indexed_at) values(?,?,?,?,?,?,?,?,?,?,?,?,now()) on conflict(offering_id,clinic_id,branch_id) do update set code=excluded.code,name=excluded.name,specialty_code=excluded.specialty_code,amount_vnd=excluded.amount_vnd,currency=excluded.currency,price_version_id=excluded.price_version_id,effective_from=excluded.effective_from,public_visible=excluded.public_visible,source_version=excluded.source_version,indexed_at=now()",
       o.offeringId(),clinic,o.branchId(),o.code(),o.name(),o.specialtyCode(),o.amountVnd(),o.currency(),o.priceVersionId(),o.effectiveFrom()==null?null:java.sql.Timestamp.from(o.effectiveFrom()),o.publicVisible(),delivery.sourceVersion());
     }
    }
   }
   jdbc.update("insert into search_v2.projection_snapshot_versions(source,clinic_id,source_version) values(?,?,?) on conflict(source,clinic_id) do update set source_version=excluded.source_version",source,clinic,delivery.sourceVersion());
  }
  jdbc.update("insert into search_v2.projection_inbox(source,event_id,clinic_id) values(?,?,?)",source,delivery.eventId(),clinic);
  return new ProjectionResult(applied,applied?"APPLIED":"STALE",delivery.sourceVersion(),Instant.now());
 }
 private void scope(UUID expected,UUID clinic,UUID branch){
  if(!expected.equals(clinic))throw ApiProblem.forbidden();
  if(jdbc.queryForObject("select count(*) from search_v2.public_branches where clinic_id=? and branch_id=?",Integer.class,clinic,branch)==0)throw ApiProblem.unavailable("Branch projection has not arrived");
 }
 private <T> T decode(JsonNode value,Delivery delivery,Class<T> type){
  if(!value.isObject())throw ApiProblem.invalid("Invalid projection record");
  ObjectNode normalized=((ObjectNode)value).deepCopy();normalized.put("eventId",delivery.eventId().toString());normalized.put("sourceVersion",delivery.sourceVersion());
  try{T input=json.treeToValue(normalized,type);if(!validator.validate(input).isEmpty())throw ApiProblem.invalid("Invalid projection fields");return input;}
  catch(com.fasterxml.jackson.core.JsonProcessingException e){throw ApiProblem.invalid("Invalid projection fields");}
 }
}

