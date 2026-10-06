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
import java.util.*;
import java.time.LocalDate;
import java.security.MessageDigest;
import java.util.function.Supplier;
@Service
@ConditionalOnProperty(name="patient.reception.enabled",havingValue="true")
public class ReceptionPatientService {
 private final JdbcTemplate jdbc;private final IamAuthorizationClient iam;private final ClinicDirectoryClient clinics;private final TransactionTemplate tx;private final ObjectMapper json;
 public ReceptionPatientService(JdbcTemplate jdbc,IamAuthorizationClient iam,ClinicDirectoryClient clinics,PlatformTransactionManager manager,ObjectMapper json){this.jdbc=jdbc;this.iam=iam;this.clinics=clinics;this.tx=new TransactionTemplate(manager);this.json=json;}
 public record ProvisionalInput(@NotBlank @Size(max=180) String fullName,@PastOrPresent LocalDate dateOfBirth,@Size(max=30) String phone,@NotBlank @Size(max=500) String reason){}
 public record PatientView(UUID patientId,UUID clinicPatientLinkId,String patientCode,String fullName,LocalDate dateOfBirth,String phoneLast4,String status,long version){}
 public record ReviewInput(@Min(0) long expectedVersion,@NotBlank @Size(max=180) String identityEvidenceRef,@NotBlank @Size(max=500) String reason){}
 private void require(Actor actor,UUID clinic,UUID branch){if(actor==null||!iam.decide(actor.id(),"RECEPTION",clinic,branch).allowed())throw ApiProblem.forbidden();}
 private <T>T local(UUID clinic,UUID branch,Supplier<T> body){return tx.execute(s->{jdbc.queryForObject("select set_config('app.clinic_id',?,true)",String.class,clinic.toString());jdbc.queryForObject("select set_config('app.branch_id',?,true)",String.class,branch.toString());jdbc.queryForObject("select set_config('app.patient_mode','reception',true)",String.class);return body.get();});}
 public PatientView provisional(Actor actor,UUID clinic,UUID branch,String key,ProvisionalInput in){
  require(actor,clinic,branch);clinics.requireBranch(clinic,branch);if(key==null||key.isBlank()||key.length()>120)throw new ApiProblem(org.springframework.http.HttpStatus.BAD_REQUEST,"KEY_REQUIRED","Idempotency-Key is required");
  String hash;try{hash=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(json.writeValueAsBytes(in)));}catch(Exception ex){throw new IllegalStateException(ex);}
  return local(clinic,branch,()->{
   jdbc.queryForObject("select pg_advisory_xact_lock(hashtextextended(?,0))",Object.class,"provisional:"+clinic+":"+branch+":"+actor.id()+":"+key);
   var existing=jdbc.queryForList("select patient_id,payload_hash from patient_v2.reception_receipts where actor_user_id=? and key=?",actor.id(),key);
   if(!existing.isEmpty()){if(!hash.equals(existing.getFirst().get("payload_hash")))throw new ApiProblem(org.springframework.http.HttpStatus.CONFLICT,"IDEMPOTENCY_CONFLICT","Key reused with different patient data");return read((UUID)existing.getFirst().get("patient_id"));}
   UUID patient=UUID.randomUUID(),link=UUID.randomUUID();String code="PT-"+patient.toString().replace("-","").toUpperCase(Locale.ROOT);
   jdbc.update("insert into patient_v2.patient_identities(id,full_name,date_of_birth,phone,origin_clinic_id) values(?,?,?,?,?)",patient,in.fullName().trim(),in.dateOfBirth(),in.phone()==null?null:in.phone().trim(),clinic);
   jdbc.update("insert into patient_v2.clinic_patient_links(id,clinic_id,patient_id,patient_code,status) values(?,?,?,?,'PROVISIONAL')",link,clinic,patient,code);
   jdbc.update("insert into patient_v2.reception_receipts(clinic_id,branch_id,actor_user_id,key,payload_hash,patient_id) values(?,?,?,?,?,?)",clinic,branch,actor.id(),key,hash,patient);
   jdbc.update("insert into patient_v2.patient_reviews(id,clinic_id,patient_id,actor_user_id,identity_evidence_ref,reason) values(?,?,?,?,'PROVISIONAL_AT_RECEPTION',?)",UUID.randomUUID(),clinic,patient,actor.id(),in.reason().trim());return read(patient);
  });
 }
 public List<PatientView> suggestions(Actor actor,UUID clinic,UUID branch,String name,LocalDate dob,String phone){require(actor,clinic,branch);
  if((phone==null||phone.isBlank())&&(name==null||name.isBlank()||dob==null))throw new ApiProblem(org.springframework.http.HttpStatus.BAD_REQUEST,"MATCH_INPUT_REQUIRED","Supply exact contact or name with date of birth");
  if((name!=null&&name.length()>180)||(phone!=null&&phone.length()>30))throw new ApiProblem(org.springframework.http.HttpStatus.BAD_REQUEST,"MATCH_INPUT_INVALID","Matching fields exceed limits");
  return local(clinic,branch,()->jdbc.query("select p.id,p.full_name,p.date_of_birth,p.phone,l.id link_id,l.patient_code,l.status,l.row_version from patient_v2.patient_identities p join patient_v2.clinic_patient_links l on l.patient_id=p.id where l.clinic_id=? and l.status<>'REVOKED' and ((lower(p.full_name)=lower(?) and p.date_of_birth=cast(? as date)) or (?<>'' and p.phone=?)) order by p.created_at desc limit 20",(rs,n)->view(rs),clinic,name==null?"":name.trim(),dob,phone==null?"":phone.trim(),phone==null?"":phone.trim()));
 }
 public List<PatientView> recent(Actor actor,UUID clinic,UUID branch){require(actor,clinic,branch);
  return local(clinic,branch,()->jdbc.query("select p.id,p.full_name,p.date_of_birth,p.phone,l.id link_id,l.patient_code,l.status,l.row_version from patient_v2.patient_identities p join patient_v2.clinic_patient_links l on l.patient_id=p.id where l.clinic_id=? and l.status<>'REVOKED' order by p.created_at desc limit 20",(rs,n)->view(rs),clinic));
 }
 public PatientView review(Actor actor,UUID clinic,UUID branch,UUID patient,ReviewInput in){require(actor,clinic,branch);return local(clinic,branch,()->{
  var links=jdbc.queryForList("select id from patient_v2.clinic_patient_links where patient_id=? for update",patient);if(links.isEmpty())throw ApiProblem.missing();var before=read(patient);
  if(before.version()!=in.expectedVersion()||!"PROVISIONAL".equals(before.status()))throw ApiProblem.conflict("Patient link changed or is no longer provisional");
  jdbc.update("update patient_v2.clinic_patient_links set status='VERIFIED',verified_at=now(),row_version=row_version+1 where patient_id=?",patient);
  jdbc.update("insert into patient_v2.patient_reviews(id,clinic_id,patient_id,actor_user_id,identity_evidence_ref,reason) values(?,?,?,?,?,?)",UUID.randomUUID(),clinic,patient,actor.id(),in.identityEvidenceRef().trim(),in.reason().trim());return read(patient);
 });}
 private PatientView read(UUID id){var matches=jdbc.query("select p.id,p.full_name,p.date_of_birth,p.phone,l.id link_id,l.patient_code,l.status,l.row_version from patient_v2.patient_identities p join patient_v2.clinic_patient_links l on l.patient_id=p.id where p.id=?",(rs,n)->view(rs),id);if(matches.isEmpty())throw ApiProblem.missing();return matches.getFirst();}
 private PatientView view(java.sql.ResultSet rs)throws java.sql.SQLException{String phone=rs.getString("phone");return new PatientView(rs.getObject("id",UUID.class),rs.getObject("link_id",UUID.class),rs.getString("patient_code"),rs.getString("full_name"),rs.getObject("date_of_birth",LocalDate.class),phone==null?null:phone.substring(Math.max(0,phone.length()-4)),rs.getString("status"),rs.getLong("row_version"));}
}
