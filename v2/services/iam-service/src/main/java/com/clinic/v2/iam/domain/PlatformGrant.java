package com.clinic.v2.iam.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name="platform_grants",schema="iam")
@IdClass(PlatformGrantId.class)
public class PlatformGrant {
    @Id @Column(name="user_id") public UUID userId;
    @Id @Enumerated(EnumType.STRING) @Column(nullable=false,length=60) public PlatformCapability capability;
    @Enumerated(EnumType.STRING) @Column(nullable=false,length=16) public MembershipStatus status=MembershipStatus.ACTIVE;
    @Column(nullable=false) public long version=1;
    @Column(name="granted_by",nullable=false,length=100) public String grantedBy;
    @Column(name="revoked_at") public Instant revokedAt;
    @Column(name="updated_at",nullable=false) public Instant updatedAt;
    @PrePersist @PreUpdate void timestamp(){updatedAt=Instant.now();}
}
