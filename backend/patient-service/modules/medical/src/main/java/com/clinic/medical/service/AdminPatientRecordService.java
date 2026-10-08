package com.clinic.medical.service;
import com.clinic.medical.api.ApiProblem;
import com.clinic.medical.api.MedicalDto.Note;
import com.clinic.medical.security.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.Instant;
import java.util.*;

@Service
public class AdminPatientRecordService {
 private final JdbcTemplate jdbc;private final MedicalDb db;private final IamAuthorizationClient iam;private final ObjectMapper json;private final TransactionTemplate tx;
 public AdminPatientRecordService(JdbcTemplate jdbc,MedicalDb db,IamAuthorizationClient iam,ObjectMapper json,PlatformTransactionManager manager){this.jdbc=jdbc;this.db=db;this.iam=iam;this.json=json;tx=new TransactionTemplate(manager);tx.setReadOnly(true);}
 public record Order(UUID id,String name,String state,Instant orderedAt,String result,Instant resultAt,Instant reviewedAt){}
 public record Record(UUID encounterId,String status,long documentVersion,Note content,Instant savedAt,UUID authorUserId,List<Order> orders){}
 public Record get(Actor actor,UUID clinic,UUID branch,UUID patient,UUID encounter){
  if(actor==null)throw ApiProblem.forbidden();var grant=iam.decide(actor.id(),"CLINIC_CONFIG",clinic,null);
  if(!grant.allowed()||!"ADMIN".equals(grant.role()))throw ApiProblem.forbidden();
  return tx.execute(t->{db.scope(clinic,branch);
   var rows=jdbc.queryForList("select c.status,c.document_version,d.content_json,d.created_at saved_at,d.author_user_id from medical_v2.cases c left join medical_v2.document_versions d on d.encounter_id=c.encounter_id and d.version=c.document_version where c.clinic_id=? and c.branch_id=? and c.patient_id=? and c.encounter_id=?",clinic,branch,patient,encounter);
   if(rows.isEmpty())throw ApiProblem.missing();var row=rows.getFirst();
   var orders=jdbc.query("select o.id,o.name,o.state,o.created_at ordered_at,r.content,r.created_at result_at,(select max(rv.created_at) from medical_v2.reviews rv where rv.order_id=o.id and rv.result_id=r.id) reviewed_at from medical_v2.orders o left join medical_v2.results r on r.order_id=o.id and r.version=o.result_version where o.encounter_id=? order by o.created_at,o.id",
    (rs,n)->new Order(rs.getObject("id",UUID.class),rs.getString("name"),rs.getString("state"),rs.getTimestamp("ordered_at").toInstant(),rs.getString("content"),instant(rs,"result_at"),instant(rs,"reviewed_at")),encounter);
   Note note=null;try{if(row.get("content_json")!=null)note=json.readValue(row.get("content_json").toString(),Note.class);}catch(Exception e){throw new IllegalStateException(e);}
   return new Record(encounter,row.get("status").toString(),((Number)row.get("document_version")).longValue(),note,row.get("saved_at")==null?null:((java.sql.Timestamp)row.get("saved_at")).toInstant(),(UUID)row.get("author_user_id"),orders);
  });
 }
 private Instant instant(java.sql.ResultSet rs,String column)throws java.sql.SQLException{var value=rs.getTimestamp(column);return value==null?null:value.toInstant();}
}
