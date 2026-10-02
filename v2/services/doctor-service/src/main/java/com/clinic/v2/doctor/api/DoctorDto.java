package com.clinic.v2.doctor.api;
import jakarta.validation.constraints.*;
import java.time.*;
import java.util.*;

public final class DoctorDto {
    private DoctorDto(){}

    public record AffiliationInput(
        @NotNull UUID userId,
        @NotBlank @Size(max=180) String displayName,
        @Size(max=100) String registrationCode,
        @NotBlank @Pattern(regexp="^[A-Za-z0-9._-]{1,60}$") String specialtyCode,
        @NotBlank @Size(max=160) String specialtyName,
        @Size(max=120) String professionalTitle,
        @NotNull LocalDate effectiveFrom,
        LocalDate effectiveUntil,
        boolean publicVisible
    ){}

    public record AffiliationUpdate(
        @Min(0) long expectedVersion,
        @NotBlank @Pattern(regexp="^[A-Za-z0-9._-]{1,60}$") String specialtyCode,
        @NotBlank @Size(max=160) String specialtyName,
        @Size(max=120) String professionalTitle,
        @NotNull LocalDate effectiveFrom,
        LocalDate effectiveUntil,
        boolean active,
        boolean publicVisible
    ){}

    public record ScheduleInput(
        @Min(1) @Max(7) int dayOfWeek,
        @NotNull LocalTime startTime,
        @NotNull LocalTime endTime,
        @NotNull LocalDate effectiveFrom,
        LocalDate effectiveUntil,
        @Size(max=64) String timezone,
        boolean active
    ){}

    public record ScheduleUpdate(
        @Min(0) long expectedVersion,
        @Min(1) @Max(7) int dayOfWeek,
        @NotNull LocalTime startTime,
        @NotNull LocalTime endTime,
        @NotNull LocalDate effectiveFrom,
        LocalDate effectiveUntil,
        @Size(max=64) String timezone,
        boolean active
    ){}

    public record AffiliationView(UUID id,UUID practitionerId,UUID userId,UUID clinicId,UUID branchId,
        String displayName,String registrationCode,String specialtyCode,String specialtyName,String professionalTitle,
        boolean publicVisible,LocalDate effectiveFrom,LocalDate effectiveUntil,boolean active,long version){}

    public record ScheduleView(UUID id,UUID affiliationId,UUID practitionerId,UUID clinicId,UUID branchId,
        int dayOfWeek,LocalTime startTime,LocalTime endTime,String timezone,
        LocalDate effectiveFrom,LocalDate effectiveUntil,boolean active,long version){}

    public record DoctorScheduleView(AffiliationView affiliation,List<ScheduleView> schedules){}

    public record PublicScheduleView(int dayOfWeek,LocalTime startTime,LocalTime endTime,String timezone,
        LocalDate effectiveFrom,LocalDate effectiveUntil,long version){}
    public record PublicDoctorView(UUID practitionerId,UUID clinicId,UUID branchId,String displayName,
        String specialtyCode,String specialtyName,String professionalTitle,long affiliationVersion,
        List<PublicScheduleView> schedules){}
}
