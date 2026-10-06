package com.clinic.medical.api;
import jakarta.validation.constraints.*;
import java.util.*;
import java.time.*;
public final class MedicalDto{
 private MedicalDto(){}
 public record Note(@Size(max=2000) String reasonForVisit,@Size(max=4000) String medicalHistory,@Size(max=2000) String allergies,
  @Size(max=2000) String vitals,@Size(max=4000) String examination,@Size(max=2000) String preliminaryDiagnosis,
  @Size(max=4000) String conclusion,@Size(max=4000) String instructions,LocalDate followUpDate){}
 public record DraftInput(@Min(0) long expectedDocumentVersion,@NotNull @jakarta.validation.Valid Note content,@NotBlank @Size(max=500) String reason){}
 public record DraftView(UUID encounterId,long documentVersion,long caseVersion,String status,Note content,UUID authorUserId,Instant savedAt,String contentHash){}
 public record OrderInput(@Min(0) long expectedCaseVersion,@NotNull UUID offeringId,@NotBlank @Size(max=500) String reason){}
 public record Transition(@Min(0) long expectedVersion,@NotBlank @Size(max=500) String reason){}
 public record ResultInput(@Min(0) long expectedVersion,@NotBlank @Size(max=200) String sourceRef,@NotBlank @Size(max=8000) String content,@NotBlank @Size(max=500) String reason){}
 public record ReviewInput(@Min(0) long expectedVersion,@Min(1) long resultVersion,@NotBlank @Size(max=500) String reason){}
 public record ResultView(UUID id,long version,String sourceRef,String content,String contentHash,UUID authorUserId,Instant createdAt){}
 public record OrderView(UUID id,UUID encounterId,UUID offeringId,String name,String state,long version,long resultVersion,UUID acceptedBy,ResultView result,UUID reviewedBy,com.clinic.medical.service.MedicalSources.PatientSummary patient,String visitCode){
  public OrderView(UUID id,UUID encounterId,UUID offeringId,String name,String state,long version,long resultVersion,UUID acceptedBy,ResultView result,UUID reviewedBy){this(id,encounterId,offeringId,name,state,version,resultVersion,acceptedBy,result,reviewedBy,null,null);}
  public OrderView withIdentity(com.clinic.medical.service.MedicalSources.Visit v){return new OrderView(id,encounterId,offeringId,name,state,version,resultVersion,acceptedBy,result,reviewedBy,v.patient(),v.ticket()==null?null:v.ticket().code());}
 }
}
