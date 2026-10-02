package com.clinic.v2.iam.domain;
import java.io.Serializable;
import java.util.UUID;
public record BranchGrantId(UUID membershipId, UUID branchId) implements Serializable {}
