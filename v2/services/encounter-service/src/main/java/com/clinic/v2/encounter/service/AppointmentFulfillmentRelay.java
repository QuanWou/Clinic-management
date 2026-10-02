package com.clinic.v2.encounter.service;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
@Configuration @EnableScheduling
@ConditionalOnProperty(name="encounter.relay.enabled",havingValue="true")
public class AppointmentFulfillmentRelay {
 private final JdbcTemplate jdbc;private final EncounterSources sources;
 public AppointmentFulfillmentRelay(JdbcTemplate jdbc,EncounterSources sources){this.jdbc=jdbc;this.sources=sources;}
 @Scheduled(fixedDelayString="${encounter.relay.delay-ms:1000}") @Transactional public void deliver(){
  jdbc.execute("select set_config('app.encounter_mode','relay',true)");
  for(var row:jdbc.queryForList("select * from encounter_v2.appointment_deliveries where status='PENDING' and next_attempt_at<=now() order by created_at limit 5 for update skip locked")){
   try{
    sources.fulfill((java.util.UUID)row.get("clinic_id"),(java.util.UUID)row.get("branch_id"),(java.util.UUID)row.get("appointment_id"),(java.util.UUID)row.get("event_id"),(java.util.UUID)row.get("encounter_id"),(java.util.UUID)row.get("actor_user_id"));
    jdbc.update("update encounter_v2.appointment_deliveries set status='PUBLISHED',published_at=now(),last_error=null where event_id=?",row.get("event_id"));
   }catch(Exception e){int n=((Number)row.get("attempts")).intValue()+1;jdbc.update("update encounter_v2.appointment_deliveries set attempts=?,status=?,next_attempt_at=now()+(?*interval '1 second'),last_error='FULFILLMENT_UNACKNOWLEDGED' where event_id=?",n,n>=5?"DLQ":"PENDING",Math.min(900,1<<Math.min(n,9)),row.get("event_id"));}
  }
 }
}
