package com.clinic.v2.encounter.api;
import com.clinic.v2.encounter.security.*;
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
 @GetMapping("/api/v2/me/clinics/{c}/branches/{b}/visits/{id}/follow-up-proof")
 public Proof proof(@AuthenticationPrincipal Actor actor,@PathVariable UUID c,@PathVariable UUID b,@PathVariable UUID id){
  UUID patient=owner.ownPatient(actor,c);if(patient==null)throw ApiProblem.forbidden();
  return tx.execute(t->{db.scope(c,b);var rows=jdbc.queryForList("select patient_id,status,medical_case_version from encounter_v2.visits where id=? and patient_id=?",id,patient);if(rows.isEmpty())throw ApiProblem.missing();var v=rows.getFirst();if(!Set.of("CLINICALLY_COMPLETED","CLOSED").contains(v.get("status"))||v.get("medical_case_version")==null)throw ApiProblem.conflict("Prior visit is not clinically completed");return new Proof(id,c,b,patient,v.get("status").toString(),((Number)v.get("medical_case_version")).longValue());});
 }
}
