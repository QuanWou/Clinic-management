package com.clinic.notification;
import com.clinic.notification.api.ApiProblem;
import com.clinic.notification.security.Actor;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;
import java.nio.charset.StandardCharsets;
@Service
public class NotificationService {
 private final JdbcTemplate jdbc;private final long reminderSeconds;
 public NotificationService(JdbcTemplate jdbc,@Value("${notification.reminder-before-seconds:86400}") long reminderSeconds){
  if(reminderSeconds<60||reminderSeconds>604800)throw new IllegalArgumentException("Invalid reminder interval");
  this.jdbc=jdbc;this.reminderSeconds=reminderSeconds;
 }
 private void consumer(){jdbc.execute("select set_config('app.notification_mode','consumer',true)");}
 private void user(Actor actor){if(actor==null)throw ApiProblem.forbidden();jdbc.queryForObject("select set_config('app.user_id',?,true)",String.class,actor.id().toString());}
 @Transactional public boolean ingest(JsonNode event){
  String type=event.path("type").asText();
  if(!"1.0".equals(event.path("specversion").asText())||!"/services/appointment".equals(event.path("source").asText())||
   !Set.of("clinic.appointment.confirmed.v1","clinic.appointment.cancelled.v1","clinic.appointment.rescheduled.v1","clinic.appointment.exception_recorded.v1","clinic.appointment.exception_resolved.v1").contains(type))throw ApiProblem.invalid("Unsupported notification event");
  var data=event.path("data");
  Set<String> allowed=Set.of("appointmentId","patientRef","slotId","oldSlotId","newSlotId","status","actorUserId","startsAt","exceptionType","recipientUserId","manualContactRequired");
  data.fieldNames().forEachRemaining(k->{if(!allowed.contains(k))throw ApiProblem.invalid("Notification event contains unsupported fields");});
  try{
   boolean resolved=type.contains(".exception_resolved."),exception=resolved||type.contains(".exception_recorded.");
   if(resolved&&!Set.of("CONFIRMED","ATTENTION_REQUIRED","NO_SHOW","CANCELLED","CHECKED_IN","FULFILLED").contains(data.path("status").asText()))throw ApiProblem.invalid("Invalid resolved appointment state");
   UUID id=UUID.fromString(event.path("id").asText()),appointment=UUID.fromString(data.path("appointmentId").asText()),clinic=UUID.fromString(event.path("clinicid").asText());
   if(exception&&!Set.of("LATE","NO_SHOW","DOCTOR_ABSENT").contains(data.path("exceptionType").asText()))throw ApiProblem.invalid("Invalid appointment exception");
   if(exception&&data.path("manualContactRequired").asBoolean(false)){
    long manualVersion=event.path("aggregateversion").asLong();if(manualVersion<1)throw ApiProblem.invalid("Missing source version");Instant.parse(data.path("startsAt").asText());
    consumer();jdbc.execute("select pg_advisory_xact_lock(hashtextextended('notification:"+appointment+"',0))");
    if(jdbc.queryForObject("select count(*) from notification_v2.event_inbox where source='appointment-service' and event_id=?",Integer.class,id)>0)return false;
    jdbc.update("update notification_v2.appointment_states set status=?,source_version=?,reminder_at=? where appointment_id=? and clinic_id=? and source_version<?",resolved?data.path("status").asText():"NO_SHOW".equals(data.path("exceptionType").asText())?"NO_SHOW":"ATTENTION_REQUIRED",manualVersion,resolved&&"CONFIRMED".equals(data.path("status").asText())?java.sql.Timestamp.from(Instant.parse(data.path("startsAt").asText()).minusSeconds(reminderSeconds)):null,appointment,clinic,manualVersion);
    jdbc.update("insert into notification_v2.event_inbox(source,event_id) values('appointment-service',?) on conflict do nothing",id);return false;
   }
   UUID user=UUID.fromString(data.path(exception?"recipientUserId":"actorUserId").asText());
   Instant starts=Instant.parse(data.path("startsAt").asText());long version=event.path("aggregateversion").asLong();
   if(version<1)throw ApiProblem.invalid("Missing source version");
   consumer();jdbc.execute("select pg_advisory_xact_lock(hashtextextended('notification:"+appointment+"',0))");
   if(jdbc.queryForObject("select count(*) from notification_v2.event_inbox where source='appointment-service' and event_id=?",Integer.class,id)>0)return false;
   var previous=jdbc.queryForList("select source_version,user_id,clinic_id from notification_v2.appointment_states where appointment_id=?",appointment);
   boolean apply=previous.isEmpty()||((Number)previous.getFirst().get("source_version")).longValue()<version;
   if(!previous.isEmpty()&&(!user.equals(previous.getFirst().get("user_id"))||!clinic.equals(previous.getFirst().get("clinic_id"))))throw ApiProblem.forbidden();
   if(apply){
    boolean cancelled=type.contains(".cancelled.")||(exception&&!resolved&&"NO_SHOW".equals(data.path("exceptionType").asText()));String status=resolved?data.path("status").asText():exception?(cancelled?"NO_SHOW":"ATTENTION_REQUIRED"):cancelled?"CANCELLED":"CONFIRMED";
    jdbc.update("insert into notification_v2.appointment_states(appointment_id,clinic_id,user_id,status,starts_at,source_version,reminder_at) values(?,?,?,?,?,?,?) on conflict(appointment_id) do update set status=excluded.status,starts_at=excluded.starts_at,source_version=excluded.source_version,reminder_at=excluded.reminder_at",
     appointment,clinic,user,status,java.sql.Timestamp.from(starts),version,"CONFIRMED".equals(status)?java.sql.Timestamp.from(starts.minusSeconds(reminderSeconds)):null);
    String message=resolved?"Phòng khám đã cập nhật xử lý ngoại lệ. Vui lòng xem trạng thái lịch của bạn.":exception?"Lịch khám cần được phòng khám kiểm tra và liên hệ xử lý. Vui lòng xem lịch của bạn.":cancelled?"Lịch khám đã được hủy.":type.contains(".rescheduled.")?"Lịch khám đã được đổi giờ.":"Lịch khám đã được xác nhận.";
    jdbc.update("insert into notification_v2.notifications(id,user_id,clinic_id,appointment_id,kind,message) values(?,?,?,?,?,?)",id,user,clinic,appointment,resolved?"EXCEPTION_RESOLVED":exception?"ACTION_REQUIRED":cancelled?"CANCELLED":type.contains(".rescheduled.")?"RESCHEDULED":"CONFIRMED",message);
   }
   jdbc.update("insert into notification_v2.event_inbox(source,event_id) values('appointment-service',?)",id);return apply;
  }catch(IllegalArgumentException|java.time.DateTimeException e){throw ApiProblem.invalid("Invalid notification identifiers or time");}
 }
 @Transactional(readOnly=true) public List<Map<String,Object>> mine(Actor actor){user(actor);return jdbc.queryForList("select id,clinic_id,appointment_id,billing_id,kind,message,created_at,read_at from notification_v2.notifications order by created_at desc limit 50");}
 @Transactional(readOnly=true) public long unreadCount(Actor actor){user(actor);return jdbc.queryForObject("select count(*) from notification_v2.notifications where user_id=? and read_at is null",Long.class,actor.id());}
 @Transactional public void markRead(Actor actor,UUID id){user(actor);jdbc.update("update notification_v2.notifications set read_at=coalesce(read_at,now()) where id=? and user_id=?",id,actor.id());}
 @Transactional public boolean preference(Actor actor,boolean enabled){
  user(actor);jdbc.update("insert into notification_v2.preferences(user_id,reminders_enabled) values(?,?) on conflict(user_id) do update set reminders_enabled=excluded.reminders_enabled,updated_at=now()",actor.id(),enabled);return enabled;
 }
 @Transactional(readOnly=true) public boolean preference(Actor actor){user(actor);var values=jdbc.queryForList("select reminders_enabled from notification_v2.preferences where user_id=?",Boolean.class,actor.id());return !values.isEmpty()&&values.getFirst();}
 @Scheduled(fixedDelayString="${notification.reminder-delay-ms:60000}") @Transactional public void remind(){
  consumer();
  var due=jdbc.queryForList("select s.* from notification_v2.appointment_states s join notification_v2.preferences p on p.user_id=s.user_id and p.reminders_enabled where s.status='CONFIRMED' and s.reminder_at<=now() and s.starts_at>now() and s.reminded_version<s.source_version order by s.reminder_at limit 100 for update of s skip locked");
  for(var row:due){
   UUID id=UUID.nameUUIDFromBytes((row.get("appointment_id")+"|"+row.get("source_version")+"|reminder").getBytes(StandardCharsets.UTF_8));
   jdbc.update("insert into notification_v2.notifications(id,user_id,clinic_id,appointment_id,kind,message) values(?,?,?,?,'REMINDER','Bạn có lịch khám sắp tới. Kiểm tra lại giờ khám trong lịch của bạn.') on conflict(id) do nothing",id,row.get("user_id"),row.get("clinic_id"),row.get("appointment_id"));
   jdbc.update("update notification_v2.appointment_states set reminded_version=source_version where appointment_id=?",row.get("appointment_id"));
  }
 }
}
