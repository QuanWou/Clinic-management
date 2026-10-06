package com.clinic.iam.domain;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
@Entity @Table(name="platform_operators",schema="iam")
public class PlatformOperator {
 @Id @Column(name="user_id") public UUID userId;
 @Column(nullable=false) public boolean active=true;
 @Version @Column(nullable=false) public long version;
 @Column(name="granted_at",nullable=false) public Instant grantedAt;
 @Column(name="revoked_at") public Instant revokedAt;
 @PrePersist void create(){if(grantedAt==null)grantedAt=Instant.now();}
}
