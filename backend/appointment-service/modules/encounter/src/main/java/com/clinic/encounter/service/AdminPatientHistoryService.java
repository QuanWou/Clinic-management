package com.clinic.encounter.service;
import com.clinic.encounter.api.ApiProblem;
import com.clinic.encounter.security.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.Instant;
import java.util.*;

@Service
public class AdminPatientHistoryService {
 private final JdbcTemplate jdbc;private final EncounterDb db;private final IamAuthorizationClient iam;private final TransactionTemplate tx;
 public AdminPatientHistoryService(JdbcTemplate jdbc,EncounterDb db,IamAuthorizationClient iam,PlatformTransactionManager manager){this.jdbc=jdbc;this.db=db;this.iam=iam;tx=new TransactionTemplate(manager);tx.setReadOnly(true);}
 public record Visit(UUID encounterId,String visitCode,UUID doctorId,String status,Instant createdAt,Instant checkedInAt,Instant completedAt,String serviceName,boolean walkIn){}
 public record Page(List<Visit> content,long totalElements,long totalPages,int number,int size){}
 public Page list(Actor actor,UUID clinic,UUID branch,UUID patient,int page,int size){
  if(actor==null)throw ApiProblem.forbidden();var grant=iam.decide(actor.id(),"CLINIC_CONFIG",clinic,null);
  if(!grant.allowed()||!"ADMIN".equals(grant.role()))throw ApiProblem.forbidden();
  if(page<0||page>1000000||size<1||size>100)throw ApiProblem.invalid("Invalid pagination");
  return tx.execute(t->{db.scope(clinic,branch);
   long count=jdbc.queryForObject("select count(*) from encounter_v2.visits where clinic_id=? and branch_id=? and patient_id=?",Long.class,clinic,branch,patient);
   var rows=jdbc.query("select v.*,(select q.code from encounter_v2.queue_tickets q where q.visit_id=v.id order by q.created_at desc,q.id desc limit 1) visit_code,v.consultation_json->>'name' service_name from encounter_v2.visits v where v.clinic_id=? and v.branch_id=? and v.patient_id=? order by v.created_at desc,v.id desc limit ? offset ?",
    (rs,n)->new Visit(rs.getObject("id",UUID.class),rs.getString("visit_code"),rs.getObject("doctor_id",UUID.class),rs.getString("status"),rs.getTimestamp("created_at").toInstant(),instant(rs,"checked_in_at"),instant(rs,"clinically_completed_at"),rs.getString("service_name"),rs.getObject("appointment_id")==null),clinic,branch,patient,size,(long)page*size);
   return new Page(rows,count,(count+size-1)/size,page,size);
  });
 }
 private Instant instant(java.sql.ResultSet rs,String column)throws java.sql.SQLException{var value=rs.getTimestamp(column);return value==null?null:value.toInstant();}
}
