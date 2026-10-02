package com.clinic.v2.iam.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name="security_events",schema="iam")
public class SecurityEvent {
    @Id public UUID id;
    @Column(name="actor_user_id") public UUID actorUserId;
    @Column(name="workload_subject",length=100) public String workloadSubject;
    @Column(name="target_user_id") public UUID targetUserId;
    @Column(name="clinic_id") public UUID clinicId;
    @Column(name="membership_id") public UUID membershipId;
    @Column(nullable=false,length=60) public String action;
    @Column(nullable=false,length=500) public String reason;
    @Column(name="occurred_at",nullable=false) public Instant occurredAt;
    @PrePersist void insert(){if(id==null)id=UUID.randomUUID();occurredAt=Instant.now();}
}
