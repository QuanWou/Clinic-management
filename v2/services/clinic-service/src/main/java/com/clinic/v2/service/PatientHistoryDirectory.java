package com.clinic.v2.service;
import com.clinic.v2.api.ApiProblem;
import com.clinic.v2.security.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.util.*;
@Service public class PatientHistoryDirectory {
 private final PatientHistoryClient patient;private final JdbcTemplate jdbc;private final TenantDbContext db;private final TransactionTemplate tx;
 public PatientHistoryDirectory(PatientHistoryClient patient,JdbcTemplate jdbc,TenantDbContext db,PlatformTransactionManager manager){this.patient=patient;this.jdbc=jdbc;this.db=db;tx=new TransactionTemplate(manager);tx.setReadOnly(true);}
 public record Branch(UUID branchId,String name,boolean active){}
 public record Clinic(UUID clinicId,String name,List<Branch> branches){}
 public List<Clinic> own(Actor actor,String bearer){
  if(actor==null)throw ApiProblem.forbidden();var ids=patient.clinics(bearer);if(ids==null||ids.size()>100)throw ApiProblem.forbidden();List<Clinic> list=new ArrayList<>();
  for(UUID id:new LinkedHashSet<>(ids)){if(id==null)throw ApiProblem.forbidden();var row=tx.execute(t->{db.tenant(id);var rows=jdbc.queryForList("select name from clinic.clinics where id=?",String.class,id);if(rows.isEmpty())return null;var branches=jdbc.query("select id,name,active from clinic.branches where clinic_id=? order by name,id",(rs,n)->new Branch(rs.getObject("id",UUID.class),rs.getString("name"),rs.getBoolean("active")),id);return new Clinic(id,rows.getFirst(),branches);});if(row!=null)list.add(row);}
  list.sort(Comparator.comparing(Clinic::name));return List.copyOf(list);
 }
}
