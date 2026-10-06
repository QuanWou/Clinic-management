package com.clinic.iam.domain;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
@Entity @Table(name="membership_branch_grants",schema="iam")
public class BranchGrant {
 @Id public UUID id;
 @Column(name="membership_id",nullable=false) public UUID membershipId;
 @Column(name="user_id",nullable=false) public UUID userId;
 @Column(name="clinic_id",nullable=false) public UUID clinicId;
 @Column(name="branch_id",nullable=false) public UUID branchId;
 @Column(nullable=false) public boolean active=true;
 @Column(name="granted_by",nullable=false) public UUID grantedBy;
 @Column(name="granted_at",nullable=false) public Instant grantedAt;
 @Column(name="revoked_by") public UUID revokedBy;
 @Column(name="revoked_at") public Instant revokedAt;
 @PrePersist void create(){if(id==null)id=UUID.randomUUID();if(grantedAt==null)grantedAt=Instant.now();}
}
