package com.clinic.encounter.service;
import com.clinic.encounter.api.ApiProblem;
import com.clinic.encounter.security.Actor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import java.time.Duration;
import java.util.UUID;
@Component
public class MedicalReadinessClient {
 private final RestClient client;
 public MedicalReadinessClient(@Value("${encounter.medical-url:http://127.0.0.1:8102}") String url){var f=new SimpleClientHttpRequestFactory();f.setConnectTimeout(Duration.ofSeconds(2));f.setReadTimeout(Duration.ofSeconds(2));client=RestClient.builder().baseUrl(url).requestFactory(f).build();}
 public record Proof(UUID encounterId,UUID clinicId,UUID branchId,long caseVersion,String status,boolean ready){}
 public Proof read(Actor actor,UUID clinic,UUID branch,UUID encounter){
  if(actor.bearer()==null)throw ApiProblem.forbidden();
  try{var p=client.get().uri("/api/clinics/{c}/branches/{b}/visits/{e}/readiness",clinic,branch,encounter).header("Authorization",actor.bearer()).retrieve().body(Proof.class);
   if(p==null||!encounter.equals(p.encounterId())||!clinic.equals(p.clinicId())||!branch.equals(p.branchId()))throw ApiProblem.conflict("Medical readiness scope mismatch");return p;
  }catch(ApiProblem e){throw e;}catch(org.springframework.web.client.HttpClientErrorException.Forbidden e){throw ApiProblem.forbidden();}catch(org.springframework.web.client.HttpClientErrorException.NotFound e){throw ApiProblem.missing();}catch(Exception e){throw ApiProblem.dependency("Medical readiness unavailable; encounter remains open");}
 }
}
