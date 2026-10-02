package com.clinic.v2.domain;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
@Entity @Table(name="onboarding_reviews",schema="clinic")
public class ReviewEvent {
    @Id public UUID id;
    @Column(name="clinic_id",nullable=false) public UUID clinicId;
    @Column(name="actor_user_id",nullable=false) public UUID actorUserId;
    @Column(nullable=false,length=40) public String action;
    @Column(nullable=false,length=500) public String reason;
    @Column(name="occurred_at",nullable=false) public Instant occurredAt;
    @PrePersist void initial(){if(id==null)id=UUID.randomUUID();occurredAt=Instant.now();}
}
