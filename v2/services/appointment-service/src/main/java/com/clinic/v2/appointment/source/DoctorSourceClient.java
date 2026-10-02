package com.clinic.v2.appointment.source;
import com.clinic.v2.appointment.api.ApiProblem;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import java.time.*;
import java.util.*;

@Component
public class DoctorSourceClient{
 private final RestClient client;
 public DoctorSourceClient(@Value("${appointment.security.doctor-url}") String url){
  var f=new SimpleClientHttpRequestFactory();f.setConnectTimeout(Duration.ofSeconds(2));f.setReadTimeout(Duration.ofSeconds(2));
  client=RestClient.builder().baseUrl(url).requestFactory(f).build();
 }
 public Doctor requireDoctor(UUID clinicId,UUID branchId,UUID doctorId){
  try{
   List<Doctor> rows=client.get().uri("/api/v2/public/clinics/{clinicId}/branches/{branchId}/doctors",clinicId,branchId)
    .retrieve().body(new ParameterizedTypeReference<List<Doctor>>(){});
   return Optional.ofNullable(rows).orElse(List.of()).stream().filter(x->doctorId.equals(x.practitionerId())).findFirst().orElseThrow(ApiProblem::missing);
  }catch(ApiProblem e){throw e;}catch(Exception e){throw ApiProblem.unavailable("Doctor schedule could not be verified");}
 }
 public record Schedule(int dayOfWeek,LocalTime startTime,LocalTime endTime,String timezone,LocalDate effectiveFrom,LocalDate effectiveUntil,long version){}
 public record Absence(Instant startsAt,Instant endsAt){}
 public record Doctor(UUID practitionerId,UUID clinicId,UUID branchId,String displayName,String specialtyCode,String specialtyName,String professionalTitle,long affiliationVersion,List<Schedule> schedules,List<Absence> absences){
  public Doctor(UUID practitionerId,UUID clinicId,UUID branchId,String displayName,String specialtyCode,String specialtyName,String professionalTitle,long affiliationVersion,List<Schedule> schedules){this(practitionerId,clinicId,branchId,displayName,specialtyCode,specialtyName,professionalTitle,affiliationVersion,schedules,List.of());}
 }
}
