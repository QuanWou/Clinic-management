package com.clinic.v2.appointment.service;
import com.clinic.v2.appointment.security.WorkloadTokenIssuer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import java.time.Duration;
@Configuration @EnableScheduling
@ConditionalOnProperty(name="appointment.relay.enabled",havingValue="true")
public class AppointmentEventRelay {
 private final JdbcTemplate jdbc;private final WorkloadTokenIssuer tokens;private final RestClient notifications,audit;
 public AppointmentEventRelay(JdbcTemplate jdbc,WorkloadTokenIssuer tokens,@Value("${appointment.relay.notification-url:http://127.0.0.1:8100}") String notificationUrl,@Value("${appointment.relay.audit-url:http://127.0.0.1:8096}") String auditUrl){
  this.jdbc=jdbc;this.tokens=tokens;var f=new SimpleClientHttpRequestFactory();f.setConnectTimeout(Duration.ofSeconds(2));f.setReadTimeout(Duration.ofSeconds(2));
  notifications=RestClient.builder().baseUrl(notificationUrl).requestFactory(f).build();audit=RestClient.builder().baseUrl(auditUrl).requestFactory(f).build();
 }
 @Scheduled(fixedDelayString="${appointment.relay.delay-ms:1000}") @Transactional public void deliver(){
  jdbc.execute("select set_config('app.appointment_mode','relay',true)");
  for(var row:jdbc.queryForList("select * from appointment_v2.outbox_events where status='PENDING' and next_attempt_at<=now() order by created_at limit 5 for update skip locked")){
   boolean notified=row.get("notification_published_at")!=null,audited=row.get("audit_published_at")!=null;
   Object id=row.get("id");
   try{
    if(!notified){
     notifications.post().uri("/api/v2/internal/notifications/events").header("Authorization",tokens.bearer("notification-v2-service","notification.consume"))
      .contentType(MediaType.APPLICATION_JSON).body(row.get("payload_json").toString()).retrieve().toBodilessEntity();
     jdbc.update("update appointment_v2.outbox_events set notification_published_at=now() where id=?",id);
    }
    if(!audited){
     audit.post().uri("/api/v2/internal/audit/appointment-events").header("Authorization",tokens.bearer("audit-v2-service","audit.write"))
      .contentType(MediaType.APPLICATION_JSON).body(row.get("payload_json").toString()).retrieve().toBodilessEntity();
     jdbc.update("update appointment_v2.outbox_events set audit_published_at=now() where id=?",id);
    }
    jdbc.update("update appointment_v2.outbox_events set status='PUBLISHED',published_at=now(),last_error=null where id=?",id);
   }catch(Exception failure){
    int attempts=((Number)row.get("attempts")).intValue()+1;
    String error=failure instanceof org.springframework.web.client.RestClientResponseException response?"DELIVERY_HTTP_"+response.getStatusCode().value():"DELIVERY_"+failure.getClass().getSimpleName();
    jdbc.update("update appointment_v2.outbox_events set attempts=?,status=?,next_attempt_at=now()+(? * interval '1 second'),last_error=? where id=?",attempts,attempts>=5?"DEAD_LETTER":"PENDING",Math.min(900,1<<Math.min(attempts,9)),error,id);
   }
  }
 }
}

