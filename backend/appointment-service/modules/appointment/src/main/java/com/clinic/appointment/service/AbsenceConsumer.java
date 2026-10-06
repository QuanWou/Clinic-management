package com.clinic.appointment.service;
import com.clinic.appointment.api.ApiProblem;
import com.clinic.appointment.security.TenantDbContext;
import jakarta.validation.constraints.*;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.util.*;
import java.time.*;
@Service
public class AbsenceConsumer {
 private final JdbcTemplate jdbc;private final TenantDbContext db;private final TransactionTemplate tx;private final ArrivalService arrivals;private final ReceptionExceptionService exceptions;
 public AbsenceConsumer(JdbcTemplate jdbc,TenantDbContext db,PlatformTransactionManager manager,ArrivalService arrivals,ReceptionExceptionService exceptions){this.jdbc=jdbc;this.db=db;tx=new TransactionTemplate(manager);this.arrivals=arrivals;this.exceptions=exceptions;}
 public record Input(@NotNull UUID eventId,@NotNull UUID id,@NotNull UUID clinicId,@NotNull UUID branchId,@NotNull UUID doctorId,@NotNull Instant startsAt,@NotNull Instant endsAt,@Min(1) long version,@Pattern(regexp="ACTIVE|CANCELLED") @NotNull String state,@NotNull UUID actorUserId){}
 public record Reply(boolean complete){}
 public Reply accept(Input in){
  if(!in.endsAt().isAfter(in.startsAt())||Duration.between(in.startsAt(),in.endsAt()).compareTo(Duration.ofDays(31))>0||("ACTIVE".equals(in.state())?in.version()!=1:in.version()!=2))throw ApiProblem.invalid("Invalid immutable absence lifecycle");
  boolean current=tx.execute(s->{db.tenant(in.clinicId());db.lockKey(in.id(),"absence-progress","source");var rows=jdbc.queryForList("select * from appointment_v2.absence_progress where id=?",in.id());
   if(!rows.isEmpty()){var old=rows.getFirst();if(!in.branchId().equals(old.get("branch_id"))||!in.doctorId().equals(old.get("doctor_id"))||!in.startsAt().equals(((java.sql.Timestamp)old.get("starts_at")).toInstant())||!in.endsAt().equals(((java.sql.Timestamp)old.get("ends_at")).toInstant()))throw ApiProblem.conflict("Absence source metadata changed");long version=((Number)old.get("source_version")).longValue();if(version>in.version())return false;if(version==in.version()&&!in.state().equals(old.get("state")))throw ApiProblem.conflict("Absence version reused");}
   jdbc.update("insert into appointment_v2.absence_progress(id,clinic_id,branch_id,doctor_id,starts_at,ends_at,source_version,state) values(?,?,?,?,?,?,?,?) on conflict(id) do update set source_version=excluded.source_version,state=excluded.state",in.id(),in.clinicId(),in.branchId(),in.doctorId(),java.sql.Timestamp.from(in.startsAt()),java.sql.Timestamp.from(in.endsAt()),in.version(),in.state());return true;
  });
  if(!current)return new Reply(true);
  if("ACTIVE".equals(in.state())){
   for(var item:arrivals.affected(in.clinicId(),in.branchId(),in.doctorId(),in.id(),in.startsAt(),in.endsAt()).stream().limit(10).toList()){
    try{var booking=arrivals.read(in.clinicId(),in.branchId(),item.id());exceptions.record(in.clinicId(),in.branchId(),item.id(),"absence:"+in.id()+":"+item.id(),new ReceptionExceptionService.Input(in.actorUserId(),booking.version(),"DOCTOR_ABSENT","Doctor absence source "+in.id(),in.id(),in.doctorId(),in.startsAt(),in.endsAt()));}catch(ApiProblem ignored){/* Re-read remaining candidates; a concurrently moved booking is not lost. */}
   }
   return new Reply(arrivals.affected(in.clinicId(),in.branchId(),in.doctorId(),in.id(),in.startsAt(),in.endsAt()).isEmpty()||cancelled(in));
  }
  var open=tx.execute(s->{db.tenant(in.clinicId());return jdbc.queryForList("select id,appointment_id from appointment_v2.reception_exceptions where branch_id=? and source_absence_id=? and state='OPEN' order by created_at,id limit 10",in.branchId(),in.id());});
  for(var row:open){UUID appointment=(UUID)row.get("appointment_id"),exception=(UUID)row.get("id");try{var booking=arrivals.read(in.clinicId(),in.branchId(),appointment);exceptions.resolve(in.clinicId(),in.branchId(),appointment,exception,"absence-cancel:"+exception,new ReceptionExceptionService.ResolveInput(in.actorUserId(),booking.version(),"Source absence cancelled "+in.id()));}catch(ApiProblem ignored){}}
  return new Reply(tx.execute(s->{db.tenant(in.clinicId());return jdbc.queryForObject("select count(*) from appointment_v2.reception_exceptions where branch_id=? and source_absence_id=? and state='OPEN'",Integer.class,in.branchId(),in.id())==0;}));
 }
 private boolean cancelled(Input in){return tx.execute(s->{db.tenant(in.clinicId());return jdbc.queryForObject("select count(*) from appointment_v2.absence_progress where id=? and state='CANCELLED'",Integer.class,in.id())>0;});}
}
