package com.clinic.v2.billing.service;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.util.*;
import java.util.function.Supplier;
@Service public class BillingNotificationDelivery{
 private final JdbcTemplate jdbc;private final FinancialNotificationClient client;private final ObjectMapper json;private final TransactionTemplate tx;
 public BillingNotificationDelivery(JdbcTemplate jdbc,FinancialNotificationClient client,ObjectMapper json,PlatformTransactionManager manager){this.jdbc=jdbc;this.client=client;this.json=json;tx=new TransactionTemplate(manager);}
 private <T>T local(Supplier<T> body){return tx.execute(t->{jdbc.execute("select set_config('app.billing_mode','notification-relay',true)");return body.get();});}
 public record Claim(UUID event,UUID clinic,UUID patient,UUID recipient,UUID lease,String payload,int attempts){}
 public Claim claim(){return local(()->{
  var rows=jdbc.queryForList("select * from billing_v2.notification_deliveries where (status='PENDING' and next_attempt_at<=now()) or (status='CLAIMED' and lease_until<=now()) order by created_at,event_id limit 1 for update skip locked");if(rows.isEmpty())return null;var row=rows.getFirst();UUID lease=UUID.randomUUID(),event=(UUID)row.get("event_id");
  jdbc.update("update billing_v2.notification_deliveries set status='CLAIMED',lease_token=?,lease_until=now()+interval '30 seconds' where event_id=?",lease,event);
  return new Claim(event,(UUID)row.get("clinic_id"),(UUID)row.get("patient_id"),(UUID)row.get("recipient_user_id"),lease,row.get("payload_json").toString(),((Number)row.get("attempts")).intValue());
 });}
 private boolean bind(Claim job,UUID user){return local(()->jdbc.update("update billing_v2.notification_deliveries set recipient_user_id=? where event_id=? and lease_token=? and status='CLAIMED' and (recipient_user_id is null or recipient_user_id=?)",user,job.event(),job.lease(),user)==1);}
 public void finish(Claim job,String state,String error){local(()->jdbc.update("update billing_v2.notification_deliveries set status=?,lease_token=null,lease_until=null,last_error=?,delivered_at=case when ?='DELIVERED' then now() else null end where event_id=? and lease_token=? and status='CLAIMED'",state,error,state,job.event(),job.lease()));}
 private void fail(Claim job){int attempts=job.attempts()+1;local(()->jdbc.update("update billing_v2.notification_deliveries set status=?,attempts=?,lease_token=null,lease_until=null,last_error='NOTIFICATION_DEPENDENCY_OR_PROOF_FAILURE',next_attempt_at=now()+(? * interval '1 second') where event_id=? and lease_token=? and status='CLAIMED'",attempts>=5?"DLQ":"PENDING",attempts,Math.min(900,1<<Math.min(attempts,9)),job.event(),job.lease()));}
 public void deliver(Claim job){
  try{
   var recipient=client.recipient(job.clinic(),job.patient());
   if(!"OWNED".equals(recipient.status())){finish(job,"MANUAL_CONTACT",recipient.status());return;}
   if(job.recipient()!=null&&!job.recipient().equals(recipient.userId()))throw new IllegalStateException("Recipient proof changed");
   if(!bind(job,recipient.userId()))return;
   var event=(ObjectNode)json.readTree(job.payload());var data=(ObjectNode)event.path("data");data.remove("actorUserId");data.put("recipientUserId",recipient.userId().toString());
   client.send(event);finish(job,"DELIVERED",null);
  }catch(Exception ex){fail(job);}
 }
 public void deliverBatch(){for(int i=0;i<5;i++){var job=claim();if(job==null)return;deliver(job);}}
}
