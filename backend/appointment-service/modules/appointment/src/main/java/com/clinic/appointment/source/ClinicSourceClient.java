package com.clinic.appointment.source;
import com.clinic.appointment.api.ApiProblem;
import com.clinic.appointment.security.WorkloadTokenIssuer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import java.time.Duration;
import java.util.UUID;

@Component
public class ClinicSourceClient{
 private final RestClient client;private final WorkloadTokenIssuer tokens;
 public ClinicSourceClient(@Value("${appointment.security.clinic-url}") String url,WorkloadTokenIssuer tokens){
  var f=new SimpleClientHttpRequestFactory();f.setConnectTimeout(Duration.ofSeconds(2));f.setReadTimeout(Duration.ofSeconds(2));
  client=RestClient.builder().baseUrl(url).requestFactory(f).build();this.tokens=tokens;
 }
 public BookingEligibility requireEligible(UUID clinicId,UUID branchId){
  try{
   BookingEligibility e=client.get().uri(u->u.path("/api/internal/clinics/{clinicId}/booking-eligibility").queryParam("branchId",branchId).build(clinicId))
     .header(HttpHeaders.AUTHORIZATION,tokens.bearer("clinic-service","clinic.booking.read")).retrieve().body(BookingEligibility.class);
   if(e==null||!clinicId.equals(e.clinicId())||!e.eligible())throw ApiProblem.unavailable("Clinic/branch is not accepting new bookings");
   return e;
  }catch(ApiProblem e){throw e;}catch(Exception e){throw ApiProblem.unavailable("Clinic eligibility could not be verified");}
 }
 public record BookingEligibility(UUID clinicId,boolean eligible,long version){}
}
