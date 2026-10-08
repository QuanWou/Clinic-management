package com.clinic.medical.service;
import com.clinic.medical.api.ApiProblem;
import com.clinic.medical.security.Actor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.*;
import java.time.Duration;
import java.util.*;
@Component public class PatientEncounterSource {
 private final RestClient client;
 public PatientEncounterSource(@Value("${medical.sources.encounter-url:http://127.0.0.1:8101}") String url){var f=new SimpleClientHttpRequestFactory();f.setConnectTimeout(Duration.ofSeconds(2));f.setReadTimeout(Duration.ofSeconds(3));client=RestClient.builder().baseUrl(url).requestFactory(f).build();}
 public record Proof(UUID encounterId,UUID clinicId,UUID branchId,UUID patientId,String status,long medicalCaseVersion){}
 public List<Proof> completed(Actor actor,UUID clinic,UUID branch,List<UUID> ids){
  if(actor==null||actor.bearer()==null||!actor.bearer().startsWith("Bearer "))throw ApiProblem.forbidden();
  if(ids==null||ids.isEmpty())return List.of();
  try{var body=client.post().uri("/api/me/clinics/{c}/branches/{b}/completed-visits",clinic,branch).header("Authorization",actor.bearer()).body(ids).retrieve().body(new ParameterizedTypeReference<List<Proof>>(){});return body==null?List.of():body;}
  catch(ApiProblem e){throw e;}catch(RestClientResponseException e){if(e.getStatusCode().value()==401||e.getStatusCode().value()==403)throw ApiProblem.forbidden();throw ApiProblem.dependency("Completed encounter source unavailable");}catch(Exception e){throw ApiProblem.dependency("Completed encounter source unavailable");}
 }
}
