package com.clinic.v2.billing.service;
import com.clinic.v2.billing.api.ApiProblem;
import com.clinic.v2.billing.security.BillingDb;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.Instant;
import java.util.*;
import java.util.function.Supplier;
@Service public class SourceChargeService{
 private final JdbcTemplate jdbc;private final BillingDb db;private final ObjectMapper json;private final ChargeSourceClient source;private final ChargeSnapshots snapshots;private final TransactionTemplate tx;
 public SourceChargeService(JdbcTemplate jdbc,BillingDb db,ObjectMapper json,ChargeSourceClient source,ChargeSnapshots snapshots,PlatformTransactionManager manager){this.jdbc=jdbc;this.db=db;this.json=json;this.source=source;this.snapshots=snapshots;tx=new TransactionTemplate(manager);}
 private <T>T local(UUID c,UUID b,Supplier<T> body){return tx.execute(t->{db.scope(c,b);return body.get();});}
 private <T>T relay(Supplier<T> body){return tx.execute(t->{jdbc.execute("select set_config('app.billing_mode','charge-relay',true)");return body.get();});}
 private void keys(JsonNode node,Set<String> expected){if(!node.isObject())throw ApiProblem.invalid("Source event object required");Set<String> actual=new HashSet<>();node.fieldNames().forEachRemaining(actual::add);if(!actual.equals(expected))throw ApiProblem.invalid("Unsupported source charge event fields");}
 private UUID id(JsonNode node,String key){if(!node.path(key).isTextual())throw ApiProblem.invalid("Source identifier required");return UUID.fromString(node.path(key).asText());}
 public record Ack(UUID eventId,boolean received){}
 public Ack ingest(String issuer,JsonNode event){
  keys(event,Set.of("specversion","id","source","type","subject","time","datacontenttype","clinicid","branchid","correlationid","aggregateversion","data"));
  if(!"1.0".equals(event.path("specversion").asText())||!"application/json".equals(event.path("datacontenttype").asText())||!event.path("aggregateversion").isIntegralNumber()||!event.path("aggregateversion").canConvertToLong()||event.path("aggregateversion").asLong()<1)throw ApiProblem.invalid("Versioned source event required");
  boolean medical="medical-v2-service".equals(issuer);String origin=medical?"/services/medical":"/services/encounter",type=medical?"clinic.medical.result_reviewed.v1":"clinic.encounter.clinically_completed.v1";
  if(!Set.of("medical-v2-service","encounter-v2-service").contains(issuer)||!origin.equals(event.path("source").asText())||!type.equals(event.path("type").asText()))throw ApiProblem.forbidden();
  var data=event.path("data");keys(data,medical?Set.of("encounterId","resourceId","actorUserId"):Set.of("encounterId","patientRef","actorUserId","status"));
  try{UUID eventId=id(event,"id"),clinic=id(event,"clinicid"),branch=id(event,"branchid"),encounter=id(data,"encounterId"),resource=medical?id(data,"resourceId"):encounter,patient=medical?null:id(data,"patientRef");id(data,"actorUserId");id(event,"correlationid");Instant.parse(event.path("time").asText());
   if(!("encounter/"+encounter).equals(event.path("subject").asText())||(!medical&&!"CLINICALLY_COMPLETED".equals(data.path("status").asText())))throw ApiProblem.invalid("Source charge subject/state mismatch");
   return local(clinic,branch,()->{jdbc.execute("select set_config('app.billing_mode','charge-relay',true)");db.lock("charge-event:"+eventId);var rows=jdbc.queryForList("select payload_json::text as payload from billing_v2.charge_event_inbox where event_id=?",eventId);
    if(!rows.isEmpty()){JsonNode previous;try{previous=json.readTree(rows.getFirst().get("payload").toString());}catch(Exception ex){throw new IllegalStateException(ex);}if(!previous.equals(event))throw ApiProblem.conflict("Source event ID payload changed");return new Ack(eventId,false);}
    jdbc.update("insert into billing_v2.charge_event_inbox(event_id,source,clinic_id,branch_id,encounter_id,resource_id,patient_id,source_version,kind,payload_json) values(?,?,?,?,?,?,?,?,?,?::jsonb)",eventId,origin,clinic,branch,encounter,resource,patient,event.path("aggregateversion").asLong(),medical?"MEDICAL_REVIEWED":"ENCOUNTER_COMPLETED",event.toString());return new Ack(eventId,true);
   });
  }catch(IllegalArgumentException|java.time.DateTimeException ex){throw ApiProblem.invalid("Invalid source charge identifiers or time");}
 }
 public record Claim(UUID event,UUID clinic,UUID branch,UUID encounter,UUID resource,UUID patient,long version,String kind,UUID lease,int attempts){}
 public Claim claim(){return relay(()->{var rows=jdbc.queryForList("select * from billing_v2.charge_event_inbox where (status='PENDING' and next_attempt_at<=now()) or (status='CLAIMED' and lease_until<=now()) order by received_at,event_id limit 1 for update skip locked");if(rows.isEmpty())return null;var r=rows.getFirst();UUID lease=UUID.randomUUID(),event=(UUID)r.get("event_id");jdbc.update("update billing_v2.charge_event_inbox set status='CLAIMED',lease_token=?,lease_until=now()+interval '30 seconds' where event_id=?",lease,event);return new Claim(event,(UUID)r.get("clinic_id"),(UUID)r.get("branch_id"),(UUID)r.get("encounter_id"),(UUID)r.get("resource_id"),(UUID)r.get("patient_id"),((Number)r.get("source_version")).longValue(),r.get("kind").toString(),lease,((Number)r.get("attempts")).intValue());});}
 public boolean apply(Claim job,List<BillingSources.Charge> charges){if(charges==null||charges.size()>201)throw ApiProblem.invalid("Bounded source charge set required");return local(job.clinic(),job.branch(),()->{
  var rows=jdbc.queryForList("select lease_token,status from billing_v2.charge_event_inbox where event_id=? for update",job.event());if(rows.isEmpty()||!job.lease().equals(rows.getFirst().get("lease_token"))||!"CLAIMED".equals(rows.getFirst().get("status")))return false;
  for(var charge:charges)snapshots.merge(job.clinic(),job.branch(),job.encounter(),charge);
  jdbc.update("update billing_v2.charge_event_inbox set status='APPLIED',lease_token=null,lease_until=null,applied_at=now(),last_error=null where event_id=?",job.event());return true;
 });}
 private void fail(Claim job){int attempts=job.attempts()+1;relay(()->jdbc.update("update billing_v2.charge_event_inbox set status=?,attempts=?,lease_token=null,lease_until=null,last_error='SOURCE_PROOF_OR_RECONCILIATION_FAILURE',next_attempt_at=now()+(? * interval '1 second') where event_id=? and lease_token=? and status='CLAIMED'",attempts>=8?"DLQ":"PENDING",attempts,Math.min(900,1<<Math.min(attempts,9)),job.event(),job.lease()));}
 public void deliver(Claim job){try{var charges="MEDICAL_REVIEWED".equals(job.kind())?source.reviewed(job.clinic(),job.branch(),job.encounter(),job.resource(),job.version()):source.completed(job.clinic(),job.branch(),job.encounter(),job.patient());apply(job,charges);}catch(Exception ex){fail(job);}}
 public void deliverBatch(){for(int i=0;i<5;i++){var job=claim();if(job==null)return;deliver(job);}}
}
