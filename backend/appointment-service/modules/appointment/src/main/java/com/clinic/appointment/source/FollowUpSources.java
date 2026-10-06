package com.clinic.appointment.source;
import com.clinic.appointment.api.ApiProblem;
import com.clinic.appointment.api.AppointmentDto.FollowUpInput;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.*;
import java.time.*;
import java.util.*;
@Component public class FollowUpSources {
 private final RestClient encounter,medical;
 public FollowUpSources(@Value("${appointment.follow-up.encounter-url:http://127.0.0.1:8101}") String e,@Value("${appointment.follow-up.medical-url:http://127.0.0.1:8102}") String m){encounter=client(e);medical=client(m);}
 private RestClient client(String url){var f=new SimpleClientHttpRequestFactory();f.setConnectTimeout(Duration.ofSeconds(2));f.setReadTimeout(Duration.ofSeconds(2));return RestClient.builder().baseUrl(url).requestFactory(f).build();}
 public record Visit(UUID encounterId,UUID clinicId,UUID branchId,UUID patientId,String status,long medicalCaseVersion){}
 public record Medical(UUID encounterId,UUID clinicId,UUID branchId,UUID patientId,long caseVersion,LocalDate proposedDate){}
 public record Proof(UUID encounterId,UUID branchId,UUID patientId,long medicalVersion,LocalDate proposedDate){}
 private <T>T get(RestClient client,String bearer,FollowUpInput in,Class<T> type){return client.get().uri("/api/me/clinics/{c}/branches/{b}/visits/{id}/follow-up-proof",in.clinicId(),in.priorBranchId(),in.priorEncounterId()).header("Authorization",bearer).retrieve().body(type);}
 public Proof proof(String bearer,FollowUpInput in){
  if(bearer==null||!bearer.startsWith("Bearer "))throw ApiProblem.forbidden();
  try{var e=get(encounter,bearer,in,Visit.class);var m=get(medical,bearer,in,Medical.class);
   if(e==null||m==null||!in.priorEncounterId().equals(e.encounterId())||!in.priorEncounterId().equals(m.encounterId())||!in.clinicId().equals(e.clinicId())||!in.clinicId().equals(m.clinicId())||!in.priorBranchId().equals(e.branchId())||!in.priorBranchId().equals(m.branchId())||!in.patientId().equals(e.patientId())||!in.patientId().equals(m.patientId())||!Set.of("CLINICALLY_COMPLETED","CLOSED").contains(e.status())||e.medicalCaseVersion()<1||m.caseVersion()!=e.medicalCaseVersion()||m.proposedDate()==null)throw ApiProblem.conflict("Completed prior visit and immutable follow-up date must agree");
   return new Proof(in.priorEncounterId(),in.priorBranchId(),in.patientId(),m.caseVersion(),m.proposedDate());
  }catch(ApiProblem e){throw e;}catch(RestClientResponseException e){if(e.getStatusCode().value()==404)throw ApiProblem.missing();if(e.getStatusCode().value()==401||e.getStatusCode().value()==403)throw ApiProblem.forbidden();if(e.getStatusCode().value()==409)throw ApiProblem.conflict("Prior visit is not ready for follow-up booking");throw ApiProblem.dependency("Follow-up source proof unavailable");}catch(Exception e){throw ApiProblem.dependency("Follow-up source proof unavailable");}
 }
}
