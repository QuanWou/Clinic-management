package com.clinic.medical.service;
import com.clinic.medical.api.ApiProblem;
import com.clinic.medical.security.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.Instant;
import java.util.*;
import java.util.function.Supplier;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
@Service public class ChargeDeliveryOperations{
 private final JdbcTemplate jdbc;private final MedicalDb db;private final IamAuthorizationClient iam;private final ObjectMapper json;private final TransactionTemplate tx;
 public ChargeDeliveryOperations(JdbcTemplate jdbc,MedicalDb db,IamAuthorizationClient iam,ObjectMapper json,PlatformTransactionManager manager){this.jdbc=jdbc;this.db=db;this.iam=iam;this.json=json;tx=new TransactionTemplate(manager);}
 private boolean allowed(Actor actor,UUID clinic,UUID branch,String capability){return actor!=null&&iam.decide(actor.id(),capability,clinic,branch).allowed();}
 private void requireRead(Actor actor,UUID clinic,UUID branch){if(!allowed(actor,clinic,branch,"BILLING")&&!allowed(actor,clinic,branch,"FINANCE_VIEW"))throw ApiProblem.forbidden();}
 private void requireManage(Actor actor,UUID clinic,UUID branch){if(!allowed(actor,clinic,branch,"FINANCE_MANAGE"))throw ApiProblem.forbidden();}
 private <T>T local(UUID clinic,UUID branch,Supplier<T> body){return tx.execute(t->{db.scope(clinic,branch);return body.get();});}
 public record EventState(UUID eventId,String status,int attempts,String lastError,String kind){}
 public record State(List<EventState> events,Long chargeCount){}
 private State state(UUID encounter){return new State(jdbc.query("select * from medical_v2.billing_deliveries where event_id in (select event_id from medical_v2.outbox_events where aggregate_id=?) order by created_at,event_id limit 100",(rs,n)->new EventState(rs.getObject("event_id",UUID.class),rs.getString("status"),rs.getInt("attempts"),rs.getString("last_error"),null),encounter),null);}
 public State read(Actor actor,UUID clinic,UUID branch,UUID encounter){requireRead(actor,clinic,branch);return local(clinic,branch,()->state(encounter));}
 public State retry(Actor actor,UUID clinic,UUID branch,UUID encounter,UUID eventId,String key,String reason){
  requireManage(actor,clinic,branch);if(key==null||key.isBlank()||key.length()>120||reason==null||reason.isBlank()||reason.length()>500)throw ApiProblem.invalid("Bounded recovery key and reason required");
  String digest;try{digest=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(json.writeValueAsBytes(List.of(encounter,eventId,reason))));}catch(Exception ex){throw new IllegalStateException(ex);}
  return local(clinic,branch,()->{
   db.lock("charge-recovery:"+actor.id()+":"+key);var receipts=jdbc.queryForList("select payload_hash from medical_v2.charge_recovery_commands where actor_user_id=? and key=?",actor.id(),key);
   if(!receipts.isEmpty()){if(!digest.equals(receipts.getFirst().get("payload_hash")))throw ApiProblem.conflict("Recovery key payload changed");return state(encounter);}
   var rows=jdbc.queryForList("select * from medical_v2.billing_deliveries where event_id=? and event_id in (select event_id from medical_v2.outbox_events where aggregate_id=?) for update",eventId,encounter);if(rows.isEmpty())throw ApiProblem.missing();var row=rows.getFirst();
   if(!"DLQ".equals(row.get("status")))throw ApiProblem.conflict("Only failed deliveries can be explicitly retried");
   jdbc.update("update medical_v2.billing_deliveries set status='PENDING',attempts=0,next_attempt_at=now(),last_error=null where event_id=?",eventId);
   jdbc.update("insert into medical_v2.charge_recovery_commands(clinic_id,branch_id,actor_user_id,key,payload_hash,event_id,reason) values(?,?,?,?,?,?,?)",clinic,branch,actor.id(),key,digest,eventId,reason.trim());
   try{
    var event=json.readValue(row.get("payload_json").toString(),new com.fasterxml.jackson.core.type.TypeReference<LinkedHashMap<String,Object>>() {});UUID auditId=UUID.randomUUID();event.put("specversion","1.0");event.put("id",auditId.toString());event.put("source","/services/medical");event.put("type","clinic.medical.billing_retry_requested.v1");event.put("time",Instant.now().toString());event.put("datacontenttype","application/json");event.put("clinicid",clinic.toString());event.put("branchid",branch.toString());event.put("correlationid",UUID.randomUUID().toString());var metadata=json.convertValue(event.get("data"),new com.fasterxml.jackson.core.type.TypeReference<LinkedHashMap<String,Object>>() {});metadata.put("actorUserId",actor.id().toString());metadata.put("resourceId",eventId.toString());event.put("data",metadata);
    jdbc.update("insert into medical_v2.outbox_events(event_id,clinic_id,branch_id,aggregate_id,event_type,payload_json) values(?,?,?,?,?,?)",auditId,clinic,branch,encounter,event.get("type"),json.writeValueAsString(event));
   }catch(Exception ex){throw new IllegalStateException(ex);}
   return state(encounter);
  });
 }
}

