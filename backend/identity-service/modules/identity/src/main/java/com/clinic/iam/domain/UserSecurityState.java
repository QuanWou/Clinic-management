package com.clinic.iam.domain;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
@Entity @Table(name="user_security_state",schema="iam")
public class UserSecurityState {
 @Id @Column(name="user_id") public UUID userId;
 @Column(name="invalid_before") public Instant invalidBefore;
 @Version @Column(nullable=false) public long version;
 @Column(name="updated_at",nullable=false) public Instant updatedAt;
 @PrePersist @PreUpdate void touch(){updatedAt=Instant.now();}
}
