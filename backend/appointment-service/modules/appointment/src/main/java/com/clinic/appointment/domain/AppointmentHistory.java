package com.clinic.appointment.domain;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
@Entity
@Table(name="appointment_history",schema="appointment_v2")
public class AppointmentHistory{
 @Id public UUID id;
 @Column(name="appointment_id",nullable=false) public UUID appointmentId;
 @Column(name="from_status",length=32) public String fromStatus;
 @Column(name="to_status",nullable=false,length=32) public String toStatus;
 @Column(name="actor_user_id",nullable=false) public UUID actorUserId;
 @Column(length=500) public String reason;
 @Column(name="correlation_id",length=128) public String correlationId;
 @Column(name="old_slot_id") public UUID oldSlotId;
 @Column(name="new_slot_id") public UUID newSlotId;
 @Column(name="old_reservation_id") public UUID oldReservationId;
 @Column(name="new_reservation_id") public UUID newReservationId;
 @Column(name="occurred_at",nullable=false) public Instant occurredAt;
 @PrePersist void create(){if(id==null)id=UUID.randomUUID();occurredAt=Instant.now();}
}
