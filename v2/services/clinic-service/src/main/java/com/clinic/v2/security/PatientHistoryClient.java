package com.clinic.v2.security;
import com.clinic.v2.api.ApiProblem;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.*;
import java.time.Duration;
import java.util.*;
@Component public class PatientHistoryClient {
 private final RestClient client;
 public PatientHistoryClient(@Value("${clinic.security.patient-url:http://127.0.0.1:8098}") String url){var f=new SimpleClientHttpRequestFactory();f.setConnectTimeout(Duration.ofSeconds(2));f.setReadTimeout(Duration.ofSeconds(2));client=RestClient.builder().baseUrl(url).requestFactory(f).build();}
 public record Link(UUID clinicId,UUID patientId,String status){}
 public List<UUID> clinics(String bearer){
  if(bearer==null||!bearer.startsWith("Bearer "))throw ApiProblem.forbidden();
  try{var links=client.get().uri("/api/v2/me/patient-clinic-links").header("Authorization",bearer).retrieve().body(new ParameterizedTypeReference<List<Link>>(){});
   if(links==null||links.size()>100||links.stream().anyMatch(l->l.clinicId()==null||l.patientId()==null||!Set.of("PROVISIONAL","VERIFIED").contains(l.status())))throw ApiProblem.forbidden();return links.stream().map(Link::clinicId).distinct().toList();
  }catch(ApiProblem e){throw e;}catch(RestClientResponseException e){if(e.getStatusCode().value()==401||e.getStatusCode().value()==403)throw ApiProblem.forbidden();throw ApiProblem.dependency("Patient history source unavailable");}catch(Exception e){throw ApiProblem.dependency("Patient history source unavailable");}
 }
}
