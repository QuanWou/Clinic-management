package com.clinic.v2.billing.service;
import com.clinic.v2.billing.api.ApiProblem;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import java.time.*;
import java.util.*;
import java.nio.charset.StandardCharsets;
@Component public class ChargeSourceClient{
 private final RestClient encounter,medical,appointment;private final javax.crypto.SecretKey key;
 public ChargeSourceClient(@Value("${billing.sources.encounter-url}") String e,@Value("${billing.sources.medical-url}") String m,@Value("${billing.sources.appointment-url}") String a,@Value("${billing.security.service-secret}") String secret){encounter=client(e);medical=client(m);appointment=client(a);key=Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));}
 private RestClient client(String url){var f=new SimpleClientHttpRequestFactory();f.setConnectTimeout(Duration.ofSeconds(2));f.setReadTimeout(Duration.ofSeconds(2));return RestClient.builder().baseUrl(url).requestFactory(f).build();}
 private String bearer(String audience){var now=Instant.now();return "Bearer "+Jwts.builder().issuer("billing-v2-service").subject("billing-v2-service").audience().add(audience).and().id(UUID.randomUUID().toString()).claim("token_type","workload").claim("scopes",List.of("billing.source.sync")).issuedAt(Date.from(now)).expiration(Date.from(now.plusSeconds(30))).signWith(key).compact();}
 private <T>T get(RestClient client,String audience,UUID c,UUID b,UUID id,String path,Class<T> type){if(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive())throw new IllegalStateException("Charge proof HTTP must be outside Billing transaction");return client.get().uri("/api/v2/internal/clinics/{c}/branches/{b}/"+path,c,b,id).header("Authorization",bearer(audience)).retrieve().body(type);}
 public record ReviewedOrder(UUID encounterId,UUID clinicId,UUID branchId,UUID patientId,long caseVersion,UUID id,UUID offeringId,String name,BillingSources.Snapshot price,String state){}
 private void price(BillingSources.Snapshot p){if(p==null||p.priceVersionId()==null||p.amountVnd()<0||p.amountVnd()>9000000000000L||!"VND".equals(p.currency())||p.effectiveFrom()==null||p.effectiveFrom().isAfter(Instant.now()))throw ApiProblem.invalid("Frozen performed source VND price required");}
 public List<BillingSources.Charge> reviewed(UUID c,UUID b,UUID e,UUID order,long version){
  try{var o=get(medical,"medical-v2-service",c,b,order,"orders/{id}/billing-sync-proof",ReviewedOrder.class);
   if(o==null||!e.equals(o.encounterId())||!c.equals(o.clinicId())||!b.equals(o.branchId())||!order.equals(o.id())||o.patientId()==null||o.caseVersion()<version||!"REVIEWED".equals(o.state())||o.offeringId()==null||o.name()==null||o.name().isBlank()||o.name().length()>220)throw ApiProblem.conflict("Reviewed order source does not match event");price(o.price());return List.of(new BillingSources.Charge("MEDICAL_ORDER",o.id(),o.offeringId(),o.name(),o.price()));
  }catch(ApiProblem ex){throw ex;}catch(Exception ex){throw ApiProblem.dependency("Reviewed charge source unavailable");}
 }
 public List<BillingSources.Charge> completed(UUID c,UUID b,UUID e,UUID patient){
  try{var v=get(encounter,"encounter-v2-service",c,b,e,"visits/{id}/billing-sync-proof",BillingSources.Visit.class);
   if(v==null||!e.equals(v.id())||!c.equals(v.clinicId())||!b.equals(v.branchId())||!patient.equals(v.patientId())||!Set.of("CLINICALLY_COMPLETED","CLOSED").contains(v.status())||v.medicalCaseVersion()<1)throw ApiProblem.conflict("Completed source Encounter required");
   var m=get(medical,"medical-v2-service",c,b,e,"visits/{id}/billing-sync-proof",BillingSources.MedicalProof.class);
   if(m==null||!e.equals(m.encounterId())||!c.equals(m.clinicId())||!b.equals(m.branchId())||!patient.equals(m.patientId())||!"VALIDATED".equals(m.status())||m.caseVersion()!=v.medicalCaseVersion()||m.orders()==null||m.orders().size()>200)throw ApiProblem.conflict("Immutable completion Medical version required");
   List<BillingSources.Charge> charges=new ArrayList<>();for(var o:m.orders()){if(o.id()==null||o.offeringId()==null||o.name()==null||o.name().isBlank()||o.name().length()>220)throw ApiProblem.invalid("Invalid source order");price(o.price());charges.add(new BillingSources.Charge("MEDICAL_ORDER",o.id(),o.offeringId(),o.name(),o.price()));}
   if(v.appointmentId()!=null){var a=get(appointment,"appointment-v2-service",c,b,v.appointmentId(),"appointments/{id}/billing-sync-proof",BillingSources.AppointmentProof.class);if(a==null||!v.appointmentId().equals(a.id())||!c.equals(a.clinicId())||!b.equals(a.branchId())||!e.equals(a.encounterId())||!patient.equals(a.patientId())||a.offeringId()==null||a.appointmentCode()==null||!Set.of("CHECKED_IN","FULFILLED").contains(a.status()))throw ApiProblem.conflict("Completed booking source mismatch");price(a.price());charges.add(new BillingSources.Charge("APPOINTMENT",a.id(),a.offeringId(),"Khám theo lịch hẹn "+a.appointmentCode(),a.price()));}
   if(charges.stream().map(ch->ch.sourceType()+":"+ch.sourceId()).distinct().count()!=charges.size())throw ApiProblem.invalid("Duplicate completed source charge");return List.copyOf(charges);
  }catch(ApiProblem ex){throw ex;}catch(Exception ex){throw ApiProblem.dependency("Completed charge source unavailable");}
 }
}
