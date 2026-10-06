package com.clinic.billing.service;
import com.clinic.billing.api.ApiProblem;
import com.clinic.billing.security.BillingDb;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import java.util.*;
@Component public class ChargeSnapshots{
 private final JdbcTemplate jdbc;private final BillingDb db;private final ObjectMapper json;
 public ChargeSnapshots(JdbcTemplate jdbc,BillingDb db,ObjectMapper json){this.jdbc=jdbc;this.db=db;this.json=json;}
 public UUID merge(UUID clinic,UUID branch,UUID encounter,BillingSources.Charge charge){
  if(!org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive())throw new IllegalStateException("Charge merge requires local transaction");
  if(charge==null||charge.sourceType()==null||!Set.of("APPOINTMENT","MEDICAL_ORDER","WALK_IN").contains(charge.sourceType())||charge.sourceId()==null||charge.offeringId()==null||charge.name()==null||charge.name().isBlank()||charge.name().length()>220||charge.price()==null||charge.price().priceVersionId()==null||!"VND".equals(charge.price().currency())||charge.price().amountVnd()<0||charge.price().amountVnd()>9000000000000L||charge.price().effectiveFrom()==null||charge.price().effectiveFrom().isAfter(java.time.Instant.now()))throw ApiProblem.invalid("Frozen source charge required");
  db.lock("source-charge:"+clinic+":"+charge.sourceType()+":"+charge.sourceId());
  var rows=jdbc.queryForList("select * from billing_v2.charges where source_type=? and source_id=?",charge.sourceType(),charge.sourceId());
  if(!rows.isEmpty()){var row=rows.getFirst();BillingSources.Snapshot stored;try{stored=json.readValue(row.get("price_snapshot_json").toString(),BillingSources.Snapshot.class);}catch(Exception ex){throw new IllegalStateException(ex);}
   if(!encounter.equals(row.get("encounter_id"))||!branch.equals(row.get("branch_id"))||!charge.offeringId().equals(row.get("offering_id"))||!charge.name().equals(row.get("name"))||!charge.price().equals(stored))throw ApiProblem.conflict("Existing source charge snapshot differs; reconciliation required");return (UUID)row.get("id");
  }
  UUID id=UUID.randomUUID();String snapshot;try{snapshot=json.writeValueAsString(charge.price());}catch(Exception ex){throw new IllegalStateException(ex);}
  jdbc.update("insert into billing_v2.charges(id,clinic_id,branch_id,encounter_id,source_type,source_id,offering_id,name,amount_vnd,price_snapshot_json) values(?,?,?,?,?,?,?,?,?,?)",id,clinic,branch,encounter,charge.sourceType(),charge.sourceId(),charge.offeringId(),charge.name(),charge.price().amountVnd(),snapshot);return id;
 }
}
