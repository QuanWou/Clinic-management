package com.clinic.v2.iam.api;

import com.clinic.v2.iam.domain.*;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.*;

public final class IamDto {
  private IamDto(){}
  public record MembershipInput(@NotNull UUID userId,@NotNull UUID clinicId,@NotNull MembershipRole role,
      boolean allBranches, Set<UUID> branchIds,@NotBlank @Size(max=500) String reason){}
  public record BranchScopeInput(boolean allBranches,Set<UUID> branchIds,@NotBlank @Size(max=500) String reason){}
  public record RevokeInput(@NotBlank @Size(max=500) String reason){}
  public record MembershipView(UUID id,UUID userId,UUID clinicId,MembershipRole role,MembershipStatus status,
      boolean allBranches,Set<UUID> branchIds,long version,Instant revokedAt){}
  public record ClinicContext(UUID clinicId,UUID branchId,Set<MembershipRole> roles,long permissionVersion){}
  public record ContextSummary(UUID clinicId,Set<MembershipRole> roles,boolean allBranches,Set<UUID> branchIds,long permissionVersion){}
  public record AuthorizationRequest(@NotNull UUID userId,UUID clinicId,UUID branchId,@NotBlank String capability){}
  public record AuthorizationResult(boolean allowed,long permissionVersion){}
  public record OwnerProvisionRequest(@NotNull UUID userId,@NotNull UUID clinicId,@NotBlank @Size(max=500) String reason){}
  public record PlatformGrantInput(@NotNull UUID userId,@NotNull PlatformCapability capability,@NotBlank @Size(max=500) String reason){}
  public record PlatformGrantView(UUID userId,PlatformCapability capability,MembershipStatus status,long version,Instant revokedAt){}
}
