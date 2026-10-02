package com.clinic.v2.api;
import com.clinic.v2.domain.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.*;
import java.util.*;

public final class ClinicDto {
    private ClinicDto(){}
    public record LicenseInput(@Size(max=100) String licenseNumber, @Size(max=180) String issuingAuthority,
        @Size(max=500) String scopeSummary,
        @Pattern(regexp="^[a-zA-Z0-9][a-zA-Z0-9/_-]{0,199}$",message="Provide a private object key, never a public URL") String evidenceRef,
        LocalDate validUntil){}
    public record DraftInput(@NotBlank @Size(max=180) String name,
        @NotBlank @Pattern(regexp="^[a-z0-9]+(?:-[a-z0-9]+)*$",message="lowercase URL slug only") @Size(max=80) String slug,
        @Size(max=1000) String publicDescription,@Size(max=150) String contactName,
        @Email @Size(max=180) String contactEmail,@Size(max=30) String contactPhone,
        @Valid LicenseInput license,@Min(0) Long expectedVersion){
        public DraftInput(String name,String slug,String publicDescription,String contactName,String contactEmail,String contactPhone,LicenseInput license){this(name,slug,publicDescription,contactName,contactEmail,contactPhone,license,null);}
    }
    public record BranchInput(@NotBlank @Size(max=180) String name,
        @NotBlank @Size(max=300) String address,@NotBlank @Size(max=300) String openingHours, boolean active,@Min(0) Long expectedVersion){
        public BranchInput(String name,String address,String openingHours,boolean active){this(name,address,openingHours,active,null);}
    }
    public record DecisionInput(@NotBlank @Size(max=500) String reason, boolean evidenceVerified){}
    public record ReasonInput(@NotBlank @Size(max=500) String reason){}
    public record LicensePrivate(String licenseNumber,String issuingAuthority,String scopeSummary,String evidenceRef,LocalDate validUntil){}
    public record BranchView(UUID id,String name,String address,String openingHours,boolean active){}
    public record OwnerView(UUID id,UUID ownerUserId,String slug,String name,String publicDescription,
        String contactName,String contactEmail,String contactPhone,
        ReviewStatus reviewStatus,PublicationStatus publicationStatus,boolean evidenceVerified,
        UUID reviewedBy,Instant reviewedAt,Instant publishedAt,long version,
        LicensePrivate license,List<BranchView> branches){}
    public record PublicView(UUID id,String slug,String name,String publicDescription,Instant publishedAt,List<BranchView> branches){}
    public record ReviewView(UUID id,UUID actorUserId,String action,String reason,Instant occurredAt){}
    public record BookingEligibility(UUID clinicId,boolean eligible,long version){}
    public record ScopeValidation(UUID clinicId,UUID ownerUserId,boolean exists,Set<UUID> validBranchIds){}
}
