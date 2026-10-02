package com.clinic.v2.iam.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name="membership_branch_grants",schema="iam")
@IdClass(BranchGrantId.class)
public class MembershipBranchGrant {
    @Id @Column(name="membership_id") public UUID membershipId;
    @Column(name="clinic_id",nullable=false) public UUID clinicId;
    @Id @Column(name="branch_id") public UUID branchId;
    @Column(name="created_at",nullable=false) public Instant createdAt;
    @PrePersist void insert(){createdAt=Instant.now();}
}
