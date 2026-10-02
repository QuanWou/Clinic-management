package com.clinic.v2.iam.domain;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
@Entity @Table(name="user_permission_epochs",schema="iam")
public class PermissionEpoch {
  @Id @Column(name="user_id") public UUID userId;
  @Column(nullable=false) public long epoch=1;
  @Column(name="updated_at",nullable=false) public Instant updatedAt;
  @PrePersist @PreUpdate void touch(){updatedAt=Instant.now();}
}
