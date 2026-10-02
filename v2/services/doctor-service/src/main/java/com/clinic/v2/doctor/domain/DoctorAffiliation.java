package com.clinic.v2.doctor.domain;
import jakarta.persistence.*;
import java.time.*;
import java.util.UUID;

@Entity @Table(name="doctor_affiliations",schema="doctor")
public class DoctorAffiliation {
    @Id public UUID id;
    @Column(name="practitioner_id",nullable=false) public UUID practitionerId;
    @Column(name="clinic_id",nullable=false) public UUID clinicId;
    @Column(name="branch_id",nullable=false) public UUID branchId;
    @Column(name="specialty_code",nullable=false,length=60) public String specialtyCode;
    @Column(name="specialty_name",nullable=false,length=160) public String specialtyName;
    @Column(name="professional_title",length=120) public String professionalTitle;
    @Column(name="public_visible",nullable=false) public boolean publicVisible;
    @Column(name="effective_from",nullable=false) public LocalDate effectiveFrom;
    @Column(name="effective_until") public LocalDate effectiveUntil;
    @Column(nullable=false) public boolean active=true;
    @Column(name="created_at",nullable=false) public Instant createdAt;
    @Column(name="updated_at",nullable=false) public Instant updatedAt;
    @Version @Column(name="row_version",nullable=false) public long version;
    @PrePersist void create(){if(id==null)id=UUID.randomUUID();createdAt=Instant.now();updatedAt=createdAt;}
    @PreUpdate void update(){updatedAt=Instant.now();}
}
