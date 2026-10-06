package com.clinic.billing.service;
import com.clinic.billing.api.ApiProblem;
import com.clinic.billing.security.*;
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
@Service public class SourceChargeOperations{
 private final JdbcTemplate jdbc;private final BillingDb db;private final IamAuthorizationClient iam;private final ObjectMapper json;private final TransactionTemplate tx;
 public SourceChargeOperations(JdbcTemplate jdbc,BillingDb db,IamAuthorizationClient iam,ObjectMapper json,PlatformTransactionManager manager){this.jdbc=jdbc;this.db=db;this.iam=iam;this.json=json;tx=new TransactionTemplate(manager);}
 private void require(Actor actor,UUID clinic,UUID branch,boolean retry){if(actor==null)throw ApiProblem.forbidden();var decision=iam.decide(actor.id(),"BILLING",clinic,branch);if(!decision.allowed()||decision.role()==null||!(retry?Set.of("ADMIN"):Set.of("ADMIN","STAFF")).contains(decision.role()))throw ApiProblem.forbidden();}
 private <T>T local(UUID clinic,UUID branch,Supplier<T> body){return tx.execute(t->{db.scope(clinic,branch);return body.get();});}
 public record EventState(UUID eventId,String status,int attempts,String lastError,String kind){}
 public record State(List<EventState> events,Long chargeCount){}
 private State state(UUID encounter){return new State(jdbc.query("select * from billing_v2.charge_event_inbox where encounter_id=? order by received_at,event_id limit 100",(rs,n)->new EventState(rs.getObject("event_id",UUID.class),rs.getString("status"),rs.getInt("attempts"),rs.getString("last_error"),rs.getString("kind")),encounter),jdbc.queryForObject("select count(*) from billing_v2.charges where encounter_id=?",Long.class,encounter));}
 public State read(Actor actor,UUID clinic,UUID branch,UUID encounter){require(actor,clinic,branch,false);return local(clinic,branch,()->state(encounter));}
 public State retry(Actor actor,UUID clinic,UUID branch,UUID encounter,UUID eventId,String key,String reason){
  require(actor,clinic,branch,true);if(key==null||key.isBlank()||key.length()>120||reason==null||reason.isBlank()||reason.length()>500)throw ApiProblem.invalid("Bounded recovery key and reason required");
  String digest;try{digest=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(json.writeValueAsBytes(List.of(encounter,eventId,reason))));}catch(Exception ex){throw new IllegalStateException(ex);}
  return local(clinic,branch,()->{
   db.lock("charge-recovery:"+actor.id()+":"+key);var receipts=jdbc.queryForList("select payload_hash from billing_v2.charge_recovery_commands where actor_user_id=? and key=?",actor.id(),key);
   if(!receipts.isEmpty()){if(!digest.equals(receipts.getFirst().get("payload_hash")))throw ApiProblem.conflict("Recovery key payload changed");return state(encounter);}
   var rows=jdbc.queryForList("select * from billing_v2.charge_event_inbox where event_id=? and encounter_id=? for update",eventId,encounter);if(rows.isEmpty())throw ApiProblem.missing();var row=rows.getFirst();
   if(!"DLQ".equals(row.get("status")))throw ApiProblem.conflict("Only failed deliveries can be explicitly retried");
   jdbc.update("update billing_v2.charge_event_inbox set status='PENDING',attempts=0,next_attempt_at=now(),last_error=null where event_id=?",eventId);
   jdbc.update("insert into billing_v2.charge_recovery_commands(clinic_id,branch_id,actor_user_id,key,payload_hash,event_id,reason) values(?,?,?,?,?,?,?)",clinic,branch,actor.id(),key,digest,eventId,reason.trim());
   try{
    var event=new LinkedHashMap<String,Object>();UUID auditId=UUID.randomUUID();event.put("specversion","1.0");event.put("id",auditId.toString());event.put("source","/services/billing");event.put("type","clinic.billing.charge_retry_requested.v1");event.put("time",Instant.now().toString());event.put("datacontenttype","application/json");event.put("clinicid",clinic.toString());event.put("branchid",branch.toString());event.put("correlationid",UUID.randomUUID().toString());event.put("subject","billing/"+encounter);event.put("aggregateversion",1);event.put("data",Map.of("billingId",encounter.toString(),"resourceId",eventId.toString(),"actorUserId",actor.id().toString()));
    jdbc.update("insert into billing_v2.outbox_events(event_id,clinic_id,branch_id,aggregate_id,event_type,payload_json) values(?,?,?,?,?,?)",auditId,clinic,branch,encounter,event.get("type"),json.writeValueAsString(event));
   }catch(Exception ex){throw new IllegalStateException(ex);}
   return state(encounter);
  });
 }
}

