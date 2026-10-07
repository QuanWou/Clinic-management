package com.clinic.encounter.api;
import com.clinic.encounter.security.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import java.util.*;
@RestController public class PatientFollowUpController {
 private final JdbcTemplate jdbc;private final EncounterDb db;private final PatientOwnershipClient owner;private final TransactionTemplate tx;
 public PatientFollowUpController(JdbcTemplate jdbc,EncounterDb db,PatientOwnershipClient owner,PlatformTransactionManager manager){this.jdbc=jdbc;this.db=db;this.owner=owner;tx=new TransactionTemplate(manager);tx.setReadOnly(true);}
 public record Proof(UUID encounterId,UUID clinicId,UUID branchId,UUID patientId,String status,long medicalCaseVersion){}
 @GetMapping("/api/me/clinics/{c}/branches/{b}/visits/{id}/follow-up-proof")
 public Proof proof(@AuthenticationPrincipal Actor actor,@PathVariable UUID c,@PathVariable UUID b,@PathVariable UUID id){
  UUID patient=owner.ownPatient(actor,c);if(patient==null)throw ApiProblem.forbidden();
  return tx.execute(t->{db.scope(c,b);var rows=jdbc.queryForList("select patient_id,status,medical_case_version from encounter_v2.visits where id=? and patient_id=?",id,patient);if(rows.isEmpty())throw ApiProblem.missing();var v=rows.getFirst();if(!Set.of("CLINICALLY_COMPLETED","CLOSED").contains(v.get("status"))||v.get("medical_case_version")==null)throw ApiProblem.conflict("Prior visit is not clinically completed");return new Proof(id,c,b,patient,v.get("status").toString(),((Number)v.get("medical_case_version")).longValue());});
 }
 @PostMapping("/api/me/clinics/{c}/branches/{b}/completed-visits")
 public List<Proof> completed(@AuthenticationPrincipal Actor actor,@PathVariable UUID c,@PathVariable UUID b,@RequestBody List<UUID> ids){
  UUID patient=owner.ownPatient(actor,c);if(patient==null)throw ApiProblem.forbidden();
  if(ids==null||ids.isEmpty()||ids.size()>100||ids.stream().anyMatch(Objects::isNull))throw ApiProblem.invalid("Use 1 to 100 visit references");
  var unique=ids.stream().distinct().toList();
  return tx.execute(t->{db.scope(c,b);String marks=String.join(",",Collections.nCopies(unique.size(),"?"));var args=new ArrayList<Object>();args.add(patient);args.addAll(unique);
   return jdbc.query("select id,status,medical_case_version from encounter_v2.visits where patient_id=? and id in ("+marks+") and status in ('CLINICALLY_COMPLETED','CLOSED') and medical_case_version is not null",(rs,n)->new Proof(rs.getObject("id",UUID.class),c,b,patient,rs.getString("status"),rs.getLong("medical_case_version")),args.toArray());
  });
 }
}
