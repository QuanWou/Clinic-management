package com.clinic.medical.service;
import com.clinic.medical.api.ApiProblem;
import com.clinic.medical.security.*;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.LocalDate;
import java.util.*;
@Service public class PatientFollowUpService {
 private final JdbcTemplate jdbc;private final MedicalDb db;private final PatientOwnershipClient owner;private final TransactionTemplate tx;
 public PatientFollowUpService(JdbcTemplate jdbc,MedicalDb db,PatientOwnershipClient owner,PlatformTransactionManager manager){this.jdbc=jdbc;this.db=db;this.owner=owner;tx=new TransactionTemplate(manager);tx.setReadOnly(true);}
 public record Plan(UUID encounterId,UUID clinicId,UUID branchId,long caseVersion,LocalDate proposedDate){}
 public record Proof(UUID encounterId,UUID clinicId,UUID branchId,UUID patientId,long caseVersion,LocalDate proposedDate){}
 private String query(){return "select c.encounter_id,c.row_version,d.content_json::jsonb->>'followUpDate' proposed_date from medical_v2.cases c join medical_v2.document_versions d on d.encounter_id=c.encounter_id and d.version=c.document_version where c.patient_id=? and c.status='VALIDATED' and d.content_json::jsonb->>'followUpDate' is not null";}
 public List<Plan> list(Actor actor,UUID c,UUID b){UUID patient=owner.ownPatient(actor,c);if(patient==null)throw ApiProblem.forbidden();return tx.execute(t->{db.scope(c,b);return jdbc.query(query()+" order by c.created_at desc limit 100",(rs,n)->new Plan(rs.getObject("encounter_id",UUID.class),c,b,rs.getLong("row_version"),LocalDate.parse(rs.getString("proposed_date"))),patient);});}
 public Proof proof(Actor actor,UUID c,UUID b,UUID id){UUID patient=owner.ownPatient(actor,c);if(patient==null)throw ApiProblem.forbidden();return tx.execute(t->{db.scope(c,b);var rows=jdbc.query(query()+" and c.encounter_id=?",(rs,n)->new Proof(rs.getObject("encounter_id",UUID.class),c,b,patient,rs.getLong("row_version"),LocalDate.parse(rs.getString("proposed_date"))),patient,id);if(rows.isEmpty())throw ApiProblem.missing();return rows.getFirst();});}
}
