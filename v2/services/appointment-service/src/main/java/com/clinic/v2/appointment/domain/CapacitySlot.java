package com.clinic.v2.appointment.domain;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
@Entity
@Table(name="capacity_slots",schema="appointment_v2")
public class CapacitySlot{
 @Id public UUID id;
 @Column(name="clinic_id",nullable=false) public UUID clinicId;
 @Column(name="branch_id",nullable=false) public UUID branchId;
 @Column(name="offering_id",nullable=false) public UUID offeringId;
 @Column(name="doctor_id",nullable=false) public UUID doctorId;
 @Column(name="starts_at",nullable=false) public Instant startsAt;
 @Column(name="ends_at",nullable=false) public Instant endsAt;
 @Column(nullable=false) public int capacity;
 @Column(name="schedule_version",nullable=false) public long scheduleVersion;
 @Column(name="offering_version",nullable=false) public long offeringVersion;
 @Column(nullable=false) public boolean active=true;
 @Column(name="created_at",nullable=false) public Instant createdAt;
 @Column(name="updated_at",nullable=false) public Instant updatedAt;
 @Version @Column(name="row_version",nullable=false) public long version;
 @PrePersist void create(){if(id==null)id=UUID.randomUUID();createdAt=Instant.now();updatedAt=createdAt;}
 @PreUpdate void update(){updatedAt=Instant.now();}
}
