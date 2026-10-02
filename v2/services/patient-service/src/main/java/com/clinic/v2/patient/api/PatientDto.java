package com.clinic.v2.patient.api;
import jakarta.validation.constraints.*;
import java.time.*;
import java.util.UUID;
public final class PatientDto{
 private PatientDto(){}
 public record ProfileInput(@NotBlank @Size(max=180) String fullName,@NotNull @Past LocalDate dateOfBirth,
   @Size(max=20) String sex,@Pattern(regexp="^[0-9+() .-]{0,30}$") String phone,@Email @Size(max=180) String email,long expectedVersion){}
 public record ProfileView(UUID patientId,String fullName,LocalDate dateOfBirth,String sex,String phone,String email,long version){}
 public record BookingIdentity(UUID patientId,UUID platformUserId,boolean active){}
 public record ClinicLinkView(UUID id,UUID clinicId,UUID patientId,String patientCode,String status,long version){}
 public record OwnClinicLink(UUID clinicId,UUID patientId,String status){}
}
