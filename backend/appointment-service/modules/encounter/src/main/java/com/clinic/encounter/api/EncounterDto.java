package com.clinic.encounter.api;
import jakarta.validation.constraints.*;
import java.util.*;
import java.time.*;
public final class EncounterDto {
 private EncounterDto(){}
 public record PointInput(@NotBlank @Pattern(regexp="[A-Z0-9]{1,8}") String code,@NotBlank @Size(max=100) String name){}
 public record PointView(UUID id,String code,String name,boolean active){}
 public record WalkInInput(@NotNull UUID patientId,UUID doctorId,@NotNull UUID servicePointId,@NotBlank @Size(max=500) String reason,@NotNull UUID offeringId){}
 public record CheckInInput(@NotNull UUID patientId,@NotNull UUID servicePointId,@NotBlank @Size(max=500) String reason){}
 public record QueueInput(@Min(0) long expectedVersion,@NotBlank @Size(max=500) String reason,UUID destinationPointId){}
 public record CareInput(@Min(0) long expectedVersion,@NotBlank @Size(max=500) String reason,UUID servicePointId){}
 public record CompletionInput(@Min(0) long expectedVersion,@Min(1) long medicalCaseVersion,@NotBlank @Size(max=500) String reason,boolean consultationConfirmed){}
 public record PriceSnapshot(UUID priceVersionId,long amountVnd,String currency,Instant effectiveFrom,String taxPolicyCode,String discountPolicyCode){}
 public record Consultation(UUID offeringId,String name,PriceSnapshot price){}
 public record ClosureInput(@Min(0) long expectedVersion,@NotBlank @Size(max=500) String reason){}
 public record PatientSummary(UUID patientId,String patientCode,String fullName,LocalDate dateOfBirth){}
 public record TicketView(UUID id,UUID visitId,UUID servicePointId,LocalDate date,int number,String code,String state,long version,PatientSummary patient,UUID doctorId,Instant checkedInAt,Instant issuedAt){
  public TicketView(UUID id,UUID visitId,UUID servicePointId,LocalDate date,int number,String code,String state,long version){this(id,visitId,servicePointId,date,number,code,state,version,null,null,null,null);}
  public TicketView(UUID id,UUID visitId,UUID servicePointId,LocalDate date,int number,String code,String state,long version,PatientSummary patient,UUID doctorId,Instant checkedInAt){this(id,visitId,servicePointId,date,number,code,state,version,patient,doctorId,checkedInAt,null);}
  public TicketView withPatient(PatientSummary p){return new TicketView(id,visitId,servicePointId,date,number,code,state,version,p,doctorId,checkedInAt,issuedAt);}
  public TicketView withReception(UUID doctor,Instant arrived){return new TicketView(id,visitId,servicePointId,date,number,code,state,version,patient,doctor,arrived,issuedAt);}
  public TicketView withIssuedAt(Instant issued){return new TicketView(id,visitId,servicePointId,date,number,code,state,version,patient,doctorId,checkedInAt,issued);}
 }
 public record VisitView(UUID id,UUID clinicId,UUID branchId,UUID patientId,UUID clinicPatientLinkId,UUID appointmentId,UUID doctorId,String status,Instant checkedInAt,long version,TicketView ticket,PatientSummary patient,Consultation consultation,Instant consultationPerformedAt){
  public VisitView(UUID id,UUID clinicId,UUID branchId,UUID patientId,UUID clinicPatientLinkId,UUID appointmentId,UUID doctorId,String status,Instant checkedInAt,long version,TicketView ticket){this(id,clinicId,branchId,patientId,clinicPatientLinkId,appointmentId,doctorId,status,checkedInAt,version,ticket,null,null,null);}
  public VisitView withPatient(PatientSummary p){return new VisitView(id,clinicId,branchId,patientId,clinicPatientLinkId,appointmentId,doctorId,status,checkedInAt,version,ticket==null?null:ticket.withPatient(p).withReception(doctorId,checkedInAt),p,consultation,consultationPerformedAt);}
 }
}
