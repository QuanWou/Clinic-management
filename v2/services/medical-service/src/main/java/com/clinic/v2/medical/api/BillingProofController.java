package com.clinic.v2.medical.api;
import com.clinic.v2.medical.security.*;
import com.clinic.v2.medical.service.MedicalSources;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.web.bind.annotation.*;
import java.util.*;
@RestController
public class BillingProofController {
 private final JdbcTemplate jdbc;private final MedicalDb db;private final BillingPeerVerifier peer;private final IamAuthorizationClient iam;private final TransactionTemplate tx;private final ObjectMapper json;
 public BillingProofController(JdbcTemplate jdbc,MedicalDb db,BillingPeerVerifier peer,IamAuthorizationClient iam,PlatformTransactionManager manager,ObjectMapper json){this.jdbc=jdbc;this.db=db;this.peer=peer;this.iam=iam;tx=new TransactionTemplate(manager);this.json=json;}
 public record Order(UUID id,UUID offeringId,String name,MedicalSources.Snapshot price){}
 public record Proof(UUID encounterId,UUID clinicId,UUID branchId,UUID patientId,long caseVersion,String status,List<Order> orders){}
 @GetMapping("/api/v2/internal/clinics/{c}/branches/{b}/visits/{id}/billing-proof")
 public Proof proof(@RequestHeader(value="Authorization",required=false) String bearer,@RequestHeader("X-Actor-User-Id") UUID actor,@PathVariable UUID c,@PathVariable UUID b,@PathVariable UUID id){
  peer.require(bearer,"billing.source.read");if(!iam.decide(actor,"BILLING",c,b).allowed())throw ApiProblem.forbidden();
  return localProof(c,b,id);
 }
 @GetMapping("/api/v2/internal/clinics/{c}/branches/{b}/visits/{id}/billing-sync-proof")
 public Proof systemProof(@RequestHeader(value="Authorization",required=false) String bearer,@PathVariable UUID c,@PathVariable UUID b,@PathVariable UUID id){peer.require(bearer,"billing.source.sync");return localProof(c,b,id);}
 public record ReviewedOrder(UUID encounterId,UUID clinicId,UUID branchId,UUID patientId,long caseVersion,UUID id,UUID offeringId,String name,MedicalSources.Snapshot price,String state){}
 @GetMapping("/api/v2/internal/clinics/{c}/branches/{b}/orders/{id}/billing-sync-proof")
 public ReviewedOrder reviewedOrder(@RequestHeader(value="Authorization",required=false) String bearer,@PathVariable UUID c,@PathVariable UUID b,@PathVariable UUID id){
  peer.require(bearer,"billing.source.sync");return tx.execute(t->{db.scope(c,b);var rows=jdbc.queryForList("select o.id,o.encounter_id,o.offering_id,o.name,o.price_snapshot_json,o.state,c.patient_id,c.row_version from medical_v2.orders o join medical_v2.cases c on c.encounter_id=o.encounter_id where o.id=?",id);if(rows.isEmpty())throw ApiProblem.missing();var r=rows.getFirst();if(!"REVIEWED".equals(r.get("state")))throw ApiProblem.conflict("Authenticated reviewed order required");MedicalSources.Snapshot price;try{price=json.readValue(r.get("price_snapshot_json").toString(),MedicalSources.Snapshot.class);}catch(Exception ex){throw new IllegalStateException(ex);}return new ReviewedOrder((UUID)r.get("encounter_id"),c,b,(UUID)r.get("patient_id"),((Number)r.get("row_version")).longValue(),id,(UUID)r.get("offering_id"),r.get("name").toString(),price,"REVIEWED");});
 }
 private Proof localProof(UUID c,UUID b,UUID id){
  return tx.execute(t->{db.scope(c,b);var rows=jdbc.queryForList("select patient_id,row_version,status from medical_v2.cases where encounter_id=?",id);if(rows.isEmpty())throw ApiProblem.missing();var r=rows.getFirst();if(!"VALIDATED".equals(r.get("status")))throw ApiProblem.conflict("Immutable validated case required");
   var orders=jdbc.query("select id,offering_id,name,price_snapshot_json from medical_v2.orders where encounter_id=? and state='REVIEWED' order by created_at",(rs,n)->{try{return new Order(rs.getObject("id",UUID.class),rs.getObject("offering_id",UUID.class),rs.getString("name"),json.readValue(rs.getString("price_snapshot_json"),MedicalSources.Snapshot.class));}catch(com.fasterxml.jackson.core.JsonProcessingException e){throw new IllegalStateException(e);}},id);
   return new Proof(id,c,b,(UUID)r.get("patient_id"),((Number)r.get("row_version")).longValue(),"VALIDATED",orders);
  });
 }
}
