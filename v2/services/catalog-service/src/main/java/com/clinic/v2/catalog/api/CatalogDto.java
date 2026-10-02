package com.clinic.v2.catalog.api;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.UUID;

public final class CatalogDto {
    private CatalogDto(){}

    public record OfferingInput(
        @NotBlank @Pattern(regexp="^[A-Z0-9._-]{1,60}$") String code,
        @NotBlank @Size(max=220) String name,
        @Size(max=1000) String description,
        @Size(max=60) String specialtyCode,
        boolean active
    ){}

    public record OfferingUpdate(
        @Min(0) long expectedVersion,
        @NotBlank @Size(max=220) String name,
        @Size(max=1000) String description,
        @Size(max=60) String specialtyCode,
        boolean active
    ){}

    public record BranchOfferingInput(
        @NotNull UUID offeringId,
        @Min(5) @Max(720) Integer durationMinutes,
        boolean active,
        boolean publicVisible
    ){}

    public record BranchOfferingUpdate(
        @Min(0) long expectedVersion,
        @Min(5) @Max(720) Integer durationMinutes,
        boolean active,
        boolean publicVisible
    ){}

    public record PriceVersionInput(
        @NotNull UUID offeringId,
        @PositiveOrZero long amountVnd,
        @NotNull Instant effectiveFrom,
        @Pattern(regexp="^[A-Z0-9._-]{1,80}$") String taxPolicyCode,
        @Pattern(regexp="^[A-Z0-9._-]{1,80}$") String discountPolicyCode
    ){}

    public record OfferingView(UUID id,UUID clinicId,String code,String name,String description,
        String specialtyCode,boolean active,long version){}

    public record BranchOfferingView(UUID id,UUID clinicId,UUID branchId,OfferingView offering,
        Integer durationMinutes,boolean active,boolean publicVisible,long version){}

    public record PriceVersionView(UUID id,UUID clinicId,UUID branchId,UUID offeringId,
        long amountVnd,String currency,String taxPolicyCode,String discountPolicyCode,
        Instant effectiveFrom,UUID createdBy,Instant createdAt){}

    public record PriceSnapshot(UUID priceVersionId,UUID clinicId,UUID branchId,UUID offeringId,
        long amountVnd,String currency,String taxPolicyCode,String discountPolicyCode,
        Instant effectiveFrom,Instant resolvedAt){}

    public record PublicOfferingView(UUID offeringId,UUID clinicId,UUID branchId,String code,String name,
        String description,String specialtyCode,Integer durationMinutes,long amountVnd,String currency,
        UUID priceVersionId,Instant effectiveFrom,String taxPolicyCode,String discountPolicyCode,
        long offeringVersion,long branchOfferingVersion){}
}
