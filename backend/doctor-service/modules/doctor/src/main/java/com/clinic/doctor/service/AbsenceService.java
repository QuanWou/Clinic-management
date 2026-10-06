package com.clinic.doctor.service;
import com.clinic.doctor.api.ApiProblem;
import com.clinic.doctor.security.*;
import jakarta.validation.constraints.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.util.*;
import java.time.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
@Service
public class AbsenceService {
 private final JdbcTemplate jdbc;private final TenantDbContext db;private final IamAuthorizationClient iam;private final ClinicDirectoryClient clinics;private final TransactionTemplate tx;
 public AbsenceService(JdbcTemplate jdbc,TenantDbContext db,IamAuthorizationClient iam,ClinicDirectoryClient clinics,PlatformTransactionManager manager){this.jdbc=jdbc;this.db=db;this.iam=iam;this.clinics=clinics;tx=new TransactionTemplate(manager);}
 public record Input(@NotNull Instant startsAt,@NotNull Instant endsAt,@NotBlank @Size(max=500) String reason){}
 public record View(UUID id,UUID clinicId,UUID branchId,UUID doctorId,Instant startsAt,Instant endsAt,String state,long version){}
 public record CancelInput(@Min(1) long expectedVersion,@NotBlank @Size(max=500) String reason){}
 public record AmendInput(@Min(1) long expectedVersion,@NotNull Instant startsAt,@NotNull Instant endsAt,@NotBlank @Size(max=500) String reason){}
 public record Change(View previous,View replacement){}
 public record Window(Instant startsAt,Instant endsAt){}
 private void require(Actor actor,String capability,UUID clinic,UUID branch){if(actor==null||!iam.decide(actor.id(),capability,clinic,branch).allowed())throw ApiProblem.missing();}
 private <T>T scoped(UUID clinic,java.util.function.Supplier<T> action){return tx.execute(s->{db.tenant(clinic);return action.get();});}
 public View report(Actor actor,UUID clinic,UUID branch,UUID doctor,String key,Input input){
  require(actor,"CLINIC_CONFIG",clinic,branch);clinics.requireBranch(clinic,branch);
  if(key==null||key.isBlank()||key.length()>120||input.startsAt()==null||input.endsAt()==null||!input.endsAt().isAfter(input.startsAt())||Duration.between(input.startsAt(),input.endsAt()).compareTo(Duration.ofDays(31))>0||input.reason()==null||input.reason().isBlank()||input.reason().length()>500)throw ApiProblem.invalid("A bounded absence interval, reason and key are required");
  final String hash;try{hash=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest((doctor+"|"+input.startsAt()+"|"+input.endsAt()+"|"+input.reason()).getBytes(StandardCharsets.UTF_8)));}catch(Exception ex){throw new IllegalStateException(ex);}
  return scoped(clinic,()->{
   jdbc.queryForObject("select pg_advisory_xact_lock(hashtextextended(?,0))",Object.class,"doctor-absence:"+clinic+":"+branch+":"+actor.id()+":"+key);
   var old=jdbc.queryForList("select * from doctor.absences where branch_id=? and actor_user_id=? and key=?",branch,actor.id(),key);if(!old.isEmpty()){if(!hash.equals(old.getFirst().get("payload_hash")))throw ApiProblem.conflict("Absence key reused with different interval");return view(old.getFirst());}
   if(jdbc.queryForObject("select count(*) from doctor.doctor_affiliations where branch_id=? and practitioner_id=? and active",Integer.class,branch,doctor)==0)throw ApiProblem.missing();
   UUID id=UUID.randomUUID();jdbc.update("insert into doctor.absences(id,clinic_id,branch_id,practitioner_id,starts_at,ends_at,reason,actor_user_id,key,payload_hash) values(?,?,?,?,?,?,?,?,?,?)",id,clinic,branch,doctor,java.sql.Timestamp.from(input.startsAt()),java.sql.Timestamp.from(input.endsAt()),input.reason().trim(),actor.id(),key,hash);return source(clinic,branch,id);
  });
 }
 public List<View> list(Actor actor,UUID clinic,UUID branch,UUID doctor){require(actor,"SCHEDULE_READ",clinic,branch);return scoped(clinic,()->jdbc.queryForList("select * from doctor.absences where branch_id=? and practitioner_id=? order by starts_at desc limit 100",branch,doctor).stream().map(this::view).toList());}
 public View source(UUID clinic,UUID branch,UUID id){return scoped(clinic,()->{var rows=jdbc.queryForList("select * from doctor.absences where id=? and branch_id=?",id,branch);if(rows.isEmpty())throw ApiProblem.missing();return view(rows.getFirst());});}
 public List<Window> windows(UUID clinic,UUID branch,UUID doctor){return scoped(clinic,()->jdbc.query("select starts_at,ends_at from doctor.absences where branch_id=? and practitioner_id=? and state='ACTIVE' and ends_at>now() order by starts_at",(rs,n)->new Window(rs.getTimestamp(1).toInstant(),rs.getTimestamp(2).toInstant()),branch,doctor));}
 public void requirePresent(UUID clinic,UUID branch,UUID doctor,Instant at){boolean absent=scoped(clinic,()->jdbc.queryForObject("select count(*) from doctor.absences where branch_id=? and practitioner_id=? and state='ACTIVE' and starts_at<=? and ends_at>?",Integer.class,branch,doctor,java.sql.Timestamp.from(at),java.sql.Timestamp.from(at))>0);if(absent)throw ApiProblem.conflict("Doctor is absent at this time");}
 public Change cancel(Actor actor,UUID clinic,UUID branch,UUID doctor,UUID id,String key,CancelInput in){return change(actor,clinic,branch,doctor,id,key,in.expectedVersion(),in.reason(),null,null);}
 public Change amend(Actor actor,UUID clinic,UUID branch,UUID doctor,UUID id,String key,AmendInput in){if(in.startsAt()==null||in.endsAt()==null)throw ApiProblem.invalid("An amended interval is required");return change(actor,clinic,branch,doctor,id,key,in.expectedVersion(),in.reason(),in.startsAt(),in.endsAt());}
 private Change change(Actor actor,UUID clinic,UUID branch,UUID doctor,UUID id,String key,long version,String reason,Instant start,Instant end){
  require(actor,"CLINIC_CONFIG",clinic,branch);clinics.requireBranch(clinic,branch);
  if(key==null||key.isBlank()||key.length()>120||version<1||reason==null||reason.isBlank()||reason.length()>500)throw ApiProblem.invalid("Version, reason and Idempotency-Key are required");
  if(start!=null&&(end==null||!end.isAfter(start)||Duration.between(start,end).compareTo(Duration.ofDays(31))>0))throw ApiProblem.invalid("Invalid amended absence interval");
  String operation=start==null?"CANCEL":"AMEND";final String hash;
  try{hash=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest((id+"|"+doctor+"|"+operation+"|"+version+"|"+reason+"|"+start+"|"+end).getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);}
  return scoped(clinic,()->{
   jdbc.queryForObject("select pg_advisory_xact_lock(hashtextextended(?,0))",Object.class,"doctor-absence-change:"+clinic+":"+branch+":"+actor.id()+":"+key);
   var receipts=jdbc.queryForList("select * from doctor.absence_commands where branch_id=? and actor_user_id=? and key=?",branch,actor.id(),key);
   if(!receipts.isEmpty()){var receipt=receipts.getFirst();if(!hash.equals(receipt.get("payload_hash")))throw ApiProblem.conflict("Absence command key reused with different data");return new Change(source(clinic,branch,id),receipt.get("replacement_id")==null?null:source(clinic,branch,(UUID)receipt.get("replacement_id")));}
   var rows=jdbc.queryForList("select * from doctor.absences where id=? and branch_id=? and practitioner_id=? for update",id,branch,doctor);if(rows.isEmpty())throw ApiProblem.missing();var old=view(rows.getFirst());
   if(!"ACTIVE".equals(old.state())||old.version()!=version)throw ApiProblem.conflict("Absence changed; reload its source version");
   jdbc.update("update doctor.absences set state='CANCELLED',row_version=row_version+1,cancelled_at=now(),cancelled_by=? where id=?",actor.id(),id);
   UUID replacement=null;
   if(start!=null){replacement=UUID.randomUUID();jdbc.update("insert into doctor.absences(id,clinic_id,branch_id,practitioner_id,starts_at,ends_at,reason,actor_user_id,key,payload_hash) values(?,?,?,?,?,?,?,?,?,?)",replacement,clinic,branch,doctor,java.sql.Timestamp.from(start),java.sql.Timestamp.from(end),reason.trim(),actor.id(),"amend:"+replacement,hash);}
   jdbc.update("insert into doctor.absence_commands(clinic_id,branch_id,actor_user_id,key,absence_id,replacement_id,operation,payload_hash,reason) values(?,?,?,?,?,?,?,?,?)",clinic,branch,actor.id(),key,id,replacement,operation,hash,reason.trim());
   return new Change(source(clinic,branch,id),replacement==null?null:source(clinic,branch,replacement));
  });
 }
 private View view(Map<String,Object> row){return new View((UUID)row.get("id"),(UUID)row.get("clinic_id"),(UUID)row.get("branch_id"),(UUID)row.get("practitioner_id"),((java.sql.Timestamp)row.get("starts_at")).toInstant(),((java.sql.Timestamp)row.get("ends_at")).toInstant(),(String)row.get("state"),((Number)row.get("row_version")).longValue());}
}
