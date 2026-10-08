package com.clinic.medical.service;
import com.clinic.medical.api.ApiProblem;
import com.clinic.medical.api.MedicalDto.Note;
import com.clinic.medical.security.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.Instant;
import java.util.*;
@Service public class PatientRecordService {
 private final JdbcTemplate jdbc;private final MedicalDb db;private final PatientOwnershipClient owner;private final PatientEncounterSource encounters;private final ObjectMapper json;private final TransactionTemplate tx;
 public PatientRecordService(JdbcTemplate jdbc,MedicalDb db,PatientOwnershipClient owner,PatientEncounterSource encounters,ObjectMapper json,PlatformTransactionManager manager){this.jdbc=jdbc;this.db=db;this.owner=owner;this.encounters=encounters;this.json=json;tx=new TransactionTemplate(manager);tx.setReadOnly(true);}
 private record Candidate(UUID encounterId,long caseVersion,Instant savedAt,Note content){}
 public record ReviewedResult(String name,String content,Instant resultAt,Instant reviewedAt){}
 public record Record(UUID encounterId,UUID clinicId,UUID branchId,long caseVersion,Instant savedAt,Note content,List<ReviewedResult> results){}
 public List<Record> list(Actor actor,UUID c,UUID b){
  UUID patient=owner.ownPatient(actor,c);if(patient==null)throw ApiProblem.forbidden();
  var candidates=tx.execute(t->{db.scope(c,b);return jdbc.query("select c.encounter_id,c.row_version,d.created_at,d.content_json from medical_v2.cases c join medical_v2.document_versions d on d.encounter_id=c.encounter_id and d.version=c.document_version where c.patient_id=? and c.status='VALIDATED' order by d.created_at desc limit 100",(rs,n)->new Candidate(rs.getObject("encounter_id",UUID.class),rs.getLong("row_version"),rs.getTimestamp("created_at").toInstant(),parse(rs.getString("content_json"))),patient);});
  if(candidates==null||candidates.isEmpty())return List.of();
  var proofs=encounters.completed(actor,c,b,candidates.stream().map(Candidate::encounterId).toList());var versions=new HashMap<UUID,Long>();for(var p:proofs)if(c.equals(p.clinicId())&&b.equals(p.branchId())&&patient.equals(p.patientId())&&Set.of("CLINICALLY_COMPLETED","CLOSED").contains(p.status()))versions.put(p.encounterId(),p.medicalCaseVersion());
  var released=candidates.stream().filter(x->Objects.equals(versions.get(x.encounterId()),x.caseVersion())).toList();if(released.isEmpty())return List.of();
  var ids=released.stream().map(Candidate::encounterId).toList();var grouped=tx.execute(t->{db.scope(c,b);String marks=String.join(",",Collections.nCopies(ids.size(),"?"));var rows=jdbc.query("select o.encounter_id,o.name,r.content,r.created_at result_at,(select max(rv.created_at) from medical_v2.reviews rv where rv.order_id=o.id and rv.result_id=r.id) reviewed_at from medical_v2.orders o join medical_v2.results r on r.order_id=o.id and r.version=o.result_version where o.encounter_id in ("+marks+") and o.state='REVIEWED' order by r.created_at",(rs,n)->Map.entry(rs.getObject("encounter_id",UUID.class),new ReviewedResult(rs.getString("name"),rs.getString("content"),rs.getTimestamp("result_at").toInstant(),rs.getTimestamp("reviewed_at")==null?null:rs.getTimestamp("reviewed_at").toInstant())),ids.toArray());var out=new HashMap<UUID,List<ReviewedResult>>();for(var row:rows)out.computeIfAbsent(row.getKey(),k->new ArrayList<>()).add(row.getValue());return out;});
  return released.stream().map(x->new Record(x.encounterId(),c,b,x.caseVersion(),x.savedAt(),x.content(),grouped==null?List.of():grouped.getOrDefault(x.encounterId(),List.of()))).toList();
 }
 private Note parse(String raw){try{return json.readValue(raw,Note.class);}catch(Exception e){throw new IllegalStateException(e);}}
}
