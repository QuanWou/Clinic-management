package com.clinic.v2.appointment.service;
import com.clinic.v2.appointment.api.ApiProblem;
import com.clinic.v2.appointment.security.TenantDbContext;
import com.clinic.v2.appointment.source.PatientSourceClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.constraints.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.util.*;
import java.time.Instant;
import java.security.MessageDigest;
@Service
public class ReceptionExceptionService {
 private final JdbcTemplate jdbc;private final TenantDbContext db;private final ArrivalService arrivals;private final PatientSourceClient patients;private final ObjectMapper json;private final TransactionTemplate tx;
 public ReceptionExceptionService(JdbcTemplate jdbc,TenantDbContext db,ArrivalService arrivals,PatientSourceClient patients,ObjectMapper json,PlatformTransactionManager manager){this.jdbc=jdbc;this.db=db;this.arrivals=arrivals;this.patients=patients;this.json=json;this.tx=new TransactionTemplate(manager);}
 public record Input(@NotNull UUID actorUserId,@Min(0) long expectedVersion,@NotBlank @Pattern(regexp="LATE|NO_SHOW|DOCTOR_ABSENT") String type,@NotBlank @Size(max=500) String reason,UUID sourceAbsenceId,UUID absenceDoctorId,Instant absenceStartsAt,Instant absenceEndsAt){public Input(UUID actorUserId,long expectedVersion,String type,String reason){this(actorUserId,expectedVersion,type,reason,null,null,null,null);}}
 public record View(UUID id,UUID appointmentId,String type,String state,String notificationMode){}
 public record ResolveInput(@NotNull UUID actorUserId,@Min(0) long expectedVersion,@NotBlank @Size(max=500) String reason){}
 public List<View> list(UUID clinic,UUID branch,UUID appointment){return tx.execute(s->{db.tenant(clinic);arrivals.read(clinic,branch,appointment);return jdbc.query("select * from appointment_v2.reception_exceptions where appointment_id=? and branch_id=? order by created_at",(rs,n)->new View(rs.getObject("id",UUID.class),appointment,rs.getString("exception_type"),rs.getString("state"),rs.getString("notification_mode")),appointment,branch);});}
 public View record(UUID clinic,UUID branch,UUID appointment,String key,Input in){
  if(key==null||key.isBlank()||key.length()>120)throw ApiProblem.invalid("Idempotency-Key is required");
  var source=arrivals.read(clinic,branch,appointment);UUID recipient=null;
  try{recipient=patients.booking(source.patientId()).platformUserId();}catch(ApiProblem ignored){/* No verified account/dependency: explicit manual-contact exception. */}
  final UUID target=recipient;final String hash;
  if(in.sourceAbsenceId()!=null&&(!"DOCTOR_ABSENT".equals(in.type())||in.absenceDoctorId()==null||in.absenceStartsAt()==null||in.absenceEndsAt()==null||!in.absenceEndsAt().isAfter(in.absenceStartsAt())))throw ApiProblem.invalid("Source absence requires a verified doctor and interval");
  try{var payload=in.sourceAbsenceId()==null?List.of(appointment,in.actorUserId(),in.type(),in.reason()):List.of(appointment,in.actorUserId(),in.type(),in.reason(),in.sourceAbsenceId(),in.absenceDoctorId(),in.absenceStartsAt(),in.absenceEndsAt());hash=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(json.writeValueAsBytes(payload)));}catch(Exception ex){throw new IllegalStateException(ex);}
  return tx.execute(s->{
   db.tenant(clinic);db.lockKey(in.actorUserId(),"reception-exception",key);
   if(in.sourceAbsenceId()!=null){db.lockKey(in.sourceAbsenceId(),"source-absence",appointment.toString());var applied=jdbc.queryForList("select * from appointment_v2.reception_exceptions where appointment_id=? and source_absence_id=?",appointment,in.sourceAbsenceId());if(!applied.isEmpty()){var row=applied.getFirst();return new View((UUID)row.get("id"),appointment,(String)row.get("exception_type"),(String)row.get("state"),(String)row.get("notification_mode"));}}
   var old=jdbc.queryForList("select * from appointment_v2.reception_exceptions where actor_user_id=? and key=?",in.actorUserId(),key);
   if(!old.isEmpty()){var row=old.getFirst();if(!hash.equals(row.get("payload_hash")))throw ApiProblem.conflict("Exception key reused with different data");return new View((UUID)row.get("id"),(UUID)row.get("appointment_id"),(String)row.get("exception_type"),(String)row.get("state"),(String)row.get("notification_mode"));}
   jdbc.queryForList("select id from appointment_v2.appointments where id=? and branch_id=? for update",appointment,branch);var a=arrivals.read(clinic,branch,appointment);
   if(in.sourceAbsenceId()!=null){db.lockKey(in.sourceAbsenceId(),"absence-progress","source");if(jdbc.queryForObject("select count(*) from appointment_v2.absence_progress where id=? and branch_id=? and state='CANCELLED'",Integer.class,in.sourceAbsenceId(),branch)>0)throw ApiProblem.conflict("Source absence was cancelled");}
   if(!"CONFIRMED".equals(a.status())||a.version()!=in.expectedVersion())throw ApiProblem.conflict("Appointment changed or already arrived");
   if(in.sourceAbsenceId()!=null){var slot=jdbc.queryForMap("select s.doctor_id,s.starts_at,s.ends_at from appointment_v2.capacity_slots s join appointment_v2.appointments a on a.slot_id=s.id where a.id=?",appointment);if(!in.absenceDoctorId().equals(slot.get("doctor_id"))||!((java.sql.Timestamp)slot.get("starts_at")).toInstant().isBefore(in.absenceEndsAt())||!((java.sql.Timestamp)slot.get("ends_at")).toInstant().isAfter(in.absenceStartsAt()))throw ApiProblem.conflict("Appointment no longer overlaps this absence");}
   if(!Set.of("LATE","NO_SHOW","DOCTOR_ABSENT").contains(in.type())||in.reason()==null||in.reason().isBlank()||in.reason().length()>500)throw ApiProblem.invalid("A valid exception and reason are required");
   if(!"DOCTOR_ABSENT".equals(in.type())&&a.startsAt().isAfter(Instant.now()))throw ApiProblem.conflict("Late/no-show requires the scheduled start to have passed");
   UUID id=UUID.randomUUID();String mode=target==null?"MANUAL_CONTACT_REQUIRED":"IN_APP",status="NO_SHOW".equals(in.type())?"NO_SHOW":"CONFIRMED";
   jdbc.update("insert into appointment_v2.reception_exceptions(id,appointment_id,clinic_id,branch_id,actor_user_id,key,payload_hash,exception_type,reason,notification_mode,source_absence_id,absence_doctor_id,absence_starts_at,absence_ends_at) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",id,appointment,clinic,branch,in.actorUserId(),key,hash,in.type(),in.reason().trim(),mode,in.sourceAbsenceId(),in.absenceDoctorId(),in.absenceStartsAt()==null?null:java.sql.Timestamp.from(in.absenceStartsAt()),in.absenceEndsAt()==null?null:java.sql.Timestamp.from(in.absenceEndsAt()));
   jdbc.update("update appointment_v2.appointments set status=?,row_version=row_version+1,updated_at=now() where id=?",status,appointment);
   jdbc.update("insert into appointment_v2.appointment_history(id,appointment_id,from_status,to_status,actor_user_id,reason,correlation_id) values(?,?,'CONFIRMED',?,?,?,?)",UUID.randomUUID(),appointment,status,in.actorUserId(),in.reason().trim(),id.toString());
   UUID event=UUID.randomUUID();Map<String,Object> data=new LinkedHashMap<>();data.put("appointmentId",appointment.toString());data.put("patientRef",a.patientId().toString());data.put("actorUserId",in.actorUserId().toString());data.put("startsAt",a.startsAt().toString());data.put("status",status);data.put("exceptionType",in.type());data.put("manualContactRequired",target==null);if(target!=null)data.put("recipientUserId",target.toString());
   Map<String,Object> e=new LinkedHashMap<>();e.put("specversion","1.0");e.put("id",event.toString());e.put("source","/services/appointment");e.put("type","clinic.appointment.exception_recorded.v1");e.put("subject","appointment/"+appointment);e.put("time",Instant.now().toString());e.put("datacontenttype","application/json");e.put("clinicid",clinic.toString());e.put("branchid",branch.toString());e.put("correlationid",id.toString());e.put("aggregateversion",a.version()+2);e.put("data",data);
   try{jdbc.update("insert into appointment_v2.outbox_events(id,event_id,event_type,aggregate_id,correlation_id,payload_json) values(?,?,'clinic.appointment.exception_recorded.v1',?,?,?)",UUID.randomUUID(),event,appointment,id.toString(),json.writeValueAsString(e));}catch(com.fasterxml.jackson.core.JsonProcessingException ex){throw new IllegalStateException(ex);}
   return new View(id,appointment,in.type(),"OPEN",mode);
  });
 }
 public View resolve(UUID clinic,UUID branch,UUID appointment,UUID exception,String key,ResolveInput in){
  if(key==null||key.isBlank()||key.length()>120||in.actorUserId()==null||in.reason()==null||in.reason().isBlank()||in.reason().length()>500||in.expectedVersion()<0)throw ApiProblem.invalid("Version, actor, reason and key are required");
  var source=arrivals.read(clinic,branch,appointment);UUID recipient=null;try{recipient=patients.booking(source.patientId()).platformUserId();}catch(ApiProblem ignored){}final UUID target=recipient;final String hash;
  try{hash=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(json.writeValueAsBytes(List.of(appointment,exception,in.actorUserId(),in.expectedVersion(),in.reason()))));}catch(Exception e){throw new IllegalStateException(e);}
  return tx.execute(s->{db.tenant(clinic);db.lockKey(in.actorUserId(),"exception-resolution",key);
   var receipts=jdbc.queryForList("select * from appointment_v2.exception_resolution_commands where branch_id=? and actor_user_id=? and key=?",branch,in.actorUserId(),key);
   if(!receipts.isEmpty()){if(!hash.equals(receipts.getFirst().get("payload_hash")))throw ApiProblem.conflict("Resolution key reused with different data");return exception(branch,appointment,exception);}
   jdbc.queryForList("select id from appointment_v2.appointments where id=? and branch_id=? for update",appointment,branch);var a=arrivals.read(clinic,branch,appointment);
   var rows=jdbc.queryForList("select * from appointment_v2.reception_exceptions where id=? and appointment_id=? and branch_id=? for update",exception,appointment,branch);if(rows.isEmpty())throw ApiProblem.missing();var row=rows.getFirst();String type=(String)row.get("exception_type");
   if(!"OPEN".equals(row.get("state"))||a.version()!=in.expectedVersion())throw ApiProblem.conflict("Exception or appointment changed; reload");
   boolean safe="CANCELLED".equals(a.status())||("NO_SHOW".equals(type)&&"NO_SHOW".equals(a.status()))||("LATE".equals(type)&&"CONFIRMED".equals(a.status()));
   UUID absence=(UUID)row.get("source_absence_id");
   if(absence!=null){db.lockKey(absence,"absence-progress","source");safe|=jdbc.queryForObject("select count(*) from appointment_v2.absence_progress where id=? and branch_id=? and state='CANCELLED'",Integer.class,absence,branch)>0;
    if("CONFIRMED".equals(a.status())&&row.get("absence_doctor_id")!=null){var slot=jdbc.queryForMap("select s.doctor_id,s.starts_at,s.ends_at from appointment_v2.capacity_slots s join appointment_v2.appointments a on a.slot_id=s.id where a.id=?",appointment);safe|=!row.get("absence_doctor_id").equals(slot.get("doctor_id"))||!((java.sql.Timestamp)slot.get("starts_at")).toInstant().isBefore(((java.sql.Timestamp)row.get("absence_ends_at")).toInstant())||!((java.sql.Timestamp)slot.get("ends_at")).toInstant().isAfter(((java.sql.Timestamp)row.get("absence_starts_at")).toInstant());}
   }
   if(!safe)throw ApiProblem.conflict("Resolve the source absence or cancel/reschedule this booking first");
   jdbc.update("update appointment_v2.reception_exceptions set state='RESOLVED',resolved_at=now(),resolved_by=? where id=?",in.actorUserId(),exception);
   jdbc.update("update appointment_v2.appointments set row_version=row_version+1,updated_at=now() where id=?",appointment);
   jdbc.update("insert into appointment_v2.exception_resolution_commands(clinic_id,branch_id,actor_user_id,key,exception_id,payload_hash,reason) values(?,?,?,?,?,?,?)",clinic,branch,in.actorUserId(),key,exception,hash,in.reason().trim());
   jdbc.update("insert into appointment_v2.appointment_history(id,appointment_id,from_status,to_status,actor_user_id,reason,correlation_id) values(?,?,?,?,?,?,?)",UUID.randomUUID(),appointment,a.status(),a.status(),in.actorUserId(),in.reason().trim(),exception.toString());
   String notificationStatus=a.status();if("CONFIRMED".equals(notificationStatus)&&jdbc.queryForObject("select count(*) from appointment_v2.reception_exceptions where appointment_id=? and state='OPEN'",Integer.class,appointment)>0)notificationStatus="ATTENTION_REQUIRED";
   UUID event=UUID.randomUUID();Map<String,Object> data=new LinkedHashMap<>();data.put("appointmentId",appointment.toString());data.put("patientRef",a.patientId().toString());data.put("actorUserId",in.actorUserId().toString());data.put("startsAt",a.startsAt().toString());data.put("status",notificationStatus);data.put("exceptionType",type);data.put("manualContactRequired",target==null);if(target!=null)data.put("recipientUserId",target.toString());
   Map<String,Object> envelope=new LinkedHashMap<>();envelope.put("specversion","1.0");envelope.put("id",event.toString());envelope.put("source","/services/appointment");envelope.put("type","clinic.appointment.exception_resolved.v1");envelope.put("subject","appointment/"+appointment);envelope.put("time",Instant.now().toString());envelope.put("datacontenttype","application/json");envelope.put("clinicid",clinic.toString());envelope.put("branchid",branch.toString());envelope.put("correlationid",exception.toString());envelope.put("aggregateversion",a.version()+2);envelope.put("data",data);
   try{jdbc.update("insert into appointment_v2.outbox_events(id,event_id,event_type,aggregate_id,correlation_id,payload_json) values(?,?,'clinic.appointment.exception_resolved.v1',?,?,?)",UUID.randomUUID(),event,appointment,exception.toString(),json.writeValueAsString(envelope));}catch(Exception e){throw new IllegalStateException(e);}
   return exception(branch,appointment,exception);
  });
 }
 private View exception(UUID branch,UUID appointment,UUID id){var rows=jdbc.query("select * from appointment_v2.reception_exceptions where id=? and branch_id=? and appointment_id=?",(rs,n)->new View(id,appointment,rs.getString("exception_type"),rs.getString("state"),rs.getString("notification_mode")),id,branch,appointment);if(rows.isEmpty())throw ApiProblem.missing();return rows.getFirst();}
}
