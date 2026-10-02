package com.clinic.v2.billing.service;
import com.clinic.v2.billing.api.ApiProblem;
import com.clinic.v2.billing.security.*;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.Instant;
import java.util.*;
@Service public class PatientBillingService {
 private final JdbcTemplate jdbc;private final BillingDb db;private final PatientBillingIdentity patient;private final TransactionTemplate tx;
 public PatientBillingService(JdbcTemplate jdbc,BillingDb db,PatientBillingIdentity patient,PlatformTransactionManager manager){this.jdbc=jdbc;this.db=db;this.patient=patient;tx=new TransactionTemplate(manager);tx.setReadOnly(true);}
 public record Line(String name,long amountVnd){}
 public record Receipt(UUID id,long amountVnd,String currency,String method,String receiptCode,Instant createdAt,String label){}
 public record Bill(UUID id,String currency,long subtotalVnd,long adjustmentVnd,long paidVnd,long remainingVnd,String status,Instant issuedAt,List<Line> lines,List<Receipt> receipts){}
 public List<Bill> list(Actor actor,UUID clinic,UUID branch){var owner=patient.ownPatient(actor,clinic);if(owner==null)throw ApiProblem.forbidden();return tx.execute(t->{db.scope(clinic,branch);return jdbc.queryForList("select id from billing_v2.bills where patient_id=? order by created_at desc limit 100",UUID.class,owner).stream().map(id->bill(id,owner)).toList();});}
 public Bill read(Actor actor,UUID clinic,UUID branch,UUID id){var owner=patient.ownPatient(actor,clinic);if(owner==null)throw ApiProblem.forbidden();return tx.execute(t->{db.scope(clinic,branch);return bill(id,owner);});}
 private Bill bill(UUID id,UUID patientId){
  var rows=jdbc.queryForList("select id,subtotal_vnd,adjustment_vnd,paid_vnd,status,created_at from billing_v2.bills where id=? and patient_id=?",id,patientId);if(rows.isEmpty())throw ApiProblem.missing();var r=rows.getFirst();
  var lines=jdbc.query("select ch.name,ch.amount_vnd from billing_v2.bill_lines l join billing_v2.charges ch on ch.id=l.charge_id join billing_v2.bills b on b.id=l.bill_id where b.id=? and b.patient_id=? order by ch.created_at,ch.id",(rs,n)->new Line(rs.getString("name"),rs.getLong("amount_vnd")),id,patientId);
  var receipts=jdbc.query("select p.id,p.amount_vnd,p.method,p.receipt_code,p.created_at from billing_v2.payments p join billing_v2.bills b on b.id=p.bill_id where b.id=? and b.patient_id=? order by p.created_at,p.id",(rs,n)->new Receipt(rs.getObject("id",UUID.class),rs.getLong("amount_vnd"),"VND",rs.getString("method"),rs.getString("receipt_code"),rs.getTimestamp("created_at").toInstant(),"BIÊN NHẬN NỘI BỘ — KHÔNG PHẢI HÓA ĐƠN THUẾ"),id,patientId);
  long total=((Number)r.get("subtotal_vnd")).longValue(),adjustment=((Number)r.get("adjustment_vnd")).longValue(),paid=((Number)r.get("paid_vnd")).longValue();return new Bill(id,"VND",total,adjustment,paid,total-adjustment-paid,r.get("status").toString(),((java.sql.Timestamp)r.get("created_at")).toInstant(),lines,receipts);
 }
}
