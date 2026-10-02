package com.clinic.v2.encounter.api;
import jakarta.validation.constraints.*;
import java.util.*;
import java.time.*;
public final class EncounterDto {
 private EncounterDto(){}
 public record PointInput(@NotBlank @Pattern(regexp="[A-Z0-9]{1,8}") String code,@NotBlank @Size(max=100) String name){}
 public record PointView(UUID id,String code,String name,boolean active){}
 public record WalkInInput(@NotNull UUID patientId,@NotNull UUID doctorId,@NotNull UUID servicePointId,@NotBlank @Size(max=500) String reason){}
 public record CheckInInput(@NotNull UUID patientId,@NotNull UUID servicePointId,@NotBlank @Size(max=500) String reason){}
 public record QueueInput(@Min(0) long expectedVersion,@NotBlank @Size(max=500) String reason,UUID destinationPointId){}
 public record CareInput(@Min(0) long expectedVersion,@NotBlank @Size(max=500) String reason,UUID servicePointId){}
 public record CompletionInput(@Min(0) long expectedVersion,@Min(1) long medicalCaseVersion,@NotBlank @Size(max=500) String reason){}
 public record ClosureInput(@Min(0) long expectedVersion,@NotBlank @Size(max=500) String reason){}
 public record TicketView(UUID id,UUID visitId,UUID servicePointId,LocalDate date,int number,String code,String state,long version){}
 public record VisitView(UUID id,UUID clinicId,UUID branchId,UUID patientId,UUID clinicPatientLinkId,UUID appointmentId,UUID doctorId,String status,Instant checkedInAt,long version,TicketView ticket){}
}
