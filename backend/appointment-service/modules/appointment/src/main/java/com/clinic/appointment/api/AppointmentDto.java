package com.clinic.appointment.api;
import jakarta.validation.constraints.*;
import java.time.*;
import java.util.*;

public final class AppointmentDto{
 private AppointmentDto(){}
 public enum AvailabilityReason{
   AVAILABLE,DOCTOR_NOT_WORKING,FULLY_BOOKED,NO_CAPACITY_CONFIGURED,DOCTOR_UNAVAILABLE,SERVICE_NOT_SUPPORTED,NO_ELIGIBLE_DOCTOR,INVALID_SPECIALTY,ERROR
 }
 public record PriceSnapshot(UUID priceVersionId,long amountVnd,String currency,Instant effectiveFrom,String taxPolicyCode,String discountPolicyCode){}
 public record AvailabilitySlot(UUID slotId,UUID clinicId,UUID branchId,UUID offeringId,UUID doctorId,
   Instant startsAt,Instant endsAt,int capacity,int remaining,long scheduleVersion,long offeringVersion,
   PriceSnapshot price){}
 public record BookingSchedule(int dayOfWeek,LocalTime startTime,LocalTime endTime,String timezone,LocalDate effectiveFrom,LocalDate effectiveUntil,long version){}
 public record BookingDoctor(UUID doctorId,String displayName,String specialtyCode,String specialtyName,String professionalTitle,List<BookingSchedule> schedules){}
 public record BookingOffering(UUID offeringId,String code,String name,String specialtyCode,Integer durationMinutes){}
 public record BookingSpecialty(String code,String name){}
 public record BookingOptions(List<BookingSpecialty> specialties,List<BookingDoctor> doctors,List<BookingOffering> offerings){}
 public record AvailabilityResult(boolean available,AvailabilityReason reason,UUID doctorId,String doctorName,LocalDate date,List<AvailabilitySlot> slots){}
 public record HoldInput(@NotNull UUID clinicId,@NotNull UUID branchId,@NotNull UUID offeringId,@NotNull UUID doctorId,
   @NotNull UUID slotId,@NotNull UUID patientId){}
 public record FollowUpInput(@NotNull UUID clinicId,@NotNull UUID branchId,@NotNull UUID offeringId,@NotNull UUID doctorId,
   @NotNull UUID slotId,@NotNull UUID patientId,@NotNull UUID priorEncounterId,@NotNull UUID priorBranchId){
   public HoldInput booking(){return new HoldInput(clinicId,branchId,offeringId,doctorId,slotId,patientId);}
 }
 public record HoldView(UUID holdId,UUID slotId,UUID clinicId,UUID branchId,UUID patientId,String state,
   Instant expiresAt,PriceSnapshot price,String purpose,UUID rescheduleAppointmentId,UUID priorEncounterId){}
 public record PendingHoldView(HoldView hold,UUID offeringId,UUID doctorId,Instant startsAt,Instant endsAt){}
 public record ConfirmInput(@NotNull UUID clinicId,@NotNull UUID holdId,@NotNull UUID patientId){}
 public record CancelInput(@NotNull UUID clinicId,@NotNull UUID patientId,@NotBlank @Size(max=500) String reason,@Size(max=128) String correlationId){}
 public record RescheduleInput(@NotNull UUID clinicId,@NotNull UUID patientId,@NotNull UUID newHoldId,
   @NotBlank @Size(max=500) String reason,@Size(max=128) String correlationId){}
 public record AppointmentView(UUID id,String appointmentCode,UUID clinicId,UUID branchId,UUID patientId,
   UUID clinicPatientLinkId,UUID offeringId,UUID doctorId,UUID slotId,String status,
   Instant startsAt,Instant endsAt,PriceSnapshot price,long version,UUID priorEncounterId,UUID priorBranchId){}
}
