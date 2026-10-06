package com.clinic.appointment.domain;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
@Entity
@Table(name="outbox_events",schema="appointment_v2")
public class OutboxEvent{
 @Id public UUID id;
 @Column(name="event_id",nullable=false,unique=true) public UUID eventId;
 @Column(name="event_type",nullable=false,length=120) public String eventType;
 @Column(name="aggregate_id",nullable=false) public UUID aggregateId;
 @Column(name="correlation_id",nullable=false,length=128) public String correlationId;
 @Column(name="payload_json",nullable=false,columnDefinition="text") public String payloadJson;
 @Column(nullable=false,length=20) public String status="PENDING";
 @Column(nullable=false) public int attempts;
 @Column(name="next_attempt_at",nullable=false) public Instant nextAttemptAt;
 @Column(name="last_error",length=500) public String lastError;
 @Column(name="created_at",nullable=false) public Instant createdAt;
 @Column(name="published_at") public Instant publishedAt;
 @PrePersist void create(){if(id==null)id=UUID.randomUUID();if(eventId==null)eventId=UUID.randomUUID();createdAt=Instant.now();if(nextAttemptAt==null)nextAttemptAt=createdAt;}
}
