package com.clinic.appointment.api;
import com.clinic.appointment.api.AppointmentDto.PriceSnapshot;
import com.clinic.appointment.security.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.web.bind.annotation.*;
import java.util.*;
@RestController
public class BillingProofController {
 private final JdbcTemplate jdbc;private final TenantDbContext db;private final BillingPeerVerifier peer;private final BillingSourceAuthorization iam;private final TransactionTemplate tx;
 public BillingProofController(JdbcTemplate jdbc,TenantDbContext db,BillingPeerVerifier peer,BillingSourceAuthorization iam,PlatformTransactionManager manager){this.jdbc=jdbc;this.db=db;this.peer=peer;this.iam=iam;tx=new TransactionTemplate(manager);}
 public record Proof(UUID id,UUID clinicId,UUID branchId,UUID patientId,UUID encounterId,UUID offeringId,String appointmentCode,String status,PriceSnapshot price){}
 @GetMapping("/api/internal/clinics/{c}/branches/{b}/appointments/{id}/billing-proof")
 public Proof proof(@RequestHeader(value="Authorization",required=false) String bearer,@RequestHeader("X-Actor-User-Id") UUID actor,@PathVariable UUID c,@PathVariable UUID b,@PathVariable UUID id){
  peer.require(bearer,"billing.source.read");iam.require(actor,c,b);
  return localProof(c,b,id);
 }
 @GetMapping("/api/internal/clinics/{c}/branches/{b}/appointments/{id}/billing-sync-proof")
 public Proof systemProof(@RequestHeader(value="Authorization",required=false) String bearer,@PathVariable UUID c,@PathVariable UUID b,@PathVariable UUID id){peer.require(bearer,"billing.source.sync");return localProof(c,b,id);}
 private Proof localProof(UUID c,UUID b,UUID id){
  return tx.execute(t->{db.tenant(c);var rows=jdbc.queryForList("select * from appointment_v2.appointments where id=? and branch_id=?",id,b);if(rows.isEmpty())throw ApiProblem.missing();var r=rows.getFirst();if(!Set.of("CHECKED_IN","FULFILLED").contains(r.get("status"))||r.get("encounter_id")==null)throw ApiProblem.conflict("Booking has no source Encounter arrival");
   var price=new PriceSnapshot((UUID)r.get("price_version_id"),((Number)r.get("amount_vnd")).longValue(),r.get("currency").toString(),((java.sql.Timestamp)r.get("price_effective_from")).toInstant(),(String)r.get("tax_policy_code"),(String)r.get("discount_policy_code"));return new Proof(id,c,b,(UUID)r.get("patient_id"),(UUID)r.get("encounter_id"),(UUID)r.get("offering_id"),r.get("appointment_code").toString(),r.get("status").toString(),price);
  });
 }
}
