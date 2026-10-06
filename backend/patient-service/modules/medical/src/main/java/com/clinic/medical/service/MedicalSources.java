package com.clinic.medical.service;
import com.clinic.medical.security.Actor;
import com.clinic.medical.api.ApiProblem;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import java.time.*;
import java.util.*;
@Component public class MedicalSources{
 private final RestClient encounter,catalog;
 public MedicalSources(@Value("${medical.sources.encounter-url:http://127.0.0.1:8101}") String e,@Value("${medical.sources.catalog-url:http://127.0.0.1:8095}") String c){encounter=client(e);catalog=client(c);}
 private RestClient client(String url){var f=new SimpleClientHttpRequestFactory();f.setConnectTimeout(Duration.ofSeconds(2));f.setReadTimeout(Duration.ofSeconds(2));return RestClient.builder().baseUrl(url).requestFactory(f).build();}
 public record PatientSummary(UUID patientId,String patientCode,String fullName,LocalDate dateOfBirth){}
 public record Ticket(String code){}
 public record Visit(UUID id,UUID clinicId,UUID branchId,UUID patientId,UUID doctorId,String status,long version,PatientSummary patient,Ticket ticket){
  public Visit(UUID id,UUID clinicId,UUID branchId,UUID patientId,UUID doctorId,String status,long version){this(id,clinicId,branchId,patientId,doctorId,status,version,null,null);}
 }
 public Visit visit(Actor actor,UUID clinic,UUID branch,UUID id){try{var v=encounter.get().uri("/api/clinics/{c}/branches/{b}/doctor/visits/{id}",clinic,branch,id).header("Authorization",actor.bearer()).retrieve().body(Visit.class);if(v==null||!id.equals(v.id())||!clinic.equals(v.clinicId())||!branch.equals(v.branchId())||v.patientId()==null||v.doctorId()==null)throw ApiProblem.forbidden();return v;}catch(ApiProblem e){throw e;}catch(org.springframework.web.client.HttpClientErrorException.Forbidden e){throw ApiProblem.forbidden();}catch(org.springframework.web.client.HttpClientErrorException.NotFound e){throw ApiProblem.missing();}catch(Exception e){throw ApiProblem.dependency("Assigned encounter source unavailable");}}
 public List<Visit> identities(Actor actor,UUID clinic,UUID branch,List<UUID> ids){
  if(ids.isEmpty())return List.of();
  try{var rows=encounter.post().uri("/api/clinics/{c}/branches/{b}/doctor/visit-identities",clinic,branch).header("Authorization",actor.bearer()).contentType(org.springframework.http.MediaType.APPLICATION_JSON).body(ids).retrieve().body(Visit[].class);
   if(rows==null||Arrays.stream(rows).anyMatch(v->!ids.contains(v.id())||!clinic.equals(v.clinicId())||!branch.equals(v.branchId())))throw ApiProblem.dependency("Invalid assigned identities");return List.of(rows);
  }catch(ApiProblem e){throw e;}catch(Exception e){throw ApiProblem.dependency("Chưa tải được bệnh nhân của chỉ định. Vui lòng thử lại.");}
 }
 public record Snapshot(UUID priceVersionId,UUID clinicId,UUID branchId,UUID offeringId,long amountVnd,String currency,String taxPolicyCode,String discountPolicyCode,Instant effectiveFrom,Instant resolvedAt){}
 public record Offering(UUID id,String name){}
 public record BranchOffering(UUID clinicId,UUID branchId,Offering offering,boolean active){}
 public String offeringName(Actor actor,UUID clinic,UUID branch,UUID offering){try{var list=catalog.get().uri("/api/clinics/{c}/branches/{b}/offerings",clinic,branch).header("Authorization",actor.bearer()).retrieve().body(BranchOffering[].class);if(list==null)throw ApiProblem.missing();return Arrays.stream(list).filter(x->x.active()&&clinic.equals(x.clinicId())&&branch.equals(x.branchId())&&x.offering()!=null&&offering.equals(x.offering().id())).map(x->x.offering().name()).filter(n->n!=null&&!n.isBlank()&&n.length()<=220).findFirst().orElseThrow(ApiProblem::missing);}catch(ApiProblem e){throw e;}catch(Exception e){throw ApiProblem.dependency("Catalog offering source unavailable");}}
 public Snapshot price(Actor actor,UUID clinic,UUID branch,UUID offering){try{var p=catalog.get().uri("/api/clinics/{c}/branches/{b}/offerings/{id}/price-snapshot",clinic,branch,offering).header("Authorization",actor.bearer()).retrieve().body(Snapshot.class);if(p==null||!clinic.equals(p.clinicId())||!branch.equals(p.branchId())||!offering.equals(p.offeringId())||p.priceVersionId()==null||p.amountVnd()<0||!"VND".equals(p.currency())||p.effectiveFrom()==null||p.effectiveFrom().isAfter(Instant.now()))throw ApiProblem.invalid("Invalid source price");return p;}catch(ApiProblem e){throw e;}catch(Exception e){throw ApiProblem.dependency("Catalog price source unavailable");}}
}
