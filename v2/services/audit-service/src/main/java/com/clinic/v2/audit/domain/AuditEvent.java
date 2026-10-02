package com.clinic.v2.audit.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name="audit_events",schema="audit_v2")
public class AuditEvent {
    @Id public UUID id;
    @Column(name="scope_key",nullable=false,length=80) public String scopeKey;
    @Column(name="clinic_id") public UUID clinicId;
    @Column(name="branch_id") public UUID branchId;
    @Column(name="actor_user_id",nullable=false) public UUID actorUserId;
    @Column(name="delegated_actor_id") public UUID delegatedActorId;
    @Column(nullable=false,length=40) public String category;
    @Column(nullable=false,length=100) public String action;
    @Column(name="resource_type",nullable=false,length=80) public String resourceType;
    @Column(name="resource_id",nullable=false,length=160) public String resourceId;
    @Column(nullable=false,length=24) public String outcome;
    @Column(length=500) public String reason;
    @Column(name="correlation_id",nullable=false,length=128) public String correlationId;
    @Column(name="occurred_at",nullable=false) public Instant occurredAt;
    @Column(name="previous_hash",length=64) public String previousHash;
    @Column(name="event_hash",nullable=false,length=64,unique=true) public String eventHash;
    @Column(name="metadata_json",nullable=false,columnDefinition="text") public String metadataJson;
    @Column(name="created_at",nullable=false) public Instant createdAt;
    @PrePersist void created(){if(id==null)id=UUID.randomUUID();if(createdAt==null)createdAt=Instant.now();}
}
