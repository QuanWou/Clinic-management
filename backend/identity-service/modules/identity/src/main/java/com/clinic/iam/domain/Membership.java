package com.clinic.iam.domain;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
@Entity @Table(name="memberships",schema="iam")
public class Membership {
 @Id public UUID id;
 @Column(name="user_id",nullable=false) public UUID userId;
 @Column(name="clinic_id",nullable=false) public UUID clinicId;
 @Enumerated(EnumType.STRING) @Column(nullable=false,length=32) public MembershipRole role;
 @Enumerated(EnumType.STRING) @Column(nullable=false,length=16) public MembershipStatus status;
 @Column(name="all_branches",nullable=false) public boolean allBranches;
 @Column(name="clinic_owner",nullable=false) public boolean clinicOwner;
 @Version @Column(nullable=false) public long version;
 @Column(name="invited_by",nullable=false) public UUID invitedBy;
 @Column(name="invited_at",nullable=false) public Instant invitedAt;
 @Column(name="activated_at") public Instant activatedAt;
 @Column(name="revoked_at") public Instant revokedAt;
 @Column(name="revoked_by") public UUID revokedBy;
 @Column(name="revoke_reason",length=500) public String revokeReason;
 @Column(name="updated_at",nullable=false) public Instant updatedAt;
 @PrePersist void create(){if(id==null)id=UUID.randomUUID();if(invitedAt==null)invitedAt=Instant.now();updatedAt=Instant.now();}
 @PreUpdate void update(){updatedAt=Instant.now();}
}
