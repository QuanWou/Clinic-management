package com.clinic.patient.service;

import com.clinic.patient.api.ApiProblem;
import com.clinic.patient.security.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.constraints.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.*;
import java.util.*;
import java.security.MessageDigest;
import java.util.function.Supplier;

@Service
@ConditionalOnProperty(name="patient.reception.enabled",havingValue="true")
public class ClinicPatientProfileService {
 private final JdbcTemplate jdbc;private final IamAuthorizationClient iam;private final TransactionTemplate tx;private final ObjectMapper json;
 public ClinicPatientProfileService(JdbcTemplate jdbc,IamAuthorizationClient iam,PlatformTransactionManager manager,ObjectMapper json){this.jdbc=jdbc;this.iam=iam;this.tx=new TransactionTemplate(manager);this.json=json;}
 public record Input(@NotBlank @Size(max=180) String fullName,@PastOrPresent LocalDate dateOfBirth,
  @Pattern(regexp="^(MALE|FEMALE|OTHER)?$") String sex,@Pattern(regexp="^[0-9+() .-]{0,30}$") String phone,
  @Email @Size(max=180) String email,@Min(0) long expectedVersion,@NotBlank @Size(max=500) String reason){}
 public record Profile(UUID patientId,String patientCode,String fullName,LocalDate dateOfBirth,String sex,String phone,String email,
  String status,boolean hasAccount,Instant createdAt,Instant updatedAt,long version){}
 public record Change(UUID id,String action,String reason,String changedFields,UUID actorUserId,Instant createdAt){}
 public record Detail(Profile profile,List<Change> changes){}
 public record Page(List<Profile> content,long totalElements,long totalPages,int number,int size){}
 private static final String SELECT="select p.*,l.patient_code,l.status,exists(select 1 from patient_v2.platform_user_patient_links u where u.patient_id=p.id) has_account from patient_v2.patient_identities p join patient_v2.clinic_patient_links l on l.patient_id=p.id ";
 private void require(Actor actor,UUID clinic){if(actor==null||!iam.decide(actor.id(),"CLINIC_CONFIG",clinic,null).allowed())throw ApiProblem.forbidden();}
 private <T>T local(Actor actor,UUID clinic,Supplier<T> body){require(actor,clinic);return tx.execute(s->{
  jdbc.queryForObject("select set_config('app.clinic_id',?,true)",String.class,clinic.toString());
  jdbc.queryForObject("select set_config('app.user_id',?,true)",String.class,actor.id().toString());
  jdbc.execute("select set_config('app.patient_mode','clinic_admin',true)");return body.get();});}
 public Page list(Actor actor,UUID clinic,String query,String status,String account,int page,int size){
  if(page<0||page>1000000||size<1||size>100||query==null||query.length()>180)throw ApiProblem.invalid("Invalid pagination or search");
  if(!Set.of("","PROVISIONAL","VERIFIED").contains(status)||!Set.of("","LINKED","NONE").contains(account))throw ApiProblem.invalid("Invalid profile filter");
  return local(actor,clinic,()->{
   String pattern="%"+query.trim().toLowerCase(Locale.ROOT).replace("\\","\\\\").replace("%","\\%").replace("_","\\_")+"%";
   String where="where l.clinic_id=? and l.status in ('PROVISIONAL','VERIFIED') and (?='' or l.status=?) and (lower(p.full_name) like ? escape '\\' or lower(l.patient_code) like ? escape '\\' or lower(coalesce(p.phone,'')) like ? escape '\\' or lower(coalesce(p.email,'')) like ? escape '\\')";
   if(!account.isEmpty())where+=" and "+(account.equals("NONE")?"not ":"")+"exists(select 1 from patient_v2.platform_user_patient_links u where u.patient_id=p.id)";
   Object[] args={clinic,status,status,pattern,pattern,pattern,pattern};
   long count=jdbc.queryForObject("select count(*) from patient_v2.patient_identities p join patient_v2.clinic_patient_links l on l.patient_id=p.id "+where,Long.class,args);
   var paged=new ArrayList<Object>(Arrays.asList(args));paged.add(size);paged.add((long)page*size);
   var rows=jdbc.query(SELECT+where+" order by p.created_at desc,p.id desc limit ? offset ?",(rs,n)->view(rs),paged.toArray());
   return new Page(rows,count,(count+size-1)/size,page,size);
  });
 }
 public Detail detail(Actor actor,UUID clinic,UUID patient){return local(actor,clinic,()->new Detail(read(clinic,patient),jdbc.query(
  "select * from patient_v2.profile_changes where clinic_id=? and patient_id=? order by created_at desc,id desc limit 50",
  (rs,n)->new Change(rs.getObject("id",UUID.class),rs.getString("action"),rs.getString("reason"),rs.getString("changed_fields"),rs.getObject("actor_user_id",UUID.class),rs.getTimestamp("created_at").toInstant()),clinic,patient)));}
 public Profile create(Actor actor,UUID clinic,String key,Input in){
  if(key==null||key.isBlank()||key.length()>120)throw ApiProblem.invalid("Idempotency-Key is required");
  String hash;try{hash=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(json.writeValueAsBytes(in)));}catch(Exception e){throw new IllegalStateException(e);}
  return local(actor,clinic,()->{
   jdbc.queryForObject("select pg_advisory_xact_lock(hashtextextended(?,0))",Object.class,"admin-profile:"+clinic+":"+actor.id()+":"+key);
   var prior=jdbc.queryForList("select patient_id,payload_hash from patient_v2.admin_profile_receipts where clinic_id=? and actor_user_id=? and key=?",clinic,actor.id(),key);
   if(!prior.isEmpty()){if(!hash.equals(prior.getFirst().get("payload_hash")))throw ApiProblem.conflict("Key reused with different profile data");return read(clinic,(UUID)prior.getFirst().get("patient_id"));}
   UUID id=UUID.randomUUID();String code="PT-"+id.toString().replace("-","").toUpperCase(Locale.ROOT);
   jdbc.update("insert into patient_v2.patient_identities(id,full_name,date_of_birth,sex,phone,email,origin_clinic_id) values(?,?,?,?,?,?,?)",id,in.fullName().trim(),in.dateOfBirth(),trim(in.sex()),trim(in.phone()),trim(in.email()),clinic);
   jdbc.update("insert into patient_v2.clinic_patient_links(id,clinic_id,patient_id,patient_code,status) values(?,?,?,?,'PROVISIONAL')",UUID.randomUUID(),clinic,id,code);
   jdbc.update("insert into patient_v2.admin_profile_receipts(clinic_id,actor_user_id,key,payload_hash,patient_id) values(?,?,?,?,?)",clinic,actor.id(),key,hash,id);
   log(actor,clinic,id,"CREATE",in.reason(),"fullName,dateOfBirth,sex,phone,email");return read(clinic,id);
  });
 }
 public Profile update(Actor actor,UUID clinic,UUID patient,Input in){return local(actor,clinic,()->{
  // Lock the shared identity so edits from the patient portal or another clinic cannot be overwritten.
  var locked=jdbc.queryForList("select p.id from patient_v2.patient_identities p join patient_v2.clinic_patient_links l on l.patient_id=p.id where p.id=? and l.clinic_id=? and l.status in ('PROVISIONAL','VERIFIED') for update of p",patient,clinic);
  if(locked.isEmpty())throw ApiProblem.missing();Profile old=read(clinic,patient);
  if(old.version()!=in.expectedVersion())throw ApiProblem.conflict("Hồ sơ đã thay đổi. Tải lại dữ liệu trước khi lưu.");
  String name=in.fullName().trim(),sex=trim(in.sex()),phone=trim(in.phone()),email=trim(in.email());var changed=new ArrayList<String>();
  if(!Objects.equals(old.fullName(),name))changed.add("fullName");if(!Objects.equals(old.dateOfBirth(),in.dateOfBirth()))changed.add("dateOfBirth");
  if(!Objects.equals(old.sex(),sex))changed.add("sex");if(!Objects.equals(old.phone(),phone))changed.add("phone");if(!Objects.equals(old.email(),email))changed.add("email");
  if(changed.isEmpty())return old;
  jdbc.update("update patient_v2.patient_identities set full_name=?,date_of_birth=?,sex=?,phone=?,email=?,updated_at=now(),row_version=row_version+1 where id=? and row_version=?",name,in.dateOfBirth(),sex,phone,email,patient,in.expectedVersion());
  log(actor,clinic,patient,"UPDATE",in.reason(),String.join(",",changed));return read(clinic,patient);
 });}
 private void log(Actor actor,UUID clinic,UUID id,String action,String reason,String fields){jdbc.update("insert into patient_v2.profile_changes(id,clinic_id,patient_id,actor_user_id,action,reason,changed_fields) values(?,?,?,?,?,?,?)",UUID.randomUUID(),clinic,id,actor.id(),action,reason.trim(),fields);}
 private Profile read(UUID clinic,UUID id){var rows=jdbc.query(SELECT+"where l.clinic_id=? and p.id=? and l.status in ('PROVISIONAL','VERIFIED')",(rs,n)->view(rs),clinic,id);if(rows.isEmpty())throw ApiProblem.missing();return rows.getFirst();}
 private Profile view(java.sql.ResultSet rs)throws java.sql.SQLException{return new Profile(rs.getObject("id",UUID.class),rs.getString("patient_code"),rs.getString("full_name"),rs.getObject("date_of_birth",LocalDate.class),rs.getString("sex"),rs.getString("phone"),rs.getString("email"),rs.getString("status"),rs.getBoolean("has_account"),rs.getTimestamp("created_at").toInstant(),rs.getTimestamp("updated_at").toInstant(),rs.getLong("row_version"));}
 private String trim(String s){return s==null||s.isBlank()?null:s.trim();}
}
