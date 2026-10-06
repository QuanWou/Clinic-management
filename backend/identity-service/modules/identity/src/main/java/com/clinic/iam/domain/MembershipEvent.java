package com.clinic.iam.domain;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
@Entity @Table(name="membership_events",schema="iam")
public class MembershipEvent {
 @Id public UUID id;
 @Column(name="clinic_id",nullable=false) public UUID clinicId;
 @Column(name="membership_id") public UUID membershipId;
 @Column(name="actor_user_id",nullable=false) public UUID actorUserId;
 @Column(name="target_user_id",nullable=false) public UUID targetUserId;
 @Column(nullable=false,length=40) public String action;
 @Column(nullable=false,length=500) public String reason;
 @Column(name="occurred_at",nullable=false) public Instant occurredAt;
 @PrePersist void create(){if(id==null)id=UUID.randomUUID();if(occurredAt==null)occurredAt=Instant.now();}
}
