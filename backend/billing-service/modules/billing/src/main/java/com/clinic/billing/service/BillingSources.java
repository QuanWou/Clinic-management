package com.clinic.billing.service;
import com.clinic.billing.api.ApiProblem;
import com.clinic.billing.security.Actor;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import java.time.*;
import java.util.*;
import java.nio.charset.StandardCharsets;
@Component public class BillingSources {
 private final RestClient encounter,medical,appointment;private final javax.crypto.SecretKey key;
 public BillingSources(@Value("${billing.sources.encounter-url}") String e,@Value("${billing.sources.medical-url}") String m,@Value("${billing.sources.appointment-url}") String a,@Value("${billing.security.service-secret}") String secret){encounter=client(e);medical=client(m);appointment=client(a);key=Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));}
 private RestClient client(String url){var f=new SimpleClientHttpRequestFactory();f.setConnectTimeout(Duration.ofSeconds(2));f.setReadTimeout(Duration.ofSeconds(2));return RestClient.builder().baseUrl(url).requestFactory(f).build();}
 private String bearer(String audience){var now=Instant.now();return "Bearer "+Jwts.builder().issuer("billing-service").subject("billing-service").audience().add(audience).and().id(UUID.randomUUID().toString()).claim("token_type","workload").claim("scopes",List.of("billing.source.read")).issuedAt(Date.from(now)).expiration(Date.from(now.plusSeconds(30))).signWith(key).compact();}
 public record Consultation(UUID offeringId,String name,Snapshot price){}
 public record Visit(UUID id,UUID clinicId,UUID branchId,UUID patientId,UUID appointmentId,String status,long medicalCaseVersion,Consultation consultation){
  public Visit(UUID id,UUID clinicId,UUID branchId,UUID patientId,UUID appointmentId,String status,long medicalCaseVersion){this(id,clinicId,branchId,patientId,appointmentId,status,medicalCaseVersion,null);}
 }
 public record Snapshot(UUID priceVersionId,long amountVnd,String currency,Instant effectiveFrom,String taxPolicyCode,String discountPolicyCode){}
 public record Order(UUID id,UUID offeringId,String name,Snapshot price){}
 public record MedicalProof(UUID encounterId,UUID clinicId,UUID branchId,UUID patientId,long caseVersion,String status,List<Order> orders){}
 public record AppointmentProof(UUID id,UUID clinicId,UUID branchId,UUID patientId,UUID encounterId,UUID offeringId,String appointmentCode,String status,Snapshot price){}
 public record Charge(String sourceType,UUID sourceId,UUID offeringId,String name,Snapshot price){}
 public record Proof(UUID encounterId,UUID patientId,List<Charge> charges){}
 private <T>T get(RestClient client,String audience,Actor actor,UUID c,UUID b,UUID id,String suffix,Class<T> type){return client.get().uri("/api/internal/clinics/{c}/branches/{b}/"+suffix,c,b,id).header("Authorization",bearer(audience)).header("X-Actor-User-Id",actor.id().toString()).retrieve().body(type);}
 public Proof proof(Actor actor,UUID c,UUID b,UUID e){
  try{
   var v=get(encounter,"encounter-service",actor,c,b,e,"visits/{id}/billing-proof",Visit.class);
   if(v==null||!e.equals(v.id())||!c.equals(v.clinicId())||!b.equals(v.branchId())||v.patientId()==null||!Set.of("CLINICALLY_COMPLETED","CLOSED").contains(v.status())||v.medicalCaseVersion()<1)throw ApiProblem.conflict("Completed source Encounter required");
   var m=get(medical,"medical-service",actor,c,b,e,"visits/{id}/billing-proof",MedicalProof.class);
   if(m==null||!e.equals(m.encounterId())||!c.equals(m.clinicId())||!b.equals(m.branchId())||!v.patientId().equals(m.patientId())||!"VALIDATED".equals(m.status())||m.caseVersion()!=v.medicalCaseVersion()||m.orders()==null||m.orders().size()>200)throw ApiProblem.conflict("Immutable Medical source proof required");
   List<Charge> charges=new ArrayList<>();
   for(var o:m.orders()){if(o.id()==null||o.offeringId()==null||o.name()==null||o.name().isBlank()||o.name().length()>220)throw ApiProblem.invalid("Invalid source order");price(o.price());charges.add(new Charge("MEDICAL_ORDER",o.id(),o.offeringId(),o.name(),o.price()));}
   if(v.appointmentId()!=null){var a=get(appointment,"appointment-service",actor,c,b,v.appointmentId(),"appointments/{id}/billing-proof",AppointmentProof.class);
    if(a==null||!v.appointmentId().equals(a.id())||!c.equals(a.clinicId())||!b.equals(a.branchId())||!e.equals(a.encounterId())||!v.patientId().equals(a.patientId())||a.offeringId()==null||!Set.of("CHECKED_IN","FULFILLED").contains(a.status()))throw ApiProblem.conflict("Source booking does not belong to completed Encounter");price(a.price());charges.add(new Charge("APPOINTMENT",a.id(),a.offeringId(),"Khám theo lịch hẹn "+a.appointmentCode(),a.price()));
   }
   if(v.appointmentId()==null&&v.consultation()!=null){var performed=v.consultation();price(performed.price());if(performed.offeringId()==null||performed.name()==null||performed.name().isBlank()||performed.name().length()>220)throw ApiProblem.invalid("Invalid performed consultation");charges.add(new Charge("WALK_IN",v.id(),performed.offeringId(),performed.name(),performed.price()));}
   if(charges.stream().map(x->x.sourceType()+":"+x.sourceId()).distinct().count()!=charges.size())throw ApiProblem.invalid("Duplicate source charge");
   return new Proof(e,v.patientId(),List.copyOf(charges));
  }catch(ApiProblem x){throw x;}catch(Exception x){throw ApiProblem.dependency("Billing source evidence unavailable; no bill issued");}
 }
 private void price(Snapshot p){if(p==null||p.priceVersionId()==null||p.amountVnd()<0||p.amountVnd()>9000000000000L||!"VND".equals(p.currency())||p.effectiveFrom()==null||p.effectiveFrom().isAfter(Instant.now()))throw ApiProblem.invalid("Frozen source VND price required");}
}
