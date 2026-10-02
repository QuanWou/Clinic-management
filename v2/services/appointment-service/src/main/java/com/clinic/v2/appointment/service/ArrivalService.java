package com.clinic.v2.appointment.service;
import com.clinic.v2.appointment.api.ApiProblem;
import com.clinic.v2.appointment.security.TenantDbContext;
import jakarta.validation.constraints.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import java.time.*;
@Service
public class ArrivalService {
 private final JdbcTemplate jdbc;private final TenantDbContext db;public ArrivalService(JdbcTemplate jdbc,TenantDbContext db){this.jdbc=jdbc;this.db=db;}
 public record Input(@NotNull UUID patientId,@NotNull UUID encounterId,@NotNull UUID actorUserId,@Min(0) long expectedVersion){}
 public record Booking(UUID id,UUID clinicId,UUID branchId,UUID patientId,UUID clinicPatientLinkId,UUID doctorId,String status,Instant startsAt,long version,UUID encounterId){}
 public record ArrivalItem(UUID id,String appointmentCode,UUID patientId,String status,Instant startsAt,long version){}
 @Transactional(readOnly=true) public List<ArrivalItem> affected(UUID clinic,UUID branch,UUID doctor,UUID absence,Instant start,Instant end){
  db.tenant(clinic);if(start==null||end==null||!end.isAfter(start)||Duration.between(start,end).compareTo(Duration.ofDays(31))>0)throw ApiProblem.invalid("Invalid absence interval");
  return jdbc.query("select a.id,a.appointment_code,a.patient_id,a.status,s.starts_at,a.row_version from appointment_v2.appointments a join appointment_v2.capacity_slots s on s.id=a.slot_id where a.branch_id=? and s.doctor_id=? and s.starts_at<? and s.ends_at>? and a.status='CONFIRMED' and not exists(select 1 from appointment_v2.reception_exceptions e where e.appointment_id=a.id and e.source_absence_id=?) order by s.starts_at,a.id limit 11",(rs,n)->new ArrivalItem(rs.getObject("id",UUID.class),rs.getString("appointment_code"),rs.getObject("patient_id",UUID.class),rs.getString("status"),rs.getTimestamp("starts_at").toInstant(),rs.getLong("row_version")),branch,doctor,java.sql.Timestamp.from(end),java.sql.Timestamp.from(start),absence);
 }
 @Transactional(readOnly=true) public List<ArrivalItem> list(UUID clinic,UUID branch,LocalDate date){db.tenant(clinic);var start=date.atStartOfDay(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant();var end=date.plusDays(1).atStartOfDay(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant();return jdbc.query("select a.id,a.appointment_code,a.patient_id,a.status,s.starts_at,a.row_version from appointment_v2.appointments a join appointment_v2.capacity_slots s on s.id=a.slot_id where a.branch_id=? and s.starts_at>=? and s.starts_at<? order by s.starts_at limit 200",(rs,n)->new ArrivalItem(rs.getObject("id",UUID.class),rs.getString("appointment_code"),rs.getObject("patient_id",UUID.class),rs.getString("status"),rs.getTimestamp("starts_at").toInstant(),rs.getLong("row_version")),branch,java.sql.Timestamp.from(start),java.sql.Timestamp.from(end));}
 @Transactional(readOnly=true) public Booking read(UUID clinic,UUID branch,UUID id){db.tenant(clinic);return booking(branch,id);}
 @Transactional public Booking claim(UUID clinic,UUID branch,UUID id,Input in){
  db.tenant(clinic);
  var matches=jdbc.queryForList("select id from appointment_v2.appointments where id=? and branch_id=? for update",UUID.class,id,branch);if(matches.isEmpty())throw ApiProblem.missing();
  var a=booking(branch,id);if(!a.patientId().equals(in.patientId()))throw ApiProblem.forbidden();
  if("CHECKED_IN".equals(a.status())){if(!in.encounterId().equals(a.encounterId()))throw ApiProblem.conflict("Appointment already belongs to another encounter");return a;}
  if(!"CONFIRMED".equals(a.status())||a.version()!=in.expectedVersion())throw ApiProblem.conflict("Appointment changed before arrival");
  if(jdbc.queryForObject("select count(*) from appointment_v2.reception_exceptions where appointment_id=? and exception_type='DOCTOR_ABSENT' and state='OPEN'",Integer.class,id)>0)throw ApiProblem.conflict("Doctor absence needs staff resolution before arrival");
  if(!LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).equals(a.startsAt().atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toLocalDate()))throw ApiProblem.conflict("Arrival requires scheduled local date");
  jdbc.update("update appointment_v2.appointments set status='CHECKED_IN',encounter_id=?,row_version=row_version+1,updated_at=now() where id=?",in.encounterId(),id);
  jdbc.update("insert into appointment_v2.appointment_history(id,appointment_id,from_status,to_status,actor_user_id,reason,correlation_id) values(?,?,'CONFIRMED','CHECKED_IN',?,'Encounter arrival acknowledged',?)",UUID.randomUUID(),id,in.actorUserId(),in.encounterId().toString());
  return booking(branch,id);
 }
 private Booking booking(UUID branch,UUID id){var list=jdbc.query("select a.*,s.starts_at from appointment_v2.appointments a join appointment_v2.capacity_slots s on s.id=a.slot_id where a.id=? and a.branch_id=?",(rs,n)->new Booking(rs.getObject("id",UUID.class),rs.getObject("clinic_id",UUID.class),rs.getObject("branch_id",UUID.class),rs.getObject("patient_id",UUID.class),rs.getObject("clinic_patient_link_id",UUID.class),rs.getObject("doctor_id",UUID.class),rs.getString("status"),rs.getTimestamp("starts_at").toInstant(),rs.getLong("row_version"),rs.getObject("encounter_id",UUID.class)),id,branch);if(list.isEmpty())throw ApiProblem.missing();return list.getFirst();}
}

