package com.clinic.v2.iam.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name="memberships", schema="iam", uniqueConstraints=@UniqueConstraint(columnNames={"user_id","clinic_id","role"}))
public class Membership {
    @Id public UUID id;
    @Column(name="user_id",nullable=false) public UUID userId;
    @Column(name="clinic_id",nullable=false) public UUID clinicId;
    @Enumerated(EnumType.STRING) @Column(nullable=false,length=40) public MembershipRole role;
    @Enumerated(EnumType.STRING) @Column(nullable=false,length=16) public MembershipStatus status=MembershipStatus.ACTIVE;
    @Column(name="all_branches",nullable=false) public boolean allBranches;
    @Column(nullable=false) public long version=1;
    @Column(name="created_by",nullable=false) public UUID createdBy;
    @Column(name="revoked_by") public UUID revokedBy;
    @Column(name="revoked_at") public Instant revokedAt;
    @Column(name="created_at",nullable=false) public Instant createdAt;
    @Column(name="updated_at",nullable=false) public Instant updatedAt;
    @PrePersist void insert(){ if(id==null)id=UUID.randomUUID(); Instant now=Instant.now(); createdAt=now;updatedAt=now; }
    @PreUpdate void update(){ updatedAt=Instant.now(); }
}
