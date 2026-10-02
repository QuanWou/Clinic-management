package com.clinic.v2.iam.api;
import com.clinic.v2.iam.domain.*;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.*;
public final class IamDto{
 private IamDto(){}
 public record CreateMembership(@NotNull UUID userId,@NotNull MembershipRole role,boolean allBranches,@Size(max=500) String reason){}
 public record GrantBranch(@NotNull UUID branchId,@Size(max=500) String reason){}
 public record Reason(@NotBlank @Size(max=500) String reason){}
 public record MembershipView(UUID id,UUID userId,UUID clinicId,MembershipRole role,MembershipStatus status,boolean allBranches,long version,List<UUID> branchIds,Instant activatedAt,Instant revokedAt){}
 public record ContextView(UUID membershipId,UUID clinicId,MembershipRole role,boolean allBranches,List<UUID> branchIds,long version){}
 public record AuthorizationRequest(@NotNull UUID actorUserId,UUID clinicId,UUID branchId,@NotNull Capability capability){}
 public record AuthorizationDecision(boolean allowed,UUID membershipId,MembershipRole role,long membershipVersion,String reason){}
 public record PlatformDecision(boolean allowed,long version){}
 public record SessionRevoked(long version,Instant invalidBefore){}
 public record CurrentActor(UUID userId,Set<String> legacyRoles,boolean platformOperator){}
 public record OwnerProvisionRequest(@NotNull UUID userId,@NotNull UUID clinicId,@Size(max=500) String reason){}
}
