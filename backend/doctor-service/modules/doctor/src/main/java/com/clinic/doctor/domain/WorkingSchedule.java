package com.clinic.doctor.domain;
import jakarta.persistence.*;
import java.time.*;
import java.util.UUID;

@Entity @Table(name="working_schedules",schema="doctor")
public class WorkingSchedule {
    @Id public UUID id;
    @Column(name="affiliation_id",nullable=false) public UUID affiliationId;
    @Column(name="practitioner_id",nullable=false) public UUID practitionerId;
    @Column(name="clinic_id",nullable=false) public UUID clinicId;
    @Column(name="branch_id",nullable=false) public UUID branchId;
    @Column(name="day_of_week",nullable=false) public short dayOfWeek;
    @Column(name="start_minute",nullable=false) public int startMinute;
    @Column(name="end_minute",nullable=false) public int endMinute;
    @Column(nullable=false,length=64) public String timezone="Asia/Ho_Chi_Minh";
    @Column(name="effective_from",nullable=false) public LocalDate effectiveFrom;
    @Column(name="effective_until") public LocalDate effectiveUntil;
    @Column(nullable=false) public boolean active=true;
    @Column(name="created_at",nullable=false) public Instant createdAt;
    @Column(name="updated_at",nullable=false) public Instant updatedAt;
    @Version @Column(name="row_version",nullable=false) public long version;
    @PrePersist void create(){if(id==null)id=UUID.randomUUID();createdAt=Instant.now();updatedAt=createdAt;}
    @PreUpdate void update(){updatedAt=Instant.now();}
}
