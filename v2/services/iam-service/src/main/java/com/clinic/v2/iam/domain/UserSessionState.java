package com.clinic.v2.iam.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name="user_session_state", schema="iam")
public class UserSessionState {
    @Id @Column(name="user_id") public UUID userId;
    @Column(name="invalid_before") public Instant invalidBefore;
    @Column(nullable=false) public long version=1;
    @Column(name="updated_at",nullable=false) public Instant updatedAt;

    @PrePersist @PreUpdate
    void touch(){ updatedAt=Instant.now(); }
}
