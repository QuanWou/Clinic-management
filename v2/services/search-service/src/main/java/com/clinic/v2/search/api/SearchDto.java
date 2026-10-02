package com.clinic.v2.search.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.*;

public final class SearchDto {
  private SearchDto(){}

  public record BranchInput(@NotNull UUID branchId,@NotBlank @Size(max=180) String name,
      @NotBlank @Size(max=300) String address,@NotBlank @Size(max=300) String openingHours,
      boolean active,@Min(1) long sourceVersion){}

  public record ClinicProjectionInput(@NotNull UUID clinicId,@NotBlank @Size(max=80) String slug,
      @NotBlank @Size(max=180) String name,@Size(max=1000) String description,@Size(max=300) String locationText,
      boolean published,@Min(1) long sourceVersion,@NotNull Instant sourceUpdatedAt,
      @NotNull UUID eventId,@Valid List<BranchInput> branches){}

  public record DoctorProjectionInput(@NotNull UUID doctorId,@NotNull UUID clinicId,@NotNull UUID branchId,
      @NotBlank @Size(max=180) String displayName,@Size(max=80) String specialtyCode,
      @Size(max=180) String specialtyName,@Size(max=180) String professionalTitle,
      boolean publicVisible,@Min(1) long sourceVersion,@NotNull UUID eventId){}

  public record OfferingProjectionInput(@NotNull UUID offeringId,@NotNull UUID clinicId,@NotNull UUID branchId,
      @NotBlank @Size(max=80) String code,@NotBlank @Size(max=220) String name,@Size(max=80) String specialtyCode,
      @PositiveOrZero Long amountVnd,@Pattern(regexp="VND") String currency,UUID priceVersionId,
      Instant effectiveFrom,boolean publicVisible,@Min(1) long sourceVersion,@NotNull UUID eventId){}

  public record ClinicCard(UUID clinicId,String slug,String name,String description,String locationText,
      Instant sourceUpdatedAt,Instant indexedAt,List<BranchView> branches){}
  public record BranchView(UUID branchId,String name,String address,String openingHours){}
  public record DoctorView(UUID doctorId,UUID clinicId,UUID branchId,String displayName,
      String specialtyCode,String specialtyName,String professionalTitle,long sourceVersion,Instant indexedAt){}
  public record OfferingView(UUID offeringId,UUID clinicId,UUID branchId,String code,String name,
      String specialtyCode,Long amountVnd,String currency,UUID priceVersionId,Instant effectiveFrom,
      long sourceVersion,Instant indexedAt){}
  public record SearchResponse(List<ClinicCard> clinics,List<DoctorView> doctors,List<OfferingView> offerings){}
  public record ProjectionResult(boolean applied,String reason,long sourceVersion,Instant indexedAt){}
}

