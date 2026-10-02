package com.clinic.v2.encounter.api;
import com.clinic.v2.encounter.security.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.web.bind.annotation.*;
import java.util.*;
@RestController
public class BillingProofController {
 private final JdbcTemplate jdbc;private final EncounterDb db;private final BillingPeerVerifier peer;private final IamAuthorizationClient iam;private final TransactionTemplate tx;
 public BillingProofController(JdbcTemplate jdbc,EncounterDb db,BillingPeerVerifier peer,IamAuthorizationClient iam,PlatformTransactionManager manager){this.jdbc=jdbc;this.db=db;this.peer=peer;this.iam=iam;tx=new TransactionTemplate(manager);}
 public record Proof(UUID id,UUID clinicId,UUID branchId,UUID patientId,UUID appointmentId,String status,long medicalCaseVersion){}
 public record Billable(UUID id,UUID patientId,UUID appointmentId,String status,long medicalCaseVersion,String visitCode,java.time.Instant checkedInAt){}
 @GetMapping("/api/v2/clinics/{c}/branches/{b}/billable-visits")
 public List<Billable> visits(@org.springframework.security.core.annotation.AuthenticationPrincipal Actor actor,@PathVariable UUID c,@PathVariable UUID b){
  if(actor==null||!iam.decide(actor.id(),"BILLING",c,b).allowed())throw ApiProblem.forbidden();
  return tx.execute(t->{db.scope(c,b);return jdbc.query("select v.id,v.patient_id,v.appointment_id,v.status,v.medical_case_version,v.checked_in_at,(select q.code from encounter_v2.queue_tickets q where q.visit_id=v.id order by q.created_at desc limit 1) visit_code from encounter_v2.visits v where v.status in ('CLINICALLY_COMPLETED','CLOSED') order by v.clinically_completed_at desc limit 100",(rs,n)->new Billable(rs.getObject("id",UUID.class),rs.getObject("patient_id",UUID.class),rs.getObject("appointment_id",UUID.class),rs.getString("status"),rs.getLong("medical_case_version"),rs.getString("visit_code"),rs.getTimestamp("checked_in_at")==null?null:rs.getTimestamp("checked_in_at").toInstant()));});
 }
 @GetMapping("/api/v2/internal/clinics/{c}/branches/{b}/visits/{id}/billing-proof")
 public Proof proof(@RequestHeader(value="Authorization",required=false) String bearer,@RequestHeader("X-Actor-User-Id") UUID actor,@PathVariable UUID c,@PathVariable UUID b,@PathVariable UUID id){
  peer.require(bearer,"billing.source.read");var d=iam.decide(actor,"BILLING",c,b);if(!d.allowed())throw ApiProblem.forbidden();
  return localProof(c,b,id);
 }
 @GetMapping("/api/v2/internal/clinics/{c}/branches/{b}/visits/{id}/billing-sync-proof")
 public Proof systemProof(@RequestHeader(value="Authorization",required=false) String bearer,@PathVariable UUID c,@PathVariable UUID b,@PathVariable UUID id){
  peer.require(bearer,"billing.source.sync");return localProof(c,b,id);
 }
 private Proof localProof(UUID c,UUID b,UUID id){
  return tx.execute(t->{db.scope(c,b);var rows=jdbc.queryForList("select id,patient_id,appointment_id,status,medical_case_version from encounter_v2.visits where id=?",id);if(rows.isEmpty())throw ApiProblem.missing();var r=rows.getFirst();if(!Set.of("CLINICALLY_COMPLETED","CLOSED").contains(r.get("status"))||r.get("medical_case_version")==null)throw ApiProblem.conflict("Encounter not clinically completed");return new Proof(id,c,b,(UUID)r.get("patient_id"),(UUID)r.get("appointment_id"),r.get("status").toString(),((Number)r.get("medical_case_version")).longValue());});
 }
}
