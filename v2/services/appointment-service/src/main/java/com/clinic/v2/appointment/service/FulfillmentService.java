package com.clinic.v2.appointment.service;
import com.clinic.v2.appointment.api.ApiProblem;
import com.clinic.v2.appointment.security.TenantDbContext;
import jakarta.validation.constraints.NotNull;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
@Service
public class FulfillmentService {
 private final JdbcTemplate jdbc;private final TenantDbContext db;private final ArrivalService arrivals;
 public FulfillmentService(JdbcTemplate jdbc,TenantDbContext db,ArrivalService arrivals){this.jdbc=jdbc;this.db=db;this.arrivals=arrivals;}
 public record Input(@NotNull UUID eventId,@NotNull UUID encounterId,@NotNull UUID actorUserId){}
 @Transactional public ArrivalService.Booking accept(UUID clinic,UUID branch,UUID id,Input in){
  db.tenant(clinic);jdbc.queryForObject("select pg_advisory_xact_lock(hashtextextended(?,0))",Object.class,"fulfillment-event:"+in.eventId());
  if(jdbc.queryForList("select id from appointment_v2.appointments where id=? and branch_id=? for update",UUID.class,id,branch).isEmpty())throw ApiProblem.missing();
  var a=arrivals.read(clinic,branch,id);if(!in.encounterId().equals(a.encounterId()))throw ApiProblem.conflict("Fulfillment encounter mismatch");
  var old=jdbc.queryForList("select * from appointment_v2.fulfillment_receipts where event_id=?",in.eventId());
  if(!old.isEmpty()){var r=old.getFirst();if(!clinic.equals(r.get("clinic_id"))||!branch.equals(r.get("branch_id"))||!id.equals(r.get("appointment_id"))||!in.encounterId().equals(r.get("encounter_id"))||!in.actorUserId().equals(r.get("actor_user_id")))throw ApiProblem.conflict("Fulfillment event payload changed");return a;}
  if(!Set.of("CHECKED_IN","FULFILLED").contains(a.status()))throw ApiProblem.conflict("Only a checked-in booking can be fulfilled");
  if("CHECKED_IN".equals(a.status())){
   jdbc.update("update appointment_v2.appointments set status='FULFILLED',fulfilled_at=now(),row_version=row_version+1,updated_at=now() where id=?",id);
   jdbc.update("insert into appointment_v2.appointment_history(id,appointment_id,from_status,to_status,actor_user_id,reason,correlation_id) values(?,?,'CHECKED_IN','FULFILLED',?,'Source encounter clinically completed',?)",UUID.randomUUID(),id,in.actorUserId(),in.eventId().toString());
  }
  jdbc.update("insert into appointment_v2.fulfillment_receipts(event_id,clinic_id,branch_id,appointment_id,encounter_id,actor_user_id) values(?,?,?,?,?,?)",in.eventId(),clinic,branch,id,in.encounterId(),in.actorUserId());return arrivals.read(clinic,branch,id);
 }
}
