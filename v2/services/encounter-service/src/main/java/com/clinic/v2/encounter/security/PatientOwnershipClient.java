package com.clinic.v2.encounter.security;
import com.clinic.v2.encounter.api.ApiProblem;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.*;
import java.time.Duration;
import java.util.*;
@Component public class PatientOwnershipClient {
 private final RestClient client;
 public PatientOwnershipClient(@Value("${encounter.portal.patient-url:http://127.0.0.1:8098}") String url){var f=new SimpleClientHttpRequestFactory();f.setConnectTimeout(Duration.ofSeconds(2));f.setReadTimeout(Duration.ofSeconds(2));client=RestClient.builder().baseUrl(url).requestFactory(f).build();}
 public record Link(UUID clinicId,UUID patientId,String status){}
 public UUID ownPatient(Actor actor,UUID clinic){
  if(actor==null||actor.bearer()==null||!actor.bearer().startsWith("Bearer "))throw ApiProblem.forbidden();
  try{var link=client.get().uri("/api/v2/me/patient-clinic-links/{clinic}",clinic).header("Authorization",actor.bearer()).retrieve().body(Link.class);
   if(link==null||!clinic.equals(link.clinicId())||link.patientId()==null||!Set.of("PROVISIONAL","VERIFIED").contains(link.status()))throw ApiProblem.forbidden();return link.patientId();
  }catch(ApiProblem e){throw e;}catch(RestClientResponseException e){if(e.getStatusCode().value()==404)throw ApiProblem.missing();if(e.getStatusCode().value()==401||e.getStatusCode().value()==403)throw ApiProblem.forbidden();throw ApiProblem.dependency("Patient ownership source unavailable");}catch(Exception e){throw ApiProblem.dependency("Patient ownership source unavailable");}
 }
}
