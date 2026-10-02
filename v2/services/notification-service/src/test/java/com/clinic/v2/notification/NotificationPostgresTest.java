package com.clinic.v2.notification;
import com.clinic.v2.notification.security.Actor;
import com.clinic.v2.notification.api.ApiProblem;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
@SpringBootTest(properties={"notification.reminder-before-seconds=3600","notification.reminder-delay-ms=3600000"})
@EnabledIfSystemProperty(named="notification.it.enabled",matches="true")
class NotificationPostgresTest{
 @DynamicPropertySource static void db(DynamicPropertyRegistry r){S1Postgres.configure(r);}
 @Autowired NotificationService service;@Autowired ObjectMapper json;@Autowired JdbcTemplate jdbc;
 UUID user=UUID.randomUUID(),clinic=UUID.randomUUID(),appointment=UUID.randomUUID();Actor actor=new Actor(user,Set.of());
 ObjectNode event(long version,String status){
  var e=json.createObjectNode().put("specversion","1.0").put("id",UUID.randomUUID().toString()).put("source","/services/appointment").put("type","clinic.appointment."+status+".v1").put("clinicid",clinic.toString()).put("aggregateversion",version);
  e.putObject("data").put("appointmentId",appointment.toString()).put("actorUserId",user.toString()).put("startsAt",Instant.now().plusSeconds(1800).toString()).put("status",status.equals("cancelled")?"CANCELLED":"CONFIRMED");return e;
 }
 @Test void staffExceptionNotifiesPatientAndSuppressesReminderWithoutLeakingReason(){
  service.ingest(event(1,"confirmed"));var exception=event(2,"exception_recorded");var data=(ObjectNode)exception.get("data");data.put("actorUserId",UUID.randomUUID().toString()).put("recipientUserId",user.toString()).put("exceptionType","DOCTOR_ABSENT").put("manualContactRequired",false);
  assertTrue(service.ingest(exception));service.preference(actor,true);service.remind();var messages=service.mine(actor);assertEquals(2,messages.size());assertTrue(messages.stream().anyMatch(x->"ACTION_REQUIRED".equals(x.get("kind"))));assertFalse(messages.stream().anyMatch(x->"REMINDER".equals(x.get("kind"))));
  var manual=event(3,"exception_recorded");((ObjectNode)manual.get("data")).put("exceptionType","NO_SHOW").put("manualContactRequired",true);assertFalse(service.ingest(manual));assertFalse(service.ingest(manual));assertEquals(2,service.mine(actor).size());
 }
 @Test void duplicateAndOutOfOrderEventsDoNotResurrectCancelledAppointment(){
  var confirmation=event(1,"confirmed");assertTrue(service.ingest(confirmation));assertFalse(service.ingest(confirmation));
  assertTrue(service.ingest(event(3,"cancelled")));assertFalse(service.ingest(event(2,"rescheduled")));
  service.preference(actor,true);service.remind();
  assertEquals(2,service.mine(actor).size());assertTrue(service.mine(actor).stream().noneMatch(n->"REMINDER".equals(n.get("kind"))));
  assertTrue(service.mine(new Actor(UUID.randomUUID(),Set.of())).isEmpty());
  assertEquals(0,jdbc.queryForObject("select count(*) from notification_v2.notifications",Integer.class));
 }
 @Test void remindersRequireConsentAndAreGeneratedOnce(){
  service.ingest(event(1,"confirmed"));service.remind();assertEquals(1,service.mine(actor).size());
  service.preference(actor,true);service.remind();service.remind();assertEquals(2,service.mine(actor).size());
  assertEquals(1,service.mine(actor).stream().filter(n->"REMINDER".equals(n.get("kind"))).count());
 }
 @Test void rejectsClinicalOrContactFieldsBeforePersisting(){
  var e=event(1,"confirmed");((ObjectNode)e.path("data")).put("diagnosis","Synthetic prohibited");
  assertThrows(ApiProblem.class,()->service.ingest(e));assertTrue(service.mine(actor).isEmpty());
 }
 @Test void resolutionNotifiesOwnedPatientRestoresOnlyConfirmedReminderAndRejectsStale(){
  service.ingest(event(1,"confirmed"));var absent=event(2,"exception_recorded");((ObjectNode)absent.path("data")).put("actorUserId",UUID.randomUUID().toString()).put("recipientUserId",user.toString()).put("exceptionType","DOCTOR_ABSENT");service.ingest(absent);
  var resolved=event(3,"exception_resolved");((ObjectNode)resolved.path("data")).put("actorUserId",UUID.randomUUID().toString()).put("recipientUserId",user.toString()).put("exceptionType","DOCTOR_ABSENT");assertTrue(service.ingest(resolved));assertFalse(service.ingest(resolved));assertFalse(service.ingest(absent));
  service.preference(actor,true);service.remind();var messages=service.mine(actor);assertEquals(1,messages.stream().filter(x->"EXCEPTION_RESOLVED".equals(x.get("kind"))).count());assertEquals(1,messages.stream().filter(x->"REMINDER".equals(x.get("kind"))).count());assertTrue(service.mine(new Actor(UUID.randomUUID(),Set.of())).isEmpty());
 }
 @Test void resolvingAnExceptionDoesNotRestoreReminderForCancelledOrOtherAttention(){
  service.ingest(event(1,"confirmed"));var first=event(2,"exception_resolved");((ObjectNode)first.path("data")).put("status","ATTENTION_REQUIRED").put("recipientUserId",user.toString()).put("exceptionType","DOCTOR_ABSENT");service.ingest(first);service.preference(actor,true);service.remind();assertFalse(service.mine(actor).stream().anyMatch(x->"REMINDER".equals(x.get("kind"))));
  var terminal=event(3,"exception_resolved");((ObjectNode)terminal.path("data")).put("status","CANCELLED").put("recipientUserId",user.toString()).put("exceptionType","DOCTOR_ABSENT");service.ingest(terminal);service.remind();assertFalse(service.mine(actor).stream().anyMatch(x->"REMINDER".equals(x.get("kind"))));
 }
}
